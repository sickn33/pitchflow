# PitchFlow Worklog

This file is append-only in spirit: preserve prior attempts, including failures. All times use Europe/Rome unless stated otherwise.

## 2026-07-15 — activation grounding

### Observations

- Read the complete Ultragoal skill, `PITCHFLOW_ULTRAGOAL.md`, and `PITCHFLOW_PREFLIGHT.md` before repository creation.
- Re-read the live official Build Week rules, FAQ, resources, and updates.
- Confirmed official submission deadline: 2026-07-21 17:00 PT / 2026-07-22 02:00 Europe/Rome.
- Confirmed required material use of Codex and GPT-5.6, Developer Tools testing instructions, public English YouTube demo <= 3 minutes with audio, repository URL, and primary `/feedback` Session ID.
- Confirmed `/Users/nicco/Projects/Playground/pitchflow-build-week` and `sickn33/pitchflow` were both unused before creation.
- Created a new empty Git repository on branch `main`. No old repository was cloned or inspected for implementation details.
- Live-authenticated GitHub and Vercel accounts both resolve to `sickn33`.
- Inspected only Codex auth file metadata and top-level key names. No credential values were printed or copied.
- Reproduced the global Codex CLI missing-native-binary `ENOENT`; recorded a project-local SDK architecture.

### Decisions

- Category: Developer Tools.
- Architecture: pnpm TypeScript workspace with Next.js workspace/viewer, Zod core, local Codex SDK adapter pinned to GPT-5.6, Remotion renderer, and thin CLI.
- Public viewer is cached and immutable; authenticated generation remains local.
- Native rendering is primary. Docker remains optional and will be introduced only if an actual verifier requires it.
- No Platform API adapter will be enabled.
- No subagents will be used without explicit authorization.

### Red-team result

The finish line was tested against static-demo substitution, decorative evidence, fake media files, dead downloads, misleading one-command claims, credential leakage, concealed prior work, skipped suites, screenshot-only polish, and decorative GPT-5.6 use. Each has an independent verifier in `GOAL.md`.

### Current state

- Durable goal packet: activated with the exact objective in `GOAL.md` and no token budget.
- Implementation: not started.
- Next action: build and independently verify the clean foundation.

### Activation

- Active goal thread: `019f63f6-0b11-7310-a7c1-d62b3a51e774`.
- Exact objective: `Complete and verify the PitchFlow OpenAI Build Week product defined in /Users/nicco/Projects/Playground/pitchflow-build-week/GOAL.md, including a working public judge path, evidence-grounded GPT-5.6 generation, exportable site/social/video/copy assets, clean-state tests, and the complete submission evidence packet.`
- Token budget: none set.

## 2026-07-15 — foundation verifier loop

- First dependency install populated the pnpm store but had not finished linking when the verifier ran; observed `prettier: command not found`. Waited for the still-running installer instead of starting overlapping work. Lockfile and executables then appeared normally.
- First linked `pnpm check:all` failed in ESLint because TypeScript 7.0.2 is ahead of `typescript-eslint` 8.54.0 support (`Cannot read properties of undefined (reading 'Cjs')`). This is an ecosystem compatibility failure, not a product failure.
- Repair: pin TypeScript 5.9.3, the current supported stable line for the selected lint stack, then rerun the complete verifier.
- Second verifier reached ESLint but the typed rules were incorrectly applied to the JavaScript flat config itself. Repair: explicitly disable type-aware TypeScript rules for JavaScript configuration files while keeping them mandatory for all project TypeScript.
- Third full verifier passed formatting, strict typed lint, TypeScript, the intentionally empty baseline test suite, and the Next.js production build. Next.js emitted a workspace-root inference warning because an unrelated lockfile exists in the user home directory; repair before the foundation commit by pinning Turbopack's root to this repository.
- The post-build rerun exposed that root-only ESLint ignore globs did not exclude `apps/web/.next`. Repair: use workspace-recursive ignores; generated output remains outside lint scope while source checks stay unchanged.
- The official SDK's transitive native binary exists and runs as `codex-cli 0.144.4`, but `pnpm exec codex` initially fell through to the broken global shim because the CLI was only transitive. Repair: pin `@openai/codex` as a direct dependency of the local adapter so all documented smoke commands resolve the repository-owned binary.
- Foundation gate passed: `pnpm --filter @pitchflow/codex exec codex --version` reports `codex-cli 0.144.4`; `pnpm check:all` passes formatting, typed lint, strict typecheck, baseline tests, and production build with no Next.js workspace warning; `git diff --check` passes.
- Next action: commit this dated, genuinely new skeleton before implementing product behavior.
