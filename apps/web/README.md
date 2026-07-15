# PitchFlow web surfaces

The same Next.js application has two deliberately separate modes:

- local workspace (default): repository analysis and Codex generation are available through local-only route handlers;
- public viewer (`PITCHFLOW_PUBLIC_VIEWER=1` or Vercel): the browser only loads checked-in cached files. Analysis and generation route handlers reject requests before touching GitHub or Codex.

## Cached dogfood contract

The public viewer requests exactly:

```text
/dogfood/pitchflow/v1/judge-package.json
```

The parent integration lane must place the JSON and every indexed asset under `apps/web/public/dogfood/pitchflow/v1/`. Missing, malformed, unpinned, empty, or cross-linked packages render a truthful unavailable state; the UI never substitutes sample output.

The package shape is:

```ts
type JudgePackage = {
  format: "pitchflow-judge-package";
  version: 1;
  snapshot: RepoSnapshot;
  campaign: CampaignManifest;
  assets: Array<{
    label: string;
    href: `/dogfood/pitchflow/v1/${string}`;
    mediaType: string;
    bytes: number;
    sha256: string; // lowercase, 64 hex characters
  }>;
};
```

The parser validates both core schemas and requires the campaign snapshot ID, repository URL, and commit SHA to match the cached repository snapshot. At least one real downloadable asset is required. Asset URLs must remain inside the versioned dogfood path and cannot contain traversal segments.

Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS viewer origin for production metadata. Vercel's `VERCEL_PROJECT_PRODUCTION_URL` is used as a fallback.

## Scoped verification

```bash
pnpm exec prettier --check apps/web
pnpm exec eslint apps/web --max-warnings=0
pnpm exec tsc --noEmit -p apps/web/tsconfig.json
pnpm --filter @pitchflow/web test
pnpm --filter @pitchflow/web build
```
