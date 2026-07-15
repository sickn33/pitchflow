import { IntakeError } from "./errors";
import { createEvidenceItem, snapshotIdentifier } from "./evidence";
import { normalizeGitHubUrl } from "./github-url";
import {
  PITCHFLOW_SCHEMA_VERSION,
  RepoSnapshotSchema,
  type EvidenceItem,
  type RepoFile,
  type RepoSnapshot,
} from "./schema";
import { containsBinaryData, safeExcerpt } from "./security";

export type IngestLimits = {
  maxTreeEntries: number;
  maxSelectedFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  timeoutMs: number;
};

export const DEFAULT_INGEST_LIMITS = {
  maxTreeEntries: 5000,
  maxSelectedFiles: 18,
  maxFileBytes: 64 * 1024,
  maxTotalBytes: 512 * 1024,
  timeoutMs: 15_000,
} as const satisfies IngestLimits;

type FetchLike = typeof fetch;

type GitHubRepositoryResponse = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  default_branch: string;
  archived: boolean;
  fork: boolean;
  license: { spdx_id?: string | null } | null;
};

type GitHubCommitResponse = {
  sha: string;
  commit: { tree: { sha: string } };
};

type GitHubTreeResponse = {
  truncated: boolean;
  tree: Array<{ path?: string; type?: "blob" | "tree" | "commit"; size?: number }>;
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
  html_url?: string;
  size?: number;
};

export type IngestOptions = {
  fetch?: FetchLike;
  githubToken?: string;
  signal?: AbortSignal;
  limits?: Partial<IngestLimits>;
  capturedAt?: string;
};

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

function githubHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "pitchflow-build-week/0.1",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function classifyGitHubFailure(status: number, remaining: string | null): IntakeError {
  if (status === 404) {
    return new IntakeError("NOT_FOUND", "The repository or requested ref was not found.", 404);
  }
  if (status === 401 || status === 403) {
    if (remaining === "0") {
      return new IntakeError(
        "RATE_LIMITED",
        "GitHub's API rate limit was reached. Add a local GITHUB_TOKEN or retry after the reset.",
        429,
      );
    }
    return new IntakeError(
      "PRIVATE_OR_FORBIDDEN",
      "PitchFlow can analyze public repositories only, and GitHub denied this request.",
      403,
    );
  }
  return new IntakeError("UPSTREAM_ERROR", `GitHub returned HTTP ${status}.`, 502);
}

async function githubJson<T>(
  fetcher: FetchLike,
  path: string,
  headers: HeadersInit,
  signal: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(`https://api.github.com${path}`, { headers, signal });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new IntakeError("UPSTREAM_TIMEOUT", "GitHub intake timed out safely.", 504, {
        cause: error,
      });
    }
    throw new IntakeError("UPSTREAM_ERROR", "GitHub could not be reached.", 502, { cause: error });
  }

  if (!response.ok) {
    throw classifyGitHubFailure(response.status, response.headers.get("x-ratelimit-remaining"));
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new IntakeError("MALFORMED_RESPONSE", "GitHub returned malformed JSON.", 502, {
      cause: error,
    });
  }
}

function toRepoFile(entry: GitHubTreeResponse["tree"][number]): RepoFile | null {
  if (!entry.path || !entry.type) return null;
  const kind = entry.type === "blob" ? "file" : entry.type === "tree" ? "directory" : "submodule";
  return { path: entry.path, size: entry.size ?? 0, kind };
}

const ROOT_PRIORITY = [
  /^README(?:\.[^/]+)?$/i,
  /^package\.json$/i,
  /^pyproject\.toml$/i,
  /^Cargo\.toml$/i,
  /^go\.mod$/i,
  /^composer\.json$/i,
  /^Gemfile$/i,
  /^LICENSE(?:\.[^/]+)?$/i,
];

function selectedFileScore(path: string): number {
  const rootIndex = ROOT_PRIORITY.findIndex((pattern) => pattern.test(path));
  if (rootIndex >= 0) return rootIndex;
  if (/^docs\/[^/]+\.md$/i.test(path)) return 20;
  if (/^(?:docs|documentation)\/.*\.md$/i.test(path)) return 30 + path.split("/").length;
  return Number.POSITIVE_INFINITY;
}

function evidenceKindForPath(path: string): EvidenceItem["kind"] {
  if (/^README/i.test(path)) return "readme";
  if (/^LICENSE/i.test(path)) return "license";
  if (/\.(?:json|toml|mod)$/i.test(path) || /Gemfile$/i.test(path)) return "manifest";
  return "documentation";
}

