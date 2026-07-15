# Provenance

Last updated: 2026-07-15

## Original implementation

All PitchFlow application source, schemas, prompts, visual templates, documentation, and generated dogfood material in this repository are being created from scratch during the OpenAI Build Week submission period beginning 2026-07-13 09:00 PT.

The earlier `https://github.com/alemicali/cursor_meetup` repository is acknowledged as product-concept research only. It has multiple contributors and predates the event. No code, assets, prompts, or Git history from it have been copied, adapted, or imported into this repository.

## Third-party software

PitchFlow uses ordinary package-manager dependencies under their published open-source licenses. The lockfile and generated license inventory are the exact dependency record. Important direct dependencies initially include:

- Next.js and React for the workspace/viewer;
- Zod for runtime schemas;
- the official OpenAI Codex TypeScript SDK for local authenticated orchestration;
- Remotion for deterministic motion rendering;
- Vitest, ESLint, Prettier, and TypeScript for verification and development.

No third-party application source is vendored.

### Remotion license

Remotion is required by the Build Week product specification and uses its published custom Remotion License rather than a standard OSI identifier. The [current official Remotion pricing/license page](https://www.remotion.dev/) states that individuals and teams of up to three may use it free, including commercially, without sign-up. PitchFlow is an individual entrant project within that free-license scope. The platform-specific `@remotion/compositor-*` binary package omits a separate npm `license` field; the generated inventory records it as the compositor binary distributed with the same Remotion toolchain. If the project moves to a larger company/team or a different automated-rendering use, the license must be re-evaluated before use.

## Creative assets

No third-party logos, music, voices, product screenshots, stock media, or generated images are present at foundation time. Every later creative asset must be added to the ledger below before public use.

| Asset                           | Source/owner                                                                        | License or permission                                 | Introduced | Use/transformation                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PitchFlow wordmark and UI       | New work owned by the entrant                                                       | Original                                              | 2026-07-15 | Product and dogfood demo                                                                                                                                                                    |
| PitchFlow evidence capture      | Real local PitchFlow workspace; Nicco                                               | Entrant-owned original                                | 2026-07-15 | Creator-owned 1600x1000 browser capture of the public repository, pinned commit, and bounded evidence; SHA-256 `32cc05f90f8e8e599db8af999912d05fa99304bbde3cd8027efb5433380880a7`           |
| PitchFlow campaign capture      | Real local PitchFlow workspace; Nicco                                               | Entrant-owned original                                | 2026-07-15 | Creator-owned 1600x1000 browser capture of the GPT-5.6 Sol campaign preview and evidence-linked claims; SHA-256 `dc2ea2ea85d112bf49ac901aa47ab48b2ab42346a8f7b63fedb5b1f06464a3b2`          |
| PitchFlow copy capture          | Real local PitchFlow workspace; Nicco                                               | Entrant-owned original                                | 2026-07-15 | Creator-owned 1600x1000 browser capture of the cross-channel copy workspace; SHA-256 `8933f20014ff072777d10eb57437d99638cf622a34a22ca370d75daec6f14e7e`                                     |
| PitchFlow export capture        | Real local PitchFlow workspace; Nicco                                               | Entrant-owned original                                | 2026-07-15 | Creator-owned 1600x1000 browser capture of the verified 23-asset handoff, checksum index, both masters, and ZIP; SHA-256 `99560315c64fe328144d97d8623dae97ff7562e5a9cdfb3af6973882363d7ae7` |
| VibePalette success UI capture  | `sickn33/VibePalette` `.agent/ui-checks/vibepalette-perfection-success.png`; Nicco  | Entrant-owned; VibePalette repository is MIT licensed | 2026-07-15 | Real 800x1440 local product capture for the repaired engineering promo; SHA-256 `ea4704a2061a5f35db742e8156c0983e83fc1c1f823e1bffeecc6bbde8a60dab`                                          |
| VibePalette settings UI capture | `sickn33/VibePalette` `.agent/ui-checks/vibepalette-perfection-settings.png`; Nicco | Entrant-owned; VibePalette repository is MIT licensed | 2026-07-15 | Real 800x1440 local settings capture showing 5–10 colors, HEX/RGB/HSL, PNG/CSS/JSON, and theme controls; SHA-256 `68c0f8636327140406631d836ec10c9455ccc38ae074252efcad75af6312953b`         |

The PitchFlow captures were produced by a deterministic browser harness against the real loopback workspace after loading the verified public-repository snapshot and authenticated GPT-5.6 Sol manifest. The export-handoff fixture injects only receipt headers derived from the already rendered and verified 23-asset bundle; the visible interface is the real product, not generated UI art.

The VibePalette captures were visually inspected against the local extension repository and its `manifest.json` version 2.0.1. They are not synthetic UI and are not material from the prohibited `cursor_meetup` research repository. They remain failed/engineering evidence only and are not included in the immutable public PitchFlow judge package.
