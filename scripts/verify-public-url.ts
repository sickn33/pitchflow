import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import { DOGFOOD_PACKAGE_URL, parseDogfoodPackage } from "../apps/web/lib/dogfood";
import { argumentValue, requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const baseUrl = new URL(requiredArgument("url"));
const reportArgument = argumentValue("report");

if (
  baseUrl.protocol !== "https:" ||
  baseUrl.username ||
  baseUrl.password ||
  baseUrl.search ||
  baseUrl.hash ||
  (baseUrl.pathname !== "/" && baseUrl.pathname !== "")
) {
  throw new Error("Public verification requires a credential-free HTTPS origin URL.");
}

function publicUrl(path: string): URL {
  return new URL(path, baseUrl);
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function successfulBody(response: Response, label: string): Promise<Buffer> {
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const rootResponse = await fetch(baseUrl, {
  cache: "no-store",
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
const rootHtml = (await successfulBody(rootResponse, "Public product workspace")).toString("utf8");
const productSignals = [
  "PitchFlow",
  "Paste your repo. Get a launch-ready site, social kit, and product video.",
  "Analyze",
  "Direct",
  "Generate",
  "Deliver",
  "Export",
];
for (const signal of productSignals) {
  if (!rootHtml.includes(signal)) {
    throw new Error(`Public root is missing the product-first signal: ${signal}`);
  }
}
if (rootHtml.includes("Cached judge viewer")) {
  throw new Error("Public root regressed to the rejected audit-first viewer language.");
}

const evidenceResponse = await fetch(publicUrl("/evidence"), {
  cache: "no-store",
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
const evidenceHtml = (await successfulBody(evidenceResponse, "Secondary evidence route")).toString(
  "utf8",
);
if (!evidenceHtml.includes("Evidence") || !evidenceHtml.includes("Repo-native launch studio")) {
  throw new Error("The secondary evidence route does not expose PitchFlow proof material.");
}

const requiredSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;
for (const [name, expected] of Object.entries(requiredSecurityHeaders)) {
  if (rootResponse.headers.get(name) !== expected) {
    throw new Error(`Public root is missing required ${name}: ${expected}.`);
  }
}
if (!rootResponse.headers.get("permissions-policy")?.includes("microphone=()")) {
  throw new Error("Public root is missing the restrictive Permissions-Policy.");
}

const packageResponse = await fetch(publicUrl(DOGFOOD_PACKAGE_URL), {
  cache: "no-store",
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
const packageData = await successfulBody(packageResponse, "Judge package");
const dogfood = parseDogfoodPackage(JSON.parse(packageData.toString("utf8")));

const verifiedAssets: Array<{
  href: string;
  bytes: number;
  sha256: string;
  contentType: string | null;
  cacheControl: string | null;
}> = [];
for (const asset of dogfood.assets) {
  const response = await fetch(publicUrl(asset.href), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(180_000),
  });
  const data = await successfulBody(response, asset.href);
  if (data.byteLength !== asset.bytes || sha256(data) !== asset.sha256) {
    throw new Error(`Public asset bytes or SHA-256 do not match the package: ${asset.href}`);
  }
  const cacheControl = response.headers.get("cache-control");
  if (!cacheControl?.includes("max-age=31536000") || !cacheControl.includes("immutable")) {
    throw new Error(`Public asset is not served with immutable caching: ${asset.href}`);
  }
  verifiedAssets.push({
    href: asset.href,
    bytes: data.byteLength,
    sha256: sha256(data),
    contentType: response.headers.get("content-type"),
    cacheControl,
  });
}

const statusResponse = await fetch(publicUrl("/api/status"), {
  cache: "no-store",
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
if (!statusResponse.ok) throw new Error(`Public status returned HTTP ${statusResponse.status}.`);
const status: unknown = await statusResponse.json();
if (
  typeof status !== "object" ||
  status === null ||
  !("mode" in status) ||
  status.mode !== "public-viewer" ||
  !("generationEnabled" in status) ||
  status.generationEnabled !== false ||
  !("codex" in status) ||
  status.codex !== null
) {
  throw new Error("Public status exposes an unexpected generation or Codex capability.");
}

const deniedRoutes: Array<{ route: string; status: number; code: string }> = [];
for (const route of ["/api/analyze", "/api/generate", "/api/export"] as const) {
  const response = await fetch(publicUrl(route), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-valid-json",
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await response.json();
  const code =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "code" in body.error &&
    typeof body.error.code === "string"
      ? body.error.code
      : null;
  if (response.status !== 403 || code !== "PUBLIC_VIEWER_READ_ONLY") {
    throw new Error(`${route} did not fail closed before parsing the invalid request body.`);
  }
  deniedRoutes.push({ route, status: response.status, code });
}

const report = {
  status: "ok",
  verifiedAt: new Date().toISOString(),
  url: baseUrl.origin,
  repository: dogfood.snapshot.repository.canonicalUrl,
  commitSha: dogfood.snapshot.commitSha,
  campaignId: dogfood.campaign.id,
  generation: dogfood.campaign.generation,
  judgePackage: {
    bytes: packageData.byteLength,
    sha256: sha256(packageData),
  },
  assets: verifiedAssets,
  totalAssetBytes: verifiedAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  publicStatus: status,
  deniedRoutes,
  securityHeaders: {
    referrerPolicy: rootResponse.headers.get("referrer-policy"),
    xContentTypeOptions: rootResponse.headers.get("x-content-type-options"),
    xFrameOptions: rootResponse.headers.get("x-frame-options"),
    permissionsPolicy: rootResponse.headers.get("permissions-policy"),
  },
  productSignals,
  evidenceRoute: "/evidence",
  credentialValuesPrinted: false,
};

if (reportArgument) {
  const reportPath = resolve(reportArgument);
  if (!reportPath.startsWith(`${root}${sep}`)) {
    throw new Error("Public verification report must remain inside the PitchFlow repository.");
  }
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ ...report, report: relative(root, reportPath) }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}
