import { IntakeError } from "./errors";
import { GitHubRepoRefSchema, type GitHubRepoRef } from "./schema";

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function normalizeGitHubUrl(input: string): GitHubRepoRef {
  const trimmed = input.trim();
  if (/^https:\/\/github\.com:\d+(?:\/|$)/i.test(trimmed)) {
    throw new IntakeError(
      "INVALID_URL",
      "Explicit ports are not allowed in GitHub repository URLs.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new IntakeError("INVALID_URL", "Enter a complete public GitHub repository URL.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new IntakeError(
      "INVALID_URL",
      "PitchFlow accepts only canonical HTTPS github.com repository URLs without credentials, ports, query parameters, or fragments.",
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new IntakeError(
      "INVALID_URL",
      "The URL must include both a GitHub owner and repository.",
    );
  }

  const owner = segments[0];
  const rawRepository = segments[1];
  if (!owner || !rawRepository) {
    throw new IntakeError(
      "INVALID_URL",
      "The URL must include both a GitHub owner and repository.",
    );
  }
  const repository = rawRepository.toLowerCase().endsWith(".git")
    ? rawRepository.slice(0, -4)
    : rawRepository;

  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repository)) {
    throw new IntakeError("INVALID_URL", "The GitHub owner or repository name is not valid.");
  }

  let requestedRef: string | null = null;
  if (segments.length > 2) {
    if (segments.length !== 4 || segments[2] !== "tree" || !segments[3]) {
      throw new IntakeError(
        "INVALID_URL",
        "Use a repository root URL or a GitHub /tree/{ref} URL. File and directory URLs are not supported.",
      );
    }
    requestedRef = decodeURIComponent(segments[3]);
    if (!REF_PATTERN.test(requestedRef)) {
      throw new IntakeError(
        "UNSUPPORTED_REF",
        "For the Build Week release, refs must be one safe branch, tag, or SHA segment without slashes.",
      );
    }
  }

  return GitHubRepoRefSchema.parse({
    owner,
    repository,
    requestedRef,
    canonicalUrl: `https://github.com/${owner}/${repository}`,
  });
}