function decodeGitHubContent(payload: GitHubContentResponse): string {
  if (payload.encoding !== "base64" || typeof payload.content !== "string") {
    throw new IntakeError("MALFORMED_RESPONSE", "GitHub file content was not base64 encoded.", 502);
  }
  return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function validHomepage(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function ingestPublicGitHubRepository(
  inputUrl: string,
  options: IngestOptions = {},
): Promise<RepoSnapshot> {
  const reference = normalizeGitHubUrl(inputUrl);
  const limits = { ...DEFAULT_INGEST_LIMITS, ...options.limits };
  const fetcher = options.fetch ?? fetch;
  const signal = combineSignals(limits.timeoutMs, options.signal);
  const headers = githubHeaders(options.githubToken);
  const encodedRepo = `${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}`;

  const repository = await githubJson<GitHubRepositoryResponse>(
    fetcher,
    `/repos/${encodedRepo}`,
    headers,
    signal,
  );
  const resolvedRef = reference.requestedRef ?? repository.default_branch;
  const commit = await githubJson<GitHubCommitResponse>(
    fetcher,
    `/repos/${encodedRepo}/commits/${encodeURIComponent(resolvedRef)}`,
    headers,
    signal,
  );

  if (!/^[a-f0-9]{40}$/.test(commit.sha) || !/^[a-f0-9]{40}$/.test(commit.commit.tree.sha)) {
    throw new IntakeError(
      "MALFORMED_RESPONSE",
      "GitHub returned an invalid commit or tree SHA.",
      502,
    );
  }

  const [treePayload, languages] = await Promise.all([
    githubJson<GitHubTreeResponse>(
      fetcher,
      `/repos/${encodedRepo}/git/trees/${commit.commit.tree.sha}?recursive=1`,
      headers,
      signal,
    ),
    githubJson<Record<string, number>>(fetcher, `/repos/${encodedRepo}/languages`, headers, signal),
  ]);

  const discoveredFiles = treePayload.tree.filter((entry) => entry.type === "blob").length;
  if (discoveredFiles === 0) {
    throw new IntakeError("EMPTY_REPOSITORY", "The repository has no files to analyze.", 422);
  }
  if (treePayload.tree.length > limits.maxTreeEntries) {
    throw new IntakeError(
      "OVERSIZED_REPOSITORY",
      `The repository tree exceeds PitchFlow's ${limits.maxTreeEntries.toLocaleString()}-entry safety limit.`,
      413,
    );
  }

  const tree = treePayload.tree
    .map(toRepoFile)
    .filter((entry): entry is RepoFile => entry !== null)
    .slice(0, limits.maxTreeEntries);

  const evidence: EvidenceItem[] = [];
  const sourceBase = `${reference.canonicalUrl}/blob/${commit.sha}`;
  evidence.push(
    createEvidenceItem({
      kind: "repository_metadata",
      label: "GitHub repository metadata",
      path: null,
      excerpt: [
        `Name: ${repository.full_name}`,
        `Description: ${repository.description ?? "No description supplied"}`,
        `Default branch: ${repository.default_branch}`,
        `Archived: ${String(repository.archived)}`,
        `Fork: ${String(repository.fork)}`,
      ].join("\n"),
      normalizedFact: repository.description,
      sourceUrl: `${reference.canonicalUrl}/tree/${commit.sha}`,
      commitSha: commit.sha,
    }),
  );
  evidence.push(
    createEvidenceItem({
      kind: "languages",
      label: "GitHub language analysis",
      path: null,
      excerpt:
        Object.entries(languages)
          .sort(([, left], [, right]) => right - left)
          .map(([name, bytes]) => `${name}: ${bytes} bytes`)
          .join("\n") || "GitHub reported no language breakdown.",
      normalizedFact: Object.keys(languages).join(", ") || "No languages reported",
      sourceUrl: `${reference.canonicalUrl}/tree/${commit.sha}`,
      commitSha: commit.sha,
    }),
  );
  evidence.push(
    createEvidenceItem({
      kind: "source_tree",
      label: "Bounded repository tree",
      path: null,
      excerpt: tree
        .filter((entry) => entry.kind === "file")
        .slice(0, 120)
        .map((entry) => `${entry.path} (${entry.size} bytes)`)
        .join("\n"),
      normalizedFact: `${discoveredFiles} files discovered; ${tree.length} bounded tree entries retained`,
      sourceUrl: `${reference.canonicalUrl}/tree/${commit.sha}`,
      commitSha: commit.sha,
    }),
  );

  const selected = tree
    .filter((entry) => entry.kind === "file" && entry.size <= limits.maxFileBytes)
    .map((entry) => ({ entry, score: selectedFileScore(entry.path) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (left, right) => left.score - right.score || left.entry.path.localeCompare(right.entry.path),
    )
    .slice(0, limits.maxSelectedFiles);

  let includedBytes = 0;
  let includedFiles = 0;
  for (const { entry } of selected) {
    if (includedBytes + entry.size > limits.maxTotalBytes) break;
    const payload = await githubJson<GitHubContentResponse>(
      fetcher,
      `/repos/${encodedRepo}/contents/${entry.path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${commit.sha}`,
      headers,
      signal,
    );
    if ((payload.size ?? entry.size) > limits.maxFileBytes) continue;
    const content = decodeGitHubContent(payload);
    if (containsBinaryData(content)) continue;
    const excerpt = safeExcerpt(content);
    if (!excerpt) continue;
    evidence.push(
      createEvidenceItem({
        kind: evidenceKindForPath(entry.path),
        label: entry.path,
        path: entry.path,
        excerpt,
        normalizedFact: null,
        sourceUrl: payload.html_url?.startsWith(reference.canonicalUrl)
          ? payload.html_url
          : `${sourceBase}/${entry.path.split("/").map(encodeURIComponent).join("/")}`,
        commitSha: commit.sha,
      }),
    );
    includedBytes += Buffer.byteLength(content);
    includedFiles += 1;
  }

  const snapshotId = snapshotIdentifier(reference.canonicalUrl, commit.sha, evidence);

  return RepoSnapshotSchema.parse({
    schemaVersion: PITCHFLOW_SCHEMA_VERSION,
    id: snapshotId,
    repository: {
      owner: reference.owner,
      name: repository.name,
      canonicalUrl: reference.canonicalUrl,
      description: repository.description,
      homepage: validHomepage(repository.homepage),
      defaultBranch: repository.default_branch,
      licenseSpdx: repository.license?.spdx_id ?? null,
      isArchived: repository.archived,
      isFork: repository.fork,
    },
    requestedRef: reference.requestedRef,
    resolvedRef,
    commitSha: commit.sha,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    languages,
    tree,
    evidence,
    limits: {
      discoveredFiles,
      includedFiles,
      includedBytes,
      truncatedTree: treePayload.truncated,
    },
  });
}
