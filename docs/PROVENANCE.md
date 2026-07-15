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

| Asset                           | Source/owner                                                                        | License or permission                                 | Introduced | Use/transformation                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PitchFlow wordmark and UI       | New work owned by the entrant                                                       | Original                                              | 2026-07-15 | Product and dogfood demo                                                                                                                                                            |
| VibePalette success UI capture  | `sickn33/VibePalette` `.agent/ui-checks/vibepalette-perfection-success.png`; Nicco  | Entrant-owned; VibePalette repository is MIT licensed | 2026-07-15 | Real 800x1440 local product capture for the repaired engineering promo; SHA-256 `ea4704a2061a5f35db742e8156c0983e83fc1c1f823e1bffeecc6bbde8a60dab`                                  |
| VibePalette settings UI capture | `sickn33/VibePalette` `.agent/ui-checks/vibepalette-perfection-settings.png`; Nicco | Entrant-owned; VibePalette repository is MIT licensed | 2026-07-15 | Real 800x1440 local settings capture showing 5–10 colors, HEX/RGB/HSL, PNG/CSS/JSON, and theme controls; SHA-256 `68c0f8636327140406631d836ec10c9455ccc38ae074252efcad75af6312953b` |

The VibePalette captures were visually inspected against the local extension repository and its `manifest.json` version 2.0.1. They are not synthetic UI and are not material from the prohibited `cursor_meetup` research repository. They may support the repaired VibePalette engineering proof; the final immutable public judge package will use newly captured PitchFlow UI because PitchFlow is the required self-dogfood subject.
