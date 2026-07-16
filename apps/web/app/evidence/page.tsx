import judgePackage from "../../public/dogfood/pitchflow/v1/judge-package.json";
import { parseDogfoodPackage, selectDogfoodGalleryAssets } from "../../lib/dogfood";
import type { ReactNode } from "react";

const evidence = parseDogfoodPackage(judgePackage);
const gallery = selectDogfoodGalleryAssets(evidence.assets);

const repositoryUrl = "https://github.com/sickn33/pitchflow";
const liveUrl = "https://pitchflow-ten.vercel.app";
const feedbackSessionId = "019f63f6-0b11-7310-a7c1-d62b3a51e774";
const freshRunPath =
  "artifacts/verification/2026-07-15-connected-engine/inspection-candidate-02-v2";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function EvidenceHeader() {
  return (
    <header className="evidence-header">
      <a className="evidence-brand" href="/" aria-label="PitchFlow home">
        <span aria-hidden="true">PF</span>
        <strong>PitchFlow</strong>
      </a>
      <nav aria-label="Evidence sections">
        <a href="#product-proof">Product</a>
        <a href="#codex-gpt">Codex &amp; GPT‑5.6</a>
        <a href="#trust-provenance">Trust</a>
        <a href="#verification">Verification</a>
      </nav>
      <a className="evidence-workspace-link" href="/">
        Open product <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}

function WhyItMatters({ children }: { children: ReactNode }) {
  return (
    <aside className="evidence-why">
      <strong>Why this matters</strong>
      <p>{children}</p>
    </aside>
  );
}

export default function EvidencePage() {
  return (
    <main className="evidence-page" id="main-content">
      <a className="skip-link" href="#evidence-overview">
        Skip to evidence overview
      </a>
      <EvidenceHeader />

      <section
        className="evidence-overview"
        id="evidence-overview"
        aria-labelledby="evidence-title"
      >
        <div>
          <p className="evidence-eyebrow">Build evidence · readable first, complete underneath</p>
          <h1 id="evidence-title">See what is real and how it was proved.</h1>
          <p className="evidence-purpose">
            This page shows what is real, how Codex/GPT-5.6 was used, and how the outputs were
            verified.
          </p>
          <p className="evidence-summary">
            PitchFlow turns a public GitHub repository and creator-owned product screenshots into a
            website, social images, two product videos, channel copy, and a downloadable package.
          </p>
        </div>
        <dl className="evidence-key-numbers" aria-label="PitchFlow proof summary">
          <div>
            <dt>{evidence.assets.length}</dt>
            <dd>verified files in the public demo</dd>
          </div>
          <div>
            <dt>{evidence.snapshot.evidence.length}</dt>
            <dd>repository evidence records</dd>
          </div>
          <div>
            <dt>2</dt>
            <dd>decoded H.264 product videos</dd>
          </div>
          <div>
            <dt>0</dt>
            <dd>credentials sent to the hosted app</dd>
          </div>
        </dl>
      </section>

      <section className="evidence-judge-path" aria-labelledby="judge-path-title">
        <div className="evidence-section-kicker">3-minute judge path</div>
        <h2 id="judge-path-title">Verify the product without reading the whole ledger.</h2>
        <ol>
          <li>
            <span>01 · 45 seconds</span>
            <strong>Open the product and explore the read-only PitchFlow demo.</strong>
            <a href={liveUrl}>Live product ↗</a>
          </li>
          <li>
            <span>02 · 75 seconds</span>
            <strong>Inspect Website, Images, Videos, Copy, and the real ZIP.</strong>
            <a href={gallery.archive?.href ?? "/dogfood/pitchflow/v1/pitchflow-campaign.zip"}>
              Download package ↘
            </a>
          </li>
          <li>
            <span>03 · 60 seconds</span>
            <strong>Confirm the fresh VibePalette run, local credentials, and verification.</strong>
            <a href={`${repositoryUrl}/tree/main/${freshRunPath}`}>Fresh-run evidence ↗</a>
          </li>
        </ol>
      </section>

      <nav className="evidence-section-nav" aria-label="Proof page outline">
        <a href="#product-proof">01 Product proof</a>
        <a href="#codex-gpt">02 Codex &amp; GPT‑5.6</a>
        <a href="#trust-provenance">03 Trust &amp; provenance</a>
        <a href="#verification">04 Verification</a>
      </nav>

      <div className="evidence-sections">
        <section
          className="evidence-section"
          id="product-proof"
          aria-labelledby="product-proof-title"
        >
          <div className="evidence-section-heading">
            <p className="evidence-section-kicker">01 · Product proof</p>
            <h2 id="product-proof-title">
              The public demo and fresh-repository path are both real.
            </h2>
            <p>
              The deployed workspace exposes the complete PitchFlow dogfood project immediately. The
              local companion generated a separate VibePalette campaign with repository-specific
              website, images, carousel, two videos, copy, manifest, and ZIP—without relabeling
              PitchFlow assets.
            </p>
          </div>
          <div className="evidence-proof-grid">
            <figure>
              <img
                src={gallery.socialGraphics[0]?.href}
                width="1200"
                height="630"
                alt="A real generated PitchFlow social image from the immutable public package"
              />
              <figcaption>
                Real generated social output, served from the immutable package.
              </figcaption>
            </figure>
            <div className="evidence-conclusions">
              <strong>What you can verify</strong>
              <ul>
                <li>One product UI for the hosted demo and local generation workflow.</li>
                <li>Five result areas: Website, Images, Videos, Copy, and Export.</li>
                <li>Four social graphics, five carousel slides, and two motion formats.</li>
                <li>A ZIP whose files belong to the current repository campaign.</li>
              </ul>
              <a href="/">Explore the product demo →</a>
            </div>
          </div>
          <WhyItMatters>
            A polished mock can hide a missing product. These links expose the running workflow and
            downloadable bytes a judge can inspect independently.
          </WhyItMatters>
        </section>

        <section className="evidence-section" id="codex-gpt" aria-labelledby="codex-gpt-title">
          <div className="evidence-section-heading">
            <p className="evidence-section-kicker">02 · Codex &amp; GPT‑5.6</p>
            <h2 id="codex-gpt-title">
              GPT‑5.6 directed the campaign; Codex built and ran the studio.
            </h2>
            <p>
              GPT‑5.6 Sol received the pinned repository evidence and produced schema-validated,
              evidence-linked positioning, claims, scenes, and channel copy. Codex implemented the
              product, secure loopback bridge, renderer integration, tests, repair loops, and the
              real generation workflow using the developer&apos;s authenticated local entitlement.
            </p>
          </div>
          <dl className="evidence-facts">
            <div>
              <dt>Material model</dt>
              <dd>{evidence.campaign.generation.model}</dd>
            </div>
            <div>
              <dt>Execution path</dt>
              <dd>{evidence.campaign.generation.provider} through local Codex</dd>
            </div>
            <div>
              <dt>Primary Codex Session ID</dt>
              <dd>
                <code>{feedbackSessionId}</code>
              </dd>
            </div>
            <div>
              <dt>Model responsibility</dt>
              <dd>Creative direction, claims, scenes, and copy—not decorative name-dropping.</dd>
            </div>
          </dl>
          <WhyItMatters>
            Build Week requires material Codex and GPT‑5.6 use. The model record, prompt contract,
            evidence links, and primary session identify where that work actually happened.
          </WhyItMatters>
        </section>

        <section
          className="evidence-section"
          id="trust-provenance"
          aria-labelledby="trust-provenance-title"
        >
          <div className="evidence-section-heading">
            <p className="evidence-section-kicker">03 · Trust &amp; provenance</p>
            <h2 id="trust-provenance-title">
              The product shows real UI and keeps provider authority local.
            </h2>
            <p>
              Every product capture in the public campaign is creator-owned and recorded with its
              provenance. The renderer uses those captures as visual truth. The hosted Vercel app
              contains no personal Codex session, cannot spend Nicco&apos;s Platform account, and
              falls back honestly to the loopback workspace when browser policy blocks a direct
              bridge.
            </p>
          </div>
          <dl className="evidence-facts">
            <div>
              <dt>Pinned repository commit</dt>
              <dd>
                <code>{evidence.snapshot.commitSha}</code>
              </dd>
            </div>
            <div>
              <dt>Real product captures</dt>
              <dd>{gallery.productCaptures.length} creator-owned PitchFlow screens</dd>
            </div>
            <div>
              <dt>Hosted credentials</dt>
              <dd>None. Provider credentials remain on the user&apos;s machine.</dd>
            </div>
            <div>
              <dt>Fake product UI</dt>
              <dd>None. Supporting visuals never impersonate product screens.</dd>
            </div>
          </dl>
          <WhyItMatters>
            The visible campaign must substantiate its claims without leaking developer authority or
            presenting invented UI as proof.
          </WhyItMatters>
        </section>

        <section
          className="evidence-section"
          id="verification"
          aria-labelledby="verification-title"
        >
          <div className="evidence-section-heading">
            <p className="evidence-section-kicker">04 · Verification</p>
            <h2 id="verification-title">
              The judge path is tested as a product, not accepted from metadata.
            </h2>
            <p>
              Browser checks exercise desktop and 390px layouts, the repository wizard, honest
              disconnected fallback, read-only demo ownership, every results tab, and ZIP download.
              Media checks decode and sample visible pixels after paint. Security checks cover
              pairing expiry and replay, exact origins, redaction, result isolation, and secret
              scans.
            </p>
          </div>
          <div className="evidence-verification-grid">
            <div>
              <strong>13</strong>
              <span>image previews decoded and pixel-sampled</span>
            </div>
            <div>
              <strong>2</strong>
              <span>36-second videos decoded in both ratios</span>
            </div>
            <div>
              <strong>84</strong>
              <span>core and integration tests in the accepted baseline</span>
            </div>
            <div>
              <strong>0</strong>
              <span>production dependency or secret-scan findings</span>
            </div>
          </div>
          <WhyItMatters>
            File names and hashes can describe broken output. The acceptance gate also verifies the
            rendered pixels, browser behavior, accessibility, downloads, and security boundary.
          </WhyItMatters>
        </section>
      </div>

      <section className="evidence-raw" aria-labelledby="raw-evidence-title">
        <div>
          <p className="evidence-section-kicker">Complete traceability</p>
          <h2 id="raw-evidence-title">Raw evidence</h2>
          <p>Detailed receipts stay available for audit, but collapsed until you need them.</p>
        </div>

        <details>
          <summary>Repository, generation, and session receipts</summary>
          <dl className="evidence-raw-list">
            <div>
              <dt>Repository</dt>
              <dd>
                <a href={repositoryUrl}>{repositoryUrl}</a>
              </dd>
            </div>
            <div>
              <dt>Snapshot ID</dt>
              <dd>
                <code>{evidence.snapshot.id}</code>
              </dd>
            </div>
            <div>
              <dt>Commit SHA</dt>
              <dd>
                <code>{evidence.snapshot.commitSha}</code>
              </dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>
                <code>{evidence.campaign.generation.model}</code>
              </dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>
                <code>{evidence.campaign.generation.provider}</code>
              </dd>
            </div>
            <div>
              <dt>Prompt version</dt>
              <dd>
                <code>{evidence.campaign.generation.promptVersion}</code>
              </dd>
            </div>
            <div>
              <dt>Codex Session ID</dt>
              <dd>
                <code>{feedbackSessionId}</code>
              </dd>
            </div>
          </dl>
        </details>

        <details>
          <summary>{evidence.snapshot.evidence.length} repository evidence records</summary>
          <ol className="evidence-raw-records">
            {evidence.snapshot.evidence.map((record) => (
              <li key={record.id} id={`evidence-${record.id}`}>
                <strong>{record.path}</strong>
                <code>{record.id}</code>
                <p>{record.excerpt}</p>
              </li>
            ))}
          </ol>
        </details>

        <details data-testid="raw-asset-inventory">
          <summary>{evidence.assets.length} immutable package files</summary>
          <div
            className="evidence-asset-table"
            role="region"
            aria-label="Immutable asset inventory"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Bytes</th>
                  <th>SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {evidence.assets.map((asset) => (
                  <tr key={asset.href}>
                    <td>
                      <a href={asset.href}>{asset.label}</a>
                    </td>
                    <td>{asset.mediaType}</td>
                    <td>{formatBytes(asset.bytes)}</td>
                    <td>
                      <code>{asset.sha256}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details>
          <summary>Durable build and verification records</summary>
          <ul className="evidence-record-links">
            <li>
              <a href={`${repositoryUrl}/blob/main/GOAL.md`}>
                GOAL.md — finish line and approval gates
              </a>
            </li>
            <li>
              <a href={`${repositoryUrl}/blob/main/WORKLOG.md`}>
                WORKLOG.md — attempts, failures, and repairs
              </a>
            </li>
            <li>
              <a href={`${repositoryUrl}/blob/main/RESULT.md`}>
                RESULT.md — current verified state
              </a>
            </li>
            <li>
              <a href={`${repositoryUrl}/blob/main/docs/PROVENANCE.md`}>
                PROVENANCE.md — ownership and licensing
              </a>
            </li>
            <li>
              <a href={`${repositoryUrl}/tree/main/artifacts/verification`}>
                Verification artifacts and browser evidence
              </a>
            </li>
          </ul>
        </details>
      </section>

      <footer className="evidence-footer">
        <a href="/">Return to the PitchFlow workspace</a>
        <span>Conclusions first. Receipts when needed.</span>
      </footer>
    </main>
  );
}
