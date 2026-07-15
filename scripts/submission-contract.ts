import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export type SubmissionVerification = {
  status: "ok" | "gated" | "failed";
  checkedFiles: number;
  gates: string[];
  errors: string[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function numberValue(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(record: JsonRecord, key: string): boolean | null {
  return typeof record[key] === "boolean" ? record[key] : null;
}

function safePath(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${resolve(root)}${sep}`)) {
    throw new Error(`Submission path escapes the repository: ${relativePath}`);
  }
  return target;
}

async function jsonFile(root: string, relativePath: string): Promise<JsonRecord> {
  const parsed: unknown = JSON.parse(await readFile(safePath(root, relativePath), "utf8"));
  if (!isRecord(parsed)) throw new Error(`${relativePath} must contain a JSON object.`);
  return parsed;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function verifyFile(
  root: string,
  relativePath: string,
  expectedBytes: number | null,
  expectedSha256: string | null,
  errors: string[],
): Promise<void> {
  try {
    const path = safePath(root, relativePath);
    const file = await stat(path);
    if (!file.isFile() || file.size === 0) {
      errors.push(`${relativePath} is missing or empty.`);
      return;
    }
    if (expectedBytes !== null && file.size !== expectedBytes) {
      errors.push(`${relativePath} byte count does not match its manifest.`);
    }
    if (expectedSha256 !== null && (await sha256(path)) !== expectedSha256) {
      errors.push(`${relativePath} SHA-256 does not match its manifest.`);
    }
  } catch (error) {
    errors.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function nested(record: JsonRecord, key: string, errors: string[]): JsonRecord {
  const value = record[key];
  if (!isRecord(value)) {
    errors.push(`submission/status.json field ${key} must be an object.`);
    return {};
  }
  return value;
}

function validUrl(value: string | null, hosts: ReadonlySet<string>): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.has(url.hostname);
  } catch {
    return false;
  }
}

export async function verifySubmission(
  root: string,
  options: { allowGates: boolean },
): Promise<SubmissionVerification> {
  const errors: string[] = [];
  const gates: string[] = [];
  let checkedFiles = 0;
  const count = async (
    path: string,
    bytes: number | null = null,
    hash: string | null = null,
  ): Promise<void> => {
    checkedFiles += 1;
    await verifyFile(root, path, bytes, hash, errors);
  };

  const requiredDocuments = [
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/BUILD_WEEK_RULES.md",
    "docs/CODEX_COLLABORATION.md",
    "docs/DEMO_SCRIPT.md",
    "docs/DEVPOST.md",
    "docs/JUDGING.md",
    "docs/PROVENANCE.md",
    "docs/TESTING.md",
  ];
  await Promise.all(requiredDocuments.map((path) => count(path)));

  let status: JsonRecord = {};
  try {
    status = await jsonFile(root, "submission/status.json");
    checkedFiles += 1;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (stringValue(status, "format") !== "pitchflow-submission-status") {
    errors.push("submission/status.json has the wrong format.");
  }
  if (status.version !== 1) errors.push("submission/status.json has the wrong version.");
  if (stringValue(status, "category") !== "Developer Tools") {
    errors.push("Submission category must be Developer Tools.");
  }
  if (stringValue(status, "language") !== "English") {
    errors.push("Submission language must be English.");
  }
  if (stringValue(status, "repositoryUrl") !== "https://github.com/sickn33/pitchflow") {
    errors.push("Submission repository URL is not canonical.");
  }
  if (stringValue(status, "publicViewerUrl") !== "https://pitchflow-ten.vercel.app") {
    errors.push("Submission public viewer URL is not canonical.");
  }

  const mediaManifestPath = "submission/media/manifest.json";
  try {
    const media = await jsonFile(root, mediaManifestPath);
    checkedFiles += 1;
    if (stringValue(media, "format") !== "pitchflow-submission-media") {
      errors.push(`${mediaManifestPath} has the wrong format.`);
    }
    if (media.fakeProductUi !== false)
      errors.push("Submission media must declare fakeProductUi=false.");
    const outputs = Array.isArray(media.outputs) ? media.outputs : [];
    if (outputs.length !== 3) errors.push("Submission media must contain exactly three images.");
    for (const value of outputs) {
      if (!isRecord(value)) {
        errors.push("Submission media output is malformed.");
        continue;
      }
      const filename = stringValue(value, "filename");
      if (!filename || filename.includes("/") || filename.includes("\\")) {
        errors.push("Submission media filename is unsafe.");
        continue;
      }
      if (numberValue(value, "width") !== 1800 || numberValue(value, "height") !== 1200) {
        errors.push(`${filename} must be 1800x1200.`);
      }
      await count(
        `submission/media/${filename}`,
        numberValue(value, "bytes"),
        stringValue(value, "sha256"),
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const narration = await jsonFile(root, "submission/demo/narration-report.json");
    checkedFiles += 1;
    if (stringValue(narration, "format") !== "pitchflow-demo-narration") {
      errors.push("Narration report has the wrong format.");
    }
    const audio = nested(narration, "audio", errors);
    const duration = numberValue(audio, "durationSeconds");
    if (duration === null || duration <= 0 || duration > 180) {
      errors.push("Narration duration must be greater than zero and at most 180 seconds.");
    }
    if (stringValue(audio, "codec") !== "AAC") errors.push("Narration must use AAC audio.");
    const audioPath = stringValue(audio, "path");
    if (!audioPath) errors.push("Narration audio path is missing.");
    else await count(audioPath, numberValue(audio, "bytes"), stringValue(audio, "sha256"));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const demo = nested(status, "demo", errors);
  const demoPath = stringValue(demo, "path");
  const demoReportPath = stringValue(demo, "reportPath");
  if (!demoPath || !demoReportPath) {
    errors.push("Final demo video and report paths are required.");
  } else {
    try {
      const report = await jsonFile(root, demoReportPath);
      checkedFiles += 1;
      if (
        !new Set(["pitchflow-build-week-demo-render", "pitchflow-build-week-demo-delivery"]).has(
          stringValue(report, "format") ?? "",
        )
      ) {
        errors.push("Final demo report has the wrong format.");
      }
      if (
        numberValue(report, "width") !== 1920 ||
        numberValue(report, "height") !== 1080 ||
        numberValue(report, "fps") !== 30
      ) {
        errors.push("Final demo must be 1920x1080 at 30 fps.");
      }
      const duration = numberValue(report, "durationSeconds");
      if (duration === null || duration <= 0 || duration > 180) {
        errors.push("Final demo duration must be greater than zero and at most 180 seconds.");
      }
      if (stringValue(report, "videoCodec") !== "h264") errors.push("Final demo must use H.264.");
      if (stringValue(report, "audioCodec") !== "aac") errors.push("Final demo must use AAC.");
      await count(demoPath, numberValue(report, "bytes"), stringValue(report, "sha256"));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const reports: Array<[string, (value: JsonRecord) => boolean, string]> = [
    [
      "artifacts/verification/2026-07-15-pitchflow/gpt-5.6-sol-generation.json",
      (value) =>
        value.status === "ok" &&
        value.model === "gpt-5.6-sol" &&
        value.provider === "codex-sdk" &&
        isRecord(value.codex) &&
        value.codex.authenticated === true &&
        value.codex.credentialValuesRead === false &&
        value.credentialValuesPrinted === false,
      "Real GPT-5.6 Sol report is incomplete.",
    ],
    [
      "artifacts/verification/2026-07-15-pitchflow/evidence-link-audit.json",
      (value) => value.status === "ok" && value.valid === true && value.checkedClaims === 8,
      "Evidence-link audit is incomplete.",
    ],
    [
      "artifacts/verification/2026-07-15-pitchflow/dependency-audit.json",
      (value) =>
        value.status === "ok" && Array.isArray(value.findings) && value.findings.length === 0,
      "Dependency audit is incomplete.",
    ],
    [
      "artifacts/verification/2026-07-15-pitchflow/public-url-verification.json",
      (value) =>
        value.status === "ok" &&
        value.url === "https://pitchflow-ten.vercel.app" &&
        Array.isArray(value.assets) &&
        value.assets.length === 25 &&
        isRecord(value.publicStatus) &&
        value.publicStatus.generationEnabled === false,
      "Public URL verification is incomplete.",
    ],
  ];
  for (const [path, predicate, message] of reports) {
    try {
      const report = await jsonFile(root, path);
      checkedFiles += 1;
      if (!predicate(report)) errors.push(message);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const youtubeUrl = stringValue(demo, "youtubeUrl");
  if (
    booleanValue(demo, "published") !== true ||
    !validUrl(youtubeUrl, new Set(["youtube.com", "www.youtube.com", "youtu.be"]))
  ) {
    gates.push("Public YouTube demo is not yet approved, published, and read back.");
  }
  const feedback = nested(status, "feedback", errors);
  const sessionId = stringValue(feedback, "primarySessionId");
  if (!sessionId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(sessionId)) {
    gates.push("Primary task /feedback Session ID is not yet recorded.");
  }
  const devpost = nested(status, "devpost", errors);
  if (
    booleanValue(devpost, "fieldsEdited") !== true ||
    booleanValue(devpost, "submitted") !== true ||
    !validUrl(stringValue(devpost, "submissionUrl"), new Set(["devpost.com", "www.devpost.com"]))
  ) {
    gates.push("Devpost fields and final submission are not yet approved and read back.");
  }

  if (!options.allowGates && gates.length > 0) errors.push(...gates);
  return {
    status: errors.length > 0 ? "failed" : gates.length > 0 ? "gated" : "ok",
    checkedFiles,
    gates,
    errors,
  };
}
