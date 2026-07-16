"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { CampaignManifest, CampaignPreferences, RepoSnapshot } from "@pitchflow/core";

import {
  DOGFOOD_PACKAGE_URL,
  getDogfoodImageDimensions,
  parseDogfoodPackage,
  selectDogfoodGalleryAssets,
  type DogfoodAsset,
  type DogfoodPackage,
} from "../lib/dogfood";
import {
  CAPTURE_PROVENANCE_LABELS,
  MAX_CAPTURE_BYTES,
  MAX_CAPTURE_COUNT,
  MAX_CAPTURE_DIMENSION,
  MAX_CAPTURE_PIXELS,
  MIN_CAPTURE_COUNT,
  MIN_CAPTURE_HEIGHT,
  MIN_CAPTURE_WIDTH,
  type CaptureProvenance,
  type CaptureUpload,
} from "../lib/capture-contract";
import {
  BRIDGE_ORIGIN,
  PUBLIC_PRODUCT_ORIGIN,
  PitchFlowBridgeClient,
  isAllowedPublicTransferOrigin,
  isCompanionTransferMessage,
  parseCompanionTransferMessage,
  type BridgeJob,
  type BridgeJobResult,
  type BridgeJobStage,
  type BridgeProjectState,
  type BridgeStatus,
  type PendingPairing,
} from "../lib/bridge-client";
import {
  approveCampaignClaim,
  canonicalGitHubRepositoryUrl,
  editCampaignClaim,
  evidenceAnchorId,
  pendingClaimCount,
} from "../lib/product-flow";

type RuntimeStatus = {
  mode: "local" | "public-viewer";
  generationEnabled: boolean;
  codex: null | {
    authenticated: boolean;
    method: "chatgpt" | "api-key" | "unknown";
    cliVersion: string | null;
    credentialValuesRead: false;
  };
};

type ApiFailure = { error?: { code?: string; message?: string } };
type Stage = "idle" | "analyzing" | "review" | "generating" | "ready";
type Panel = "website" | "images" | "videos" | "copy" | "export";
type ProductScreen = "entry" | "repository" | "direction" | "engine" | "generate" | "results";
type ResultOwnership = "demo" | "fresh" | null;
type RepositorySummary = {
  fullName: string;
  description: string;
  language: string | null;
  license: string | null;
};
type ExportReceipt = {
  filename: string;
  assetCount: number;
  sha256: string;
};
type CaptureDraft = Omit<CaptureUpload, "provenance"> & {
  provenance: CaptureProvenance | "";
  width: number;
  height: number;
  bytes: number;
};

type PairingUiState = "idle" | "requesting" | "pending" | "paired" | "expired" | "rejected";

const bridgeStageLabels: Record<BridgeJobStage, string> = {
  queued: "Queued on the local engine",
  fetching_evidence: "Fetching repository evidence",
  understanding_product: "Understanding the product",
  creative_direction: "Directing the campaign with GPT‑5.6",
  rendering_site_images_copy: "Rendering site, images, carousel, and copy",
  rendering_videos: "Rendering landscape and vertical videos",
  validating: "Validating evidence and outputs",
  packaging: "Packaging the complete launch kit",
  complete: "Complete launch package ready",
};

const panels: Panel[] = ["website", "images", "videos", "copy", "export"];
const panelLabels: Record<Panel, string> = {
  website: "Website",
  images: "Images",
  videos: "Videos",
  copy: "Copy",
  export: "Export",
};
const channelLabels: Record<CampaignPreferences["channels"][number], string> = {
  x: "X",
  linkedin: "LinkedIn",
  "product-hunt": "Product Hunt",
  email: "Email",
};

const defaultPreferences: CampaignPreferences = {
  audience: "Indie developers and open-source maintainers",
  positioning: "A developer tool with a concrete, evidence-backed reason to exist",
  visualDirection: "Editorial product clarity with confident motion and high-contrast type",
  tone: "precise",
  channels: ["x", "linkedin", "product-hunt", "email"],
};

async function parseApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiFailure;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? `PitchFlow request failed with HTTP ${response.status}.`,
    );
  }
  return payload;
}

function stageLabel(stage: Stage): string {
  return {
    idle: "Awaiting input",
    analyzing: "Pinning evidence",
    review: "Evidence ready",
    generating: "GPT-5.6 directing",
    ready: "Campaign ready",
  }[stage];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AppHeader({ evidence = false }: { evidence?: boolean }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <a className="brand" href={evidence ? "/" : "#top"} aria-label="PitchFlow home">
          <span className="brand-mark" aria-hidden="true">
            PF
          </span>
          <span>PitchFlow</span>
        </a>
        {evidence ? (
          <div className="mode-pill" data-mode="viewer">
            <span className="pulse" aria-hidden="true" />
            <span>Evidence</span>
          </div>
        ) : (
          <a className="run-locally" href="#generate">
            <span aria-hidden="true">&gt;_</span>
            Run locally
          </a>
        )}
      </header>
    </>
  );
}

function EvidenceHero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">Repo-native launch studio · OpenAI Build Week</p>
        <h1 id="hero-heading">
          Ship the code.
          <br />
          <span>PitchFlow ships the story.</span>
        </h1>
        <p className="lede">
          One public repository becomes a source-linked launch site, social system, motion promo,
          and channel-ready copy—directed by GPT‑5.6 inside your authenticated Codex workflow.
        </p>
      </div>
      <div className="proof-strip" aria-label="Product guarantees">
        <div>
          <strong>01</strong>
          <span>Commit pinned</span>
        </div>
        <div>
          <strong>02</strong>
          <span>Claims cited</span>
        </div>
        <div>
          <strong>03</strong>
          <span>Assets reproducible</span>
        </div>
      </div>
    </section>
  );
}

function ProductHero({
  repositoryUrl,
  busy,
  error,
  onRepositoryUrlChange,
  onAnalyze,
  onTryDemo,
}: {
  repositoryUrl: string;
  busy: boolean;
  error: string | null;
  onRepositoryUrlChange: (value: string) => void;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onTryDemo: () => void;
}) {
  return (
    <section className="pf-entry" id="top" aria-labelledby="hero-heading">
      <div className="pf-entry-copy">
        <p className="pf-entry-eyebrow">For developers and open-source maintainers</p>
        <h1 id="hero-heading">
          Turn a GitHub repository into a launch website, social images, product videos, and
          ready-to-post copy.
        </h1>
        <p className="pf-entry-truth">
          PitchFlow reads the repository, uses your product screenshots for visual truth, and runs
          GPT‑5.6 through your local Codex account. Your credentials stay on your machine.
        </p>
        <form className="pf-repo-form" onSubmit={onAnalyze} noValidate>
          <label htmlFor="repository-url">GitHub repository</label>
          <div className="pf-repo-control">
            <input
              id="repository-url"
              type="url"
              value={repositoryUrl}
              onChange={(event) => onRepositoryUrlChange(event.target.value)}
              placeholder="https://github.com/owner/repository"
              title="Enter a canonical public GitHub repository URL"
              required
              disabled={busy}
              autoComplete="url"
              aria-describedby={error ? "repository-error" : undefined}
            />
            <button type="submit" disabled={busy || !repositoryUrl.trim()}>
              {busy ? "Checking repository…" : "Create marketing assets"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {error ? (
            <p className="pf-field-error" id="repository-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <button className="pf-demo-action" type="button" onClick={onTryDemo} disabled={busy}>
          Explore the PitchFlow demo <span aria-hidden="true">↗</span>
        </button>
      </div>
      <ProductOutputs />
    </section>
  );
}

function ProductStepper({
  active,
  onNavigate,
}: {
  active: Exclude<ProductScreen, "entry" | "results">;
  onNavigate: (screen: Exclude<ProductScreen, "entry" | "results">) => void;
}) {
  const steps: Array<{ screen: Exclude<ProductScreen, "entry" | "results">; label: string }> = [
    { screen: "repository", label: "Repository" },
    { screen: "direction", label: "Direction" },
    { screen: "engine", label: "Engine" },
    { screen: "generate", label: "Generate" },
  ];
  const activeIndex = steps.findIndex((step) => step.screen === active);
  return (
    <nav className="pf-stepper" aria-label="New project steps">
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          return (
            <li
              key={step.screen}
              data-state={
                index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming"
              }
            >
              <button
                type="button"
                onClick={() => onNavigate(step.screen)}
                disabled={index > activeIndex}
                aria-current={index === activeIndex ? "step" : undefined}
              >
                <span>{number}</span>
                <strong>{step.label}</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ProductOutputs() {
  const outputs = ["Website", "Social images", "Product videos", "Copy", "ZIP"];
  return (
    <section className="pf-output-preview" aria-label="How PitchFlow creates marketing assets">
      <ol className="pf-product-chain">
        <li>
          <span>01 · Input</span>
          <strong>GitHub repository</strong>
          <p>Optional screenshots and creative direction</p>
        </li>
        <li>
          <span>02 · Process</span>
          <strong>GPT‑5.6 through local Codex</strong>
          <p>Repository evidence in. Credentials stay local.</p>
        </li>
        <li>
          <span>03 · Outputs</span>
          <strong>Five deliverables</strong>
          <ul aria-label="Generated deliverables">
            {outputs.map((output) => (
              <li key={output}>{output}</li>
            ))}
          </ul>
        </li>
      </ol>
    </section>
  );
}

function ProductAppHeader({ project, onExit }: { project?: string | null; onExit?: () => void }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="pf-header">
        <button className="pf-brand" type="button" onClick={onExit} aria-label="PitchFlow home">
          <span aria-hidden="true">PF</span>
          <strong>PitchFlow</strong>
        </button>
        {project ? <span className="pf-header-project">{project}</span> : null}
        {onExit ? (
          <button className="pf-header-action" type="button" onClick={onExit}>
            Exit project <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <a className="pf-header-action" href="/evidence">
            How it works <span aria-hidden="true">↗</span>
          </a>
        )}
      </header>
    </>
  );
}

function RepositoryStep({
  repositoryUrl,
  summary,
  snapshot,
  onBack,
  onContinue,
}: {
  repositoryUrl: string;
  summary: RepositorySummary | null;
  snapshot: RepoSnapshot | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const repositoryName = summary?.fullName ?? new URL(repositoryUrl).pathname.slice(1);
  const description =
    summary?.description ??
    snapshot?.repository.description ??
    "Public repository validated and ready for local evidence analysis.";
  const language = summary?.language ?? Object.keys(snapshot?.languages ?? {})[0] ?? null;
  const license = summary?.license ?? snapshot?.repository.licenseSpdx ?? null;
  return (
    <section className="pf-wizard-screen pf-repository-step" aria-labelledby="repository-heading">
      <div className="pf-screen-heading">
        <span>Repository</span>
        <h1 id="repository-heading">Repository ready.</h1>
        <p>Confirm the product before setting the launch direction.</p>
      </div>
      <div className="pf-repository-summary">
        <div>
          <span>GitHub repository</span>
          <strong>{repositoryName}</strong>
          <a href={repositoryUrl} target="_blank" rel="noreferrer">
            {repositoryUrl} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p>{description}</p>
        <dl>
          <div>
            <dt>Primary language</dt>
            <dd>{language ?? "Detected during analysis"}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{license ?? "Not declared"}</dd>
          </div>
          <div>
            <dt>Next</dt>
            <dd>Direction and real captures</dd>
          </div>
        </dl>
      </div>
      <div className="pf-action-row">
        <button className="pf-secondary-button" type="button" onClick={onBack}>
          Back
        </button>
        <button className="pf-primary-button" type="button" onClick={onContinue}>
          Continue to direction <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function Tabs({
  active,
  hasCampaign,
  onChange,
}: {
  active: Panel;
  hasCampaign: boolean;
  onChange: (panel: Panel) => void;
}) {
  const enabled = hasCampaign ? panels : (["website"] as Panel[]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = enabled.indexOf(active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
    const panel = enabled[next]!;
    onChange(panel);
    document.getElementById(`campaign-tab-${panel}`)?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label="Campaign views" onKeyDown={onKeyDown}>
      {enabled.map((panel) => (
        <button
          id={`campaign-tab-${panel}`}
          key={panel}
          type="button"
          role="tab"
          aria-controls={`campaign-panel-${panel}`}
          aria-selected={active === panel}
          tabIndex={active === panel ? 0 : -1}
          onClick={() => onChange(panel)}
        >
          {panelLabels[panel]}
        </button>
      ))}
    </div>
  );
}

function EvidencePanel({
  snapshot,
  selectedEvidenceId,
}: {
  snapshot: RepoSnapshot;
  selectedEvidenceId: string | null;
}) {
  return (
    <div className="evidence-view" aria-label="Repository evidence records" tabIndex={0}>
      <div className="canvas-title">
        <div>
          <p className="kicker">Pinned evidence</p>
          <h3>{snapshot.repository.name}</h3>
          <p className="canvas-summary">
            {snapshot.evidence.length} source records · {snapshot.limits.includedFiles} bounded
            files · no code executed
          </p>
        </div>
        <a
          className="commit-link"
          href={snapshot.repository.canonicalUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>Commit</span>
          <code>{snapshot.commitSha}</code>
        </a>
      </div>
      <div className="evidence-grid">
        {snapshot.evidence.map((item) => (
          <article
            className="evidence-card"
            data-selected={selectedEvidenceId === item.id}
            id={evidenceAnchorId(item.id)}
            key={item.id}
            tabIndex={-1}
          >
            <div className="evidence-meta">
              <span>{item.kind.replaceAll("_", " ")}</span>
              <code>{item.id}</code>
            </div>
            <h4>{item.label}</h4>
            <p>{item.excerpt}</p>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              Open source <span aria-hidden="true">↗</span>
              <span className="sr-only"> in a new tab</span>
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function PreviewPanel({
  campaign,
  editable,
  onRevealEvidence,
  onClaimChange,
  onApproveClaim,
}: {
  campaign: CampaignManifest;
  editable: boolean;
  onRevealEvidence: (id: string) => void;
  onClaimChange?: (claimId: string, text: string) => void;
  onApproveClaim?: (claimId: string) => void;
}) {
  return (
    <article
      className="site-preview"
      aria-label="Evidence-linked campaign preview"
      tabIndex={0}
      style={
        {
          "--campaign-accent": campaign.design.accent,
          "--campaign-bg": campaign.design.background,
          "--campaign-text": campaign.design.text,
          "--campaign-radius": `${campaign.design.radius}px`,
        } as CSSProperties
      }
    >
      <div className="preview-hero">
        <span>Generated from {campaign.source.commitSha.slice(0, 7)}</span>
        <h3>{campaign.productBrief.oneLiner}</h3>
        <p>{campaign.productBrief.positioning}</p>
      </div>
      <section className="preview-problem" aria-labelledby="preview-problem-heading">
        <p className="preview-label">The problem</p>
        <h4 id="preview-problem-heading">{campaign.productBrief.problem}</h4>
      </section>
      <div className="claim-list" aria-label="Evidence-backed claims">
        {campaign.claims.map((claim) => (
          <article key={claim.id}>
            <div className="claim-heading">
              <span>{claim.classification.replace("_", " ")}</span>
              <span>
                {claim.approvalRequired
                  ? "Approval required"
                  : `${Math.round(claim.confidence * 100)}% confidence`}
              </span>
            </div>
            {editable ? (
              <textarea
                className="claim-editor"
                aria-label={`Edit claim ${claim.id}`}
                maxLength={240}
                rows={5}
                value={claim.text}
                onChange={(event) => onClaimChange?.(claim.id, event.target.value)}
              />
            ) : (
              <h4>{claim.text}</h4>
            )}
            <p>{claim.rationale}</p>
            {editable && claim.approvalRequired ? (
              <button
                className="claim-approval"
                type="button"
                onClick={() => onApproveClaim?.(claim.id)}
              >
                Approve as user-supplied claim
              </button>
            ) : null}
            <div className="evidence-actions" aria-label={`Evidence for ${claim.text}`}>
              {claim.evidenceIds.map((id) => (
                <button type="button" key={id} onClick={() => onRevealEvidence(id)}>
                  {id} <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="section-list" aria-label="Generated microsite sections">
        {campaign.sections.map((section, index) => (
          <section key={section.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              {section.eyebrow ? <p>{section.eyebrow}</p> : null}
              <h4>{section.heading}</h4>
              <p>{section.body}</p>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

type CopyField = "x" | "linkedIn" | "productHuntDescription" | "emailBody";

function CopyPanel({
  campaign,
  editable,
  onChange,
}: {
  campaign: CampaignManifest;
  editable: boolean;
  onChange?: (field: CopyField, value: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopyError("Clipboard access was denied. Select the text and copy it manually.");
    }
  }

  const cards: Array<{ label: string; heading?: string; field: CopyField; value: string }> = [
    { label: "X", field: "x", value: campaign.copy.x },
    { label: "LinkedIn", field: "linkedIn", value: campaign.copy.linkedIn },
    {
      label: "Product Hunt",
      heading: campaign.copy.productHunt.tagline,
      field: "productHuntDescription",
      value: campaign.copy.productHunt.description,
    },
    {
      label: "Email",
      heading: campaign.copy.email.subject,
      field: "emailBody",
      value: campaign.copy.email.body,
    },
  ];

  return (
    <div
      className="copy-view"
      id="campaign-panel-copy"
      role="tabpanel"
      aria-labelledby="campaign-tab-copy"
      tabIndex={0}
    >
      <div className="copy-intro">
        <div>
          <p className="kicker">Channel-ready copy</p>
          <h3>{editable ? "Review, refine, copy." : "Inspect the launch voice."}</h3>
        </div>
        <p>
          {editable
            ? "Edits stay in this local workspace until the package is exported."
            : "This is the immutable dogfood output."}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? `${copied} copied to clipboard.` : copyError}
      </p>
      {copyError ? <ErrorBanner message={copyError} onDismiss={() => setCopyError(null)} /> : null}
      <div className="copy-grid">
        {cards.map((card) => (
          <article key={card.label}>
            <header>
              <span>{card.label}</span>
              <button type="button" onClick={() => void copy(card.label, card.value)}>
                {copied === card.label ? "Copied" : "Copy"}
              </button>
            </header>
            {card.heading ? <h4>{card.heading}</h4> : null}
            {editable ? (
              <textarea
                aria-label={`${card.label} copy`}
                value={card.value}
                maxLength={
                  card.field === "x"
                    ? 1200
                    : card.field === "linkedIn"
                      ? 3000
                      : card.field === "productHuntDescription"
                        ? 1200
                        : 1600
                }
                rows={Math.min(14, Math.max(7, Math.ceil(card.value.length / 58)))}
                onChange={(event) => onChange?.(card.field, event.target.value)}
              />
            ) : (
              <pre>{card.value}</pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function WebsitePanel({
  campaign,
  assets,
}: {
  campaign: CampaignManifest;
  assets: DogfoodAsset[];
}) {
  const microsite = selectDogfoodGalleryAssets(assets).microsite;
  return (
    <article
      className="product-website-preview"
      id="campaign-panel-website"
      role="tabpanel"
      aria-labelledby="campaign-tab-website"
      tabIndex={0}
      style={
        {
          "--campaign-accent": campaign.design.accent,
          "--campaign-bg": campaign.design.background,
          "--campaign-text": campaign.design.text,
          "--campaign-radius": `${campaign.design.radius}px`,
        } as CSSProperties
      }
    >
      <header>
        <div>
          <span>{campaign.productBrief.productName}</span>
          <h3>{campaign.productBrief.oneLiner}</h3>
          <p>{campaign.productBrief.positioning}</p>
        </div>
        {microsite ? (
          <a href={microsite.href} target="_blank" rel="noreferrer">
            Open full website
          </a>
        ) : null}
      </header>
      <section>
        <h4>{campaign.productBrief.problem}</h4>
        <ul>
          {campaign.productBrief.differentiators.map((differentiator) => (
            <li key={differentiator}>{differentiator}</li>
          ))}
        </ul>
      </section>
      <div className="product-website-sections">
        {campaign.sections.map((section, index) => (
          <section key={section.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              {section.eyebrow ? <p>{section.eyebrow}</p> : null}
              <h4>{section.heading}</h4>
              <p>{section.body}</p>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function ImagesPanel({ campaign, assets }: { campaign: CampaignManifest; assets: DogfoodAsset[] }) {
  const gallery = selectDogfoodGalleryAssets(assets);
  const renderedImages = [
    ...gallery.socialGraphics,
    ...gallery.carousel,
    ...gallery.productCaptures,
  ];

  return (
    <div
      className="deliver-panel images-panel"
      id="campaign-panel-images"
      role="tabpanel"
      aria-labelledby="campaign-tab-images"
      tabIndex={0}
    >
      <header className="deliver-panel-heading">
        <div>
          <span>Images</span>
          <h3>One visual system, sized for every launch surface.</h3>
        </div>
        <p>
          {renderedImages.length > 0
            ? "Production images from this completed campaign."
            : "Creative previews only. Downloading the package runs the local image renderer."}
        </p>
      </header>
      {renderedImages.length > 0 ? (
        <div className="deliver-image-grid">
          {renderedImages.map((asset) => (
            <GalleryImage asset={asset} key={asset.href} />
          ))}
        </div>
      ) : (
        <div
          className="manifest-image-grid"
          style={
            {
              "--campaign-accent": campaign.design.accent,
              "--campaign-bg": campaign.design.background,
              "--campaign-text": campaign.design.text,
            } as CSSProperties
          }
        >
          {campaign.socialCards.map((card, index) => (
            <article key={`${card.headline}-${index}`}>
              <span>{["Open Graph", "X / LinkedIn", "Launch post"][index]}</span>
              <h4>{card.headline}</h4>
              <p>{campaign.productBrief.productName}</p>
            </article>
          ))}
          {campaign.carousel.map((slide) => (
            <article className="manifest-carousel-card" key={slide.index}>
              <span>{slide.eyebrow}</span>
              <h4>{slide.headline}</h4>
              <p>{slide.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function VideosPanel({ campaign, assets }: { campaign: CampaignManifest; assets: DogfoodAsset[] }) {
  const gallery = selectDogfoodGalleryAssets(assets);
  const videos = [gallery.landscapeVideo, gallery.portraitVideo].filter(
    (asset): asset is DogfoodAsset => asset !== null,
  );

  return (
    <div
      className="deliver-panel videos-panel"
      id="campaign-panel-videos"
      role="tabpanel"
      aria-labelledby="campaign-tab-videos"
      tabIndex={0}
    >
      <header className="deliver-panel-heading">
        <div>
          <span>Videos</span>
          <h3>Two launch-ready cuts from one campaign story.</h3>
        </div>
        <p>
          {videos.length > 0
            ? "Play the landscape and portrait masters from this completed campaign."
            : `Storyboard only · ${campaign.video.durationSeconds} seconds · ${campaign.video.fps} fps · final landscape and portrait videos render during export`}
        </p>
      </header>
      {videos.length > 0 ? (
        <div className="deliver-video-grid">
          {videos.map((asset) => (
            <figure key={asset.href}>
              <video controls playsInline preload="metadata" aria-label={asset.label}>
                <source src={asset.href} type={asset.mediaType} />
                Your browser cannot play this campaign video.
              </video>
              <figcaption>{asset.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <ol className="video-scene-list">
          {campaign.video.scenes.map((scene) => (
            <li key={scene.index}>
              <span>{String(scene.index).padStart(2, "0")}</span>
              <div>
                <h4>{scene.title}</h4>
                <p>{scene.audienceCaption}</p>
              </div>
              <small>{scene.visual.replaceAll("_", " ")}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ExportPanel({
  campaign,
  assets,
  exportReceipt,
  exporting,
  exportDisabled,
  exportNote,
  editable,
  onCampaignChange,
  onExport,
}: {
  campaign: CampaignManifest;
  assets: DogfoodAsset[];
  exportReceipt: ExportReceipt | null;
  exporting: boolean;
  exportDisabled: boolean;
  exportNote: string | null;
  editable: boolean;
  onCampaignChange?: (campaign: CampaignManifest) => void;
  onExport?: () => void;
}) {
  const archive = selectDogfoodGalleryAssets(assets).archive;

  function changePendingClaim(claimId: string, text: string) {
    if (!onCampaignChange || text.trim().length === 0) return;
    onCampaignChange(editCampaignClaim(campaign, claimId, text));
  }

  return (
    <div
      className="deliver-panel export-panel"
      id="campaign-panel-export"
      role="tabpanel"
      aria-labelledby="campaign-tab-export"
      tabIndex={0}
    >
      <div className="export-copy">
        <span>05 · Export</span>
        <h3>Everything your launch needs, in one package.</h3>
        <p>
          Website, social images, carousel, two video masters, channel copy, and the campaign
          manifest travel together.
        </p>
      </div>
      {editable ? (
        <section className="claim-review" aria-labelledby="claim-review-heading">
          <div>
            <span>Review before download</span>
            <h4 id="claim-review-heading">Refine the claims that carry the campaign.</h4>
            <p>
              Every claim remains editable. Generated inferences also need your approval before
              download.
            </p>
          </div>
          <ul>
            {campaign.claims.map((claim) => (
              <li key={claim.id}>
                <textarea
                  aria-label={`Review claim: ${claim.text}`}
                  rows={3}
                  maxLength={240}
                  value={claim.text}
                  onChange={(event) => changePendingClaim(claim.id, event.target.value)}
                />
                <p>{claim.rationale}</p>
                {claim.approvalRequired ? (
                  <button
                    type="button"
                    onClick={() => onCampaignChange?.(approveCampaignClaim(campaign, claim.id))}
                  >
                    Approve this claim
                  </button>
                ) : (
                  <span className="claim-ready">Ready · edit anytime</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="export-action">
        {archive ? (
          <a className="product-download" href={archive.href} download>
            Download complete launch package
          </a>
        ) : (
          <button
            className="product-download"
            type="button"
            onClick={onExport}
            disabled={exportDisabled || exporting}
          >
            {exporting ? "Rendering complete launch package…" : "Download complete launch package"}
          </button>
        )}
        {exportReceipt ? (
          <p role="status">Downloaded {exportReceipt.filename}.</p>
        ) : exportNote ? (
          <p>{exportNote}</p>
        ) : null}
      </div>
    </div>
  );
}

function CampaignCanvas({
  snapshot,
  campaign,
  assets = [],
  stage,
  error,
  onDismissError,
  editable,
  onCampaignChange,
  exportReceipt,
  exporting = false,
  exportDisabled = true,
  exportNote = null,
  onExport,
}: {
  snapshot: RepoSnapshot | null;
  campaign: CampaignManifest | null;
  assets?: DogfoodAsset[];
  stage: Stage;
  error: string | null;
  onDismissError?: () => void;
  editable: boolean;
  onCampaignChange?: (campaign: CampaignManifest) => void;
  exportReceipt?: ExportReceipt | null;
  exporting?: boolean;
  exportDisabled?: boolean;
  exportNote?: string | null;
  onExport?: () => void;
}) {
  const [activePanel, setActivePanel] = useState<Panel>("website");
  const previousSnapshotId = useRef<string | null>(null);
  const previousCampaignId = useRef<string | null>(null);
  const previousExportSha = useRef<string | null>(null);

  useEffect(() => {
    if (snapshot && snapshot.id !== previousSnapshotId.current) {
      previousSnapshotId.current = snapshot.id;
      setActivePanel("website");
    }
  }, [snapshot]);

  useEffect(() => {
    if (campaign && campaign.id !== previousCampaignId.current) {
      previousCampaignId.current = campaign.id;
      setActivePanel("website");
    }
  }, [campaign]);

  useEffect(() => {
    if (exportReceipt && exportReceipt.sha256 !== previousExportSha.current) {
      previousExportSha.current = exportReceipt.sha256;
      setActivePanel("export");
    }
  }, [exportReceipt]);

  function changeCopy(field: CopyField, value: string) {
    if (!campaign || !onCampaignChange) return;
    const copy = campaign.copy;
    const next =
      field === "x"
        ? { ...copy, x: value }
        : field === "linkedIn"
          ? { ...copy, linkedIn: value }
          : field === "productHuntDescription"
            ? { ...copy, productHunt: { ...copy.productHunt, description: value } }
            : { ...copy, email: { ...copy.email, body: value } };
    onCampaignChange({ ...campaign, copy: next });
  }

  return (
    <section
      className="canvas"
      aria-label="Campaign workspace"
      aria-busy={stage === "analyzing" || stage === "generating"}
    >
      <div className="canvas-toolbar">
        <Tabs active={activePanel} hasCampaign={Boolean(campaign)} onChange={setActivePanel} />
        <span className="stage-label" data-stage={stage} aria-live="polite">
          {stageLabel(stage)}
        </span>
      </div>

      {error ? (
        <ErrorBanner message={error} {...(onDismissError ? { onDismiss: onDismissError } : {})} />
      ) : null}
      {stage === "generating" ? (
        <div className="progress-banner" role="status">
          <span className="progress-spinner" aria-hidden="true" />
          <div>
            <strong>GPT‑5.6 is directing the launch system.</strong>
            <span>
              Validating claims, voice, design tokens, social copy, and motion scenes. This can take
              a few minutes.
            </span>
          </div>
        </div>
      ) : null}

      {!snapshot ? (
        <div className="empty-canvas">
          {stage === "analyzing" ? (
            <span className="large-spinner" aria-hidden="true" />
          ) : (
            <div className="orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          <p className="kicker">
            {stage === "analyzing"
              ? "Reading bounded public evidence"
              : "Evidence before adjectives"}
          </p>
          <h2>
            {stage === "analyzing"
              ? "Pinning the repository to one commit."
              : "Your repository is the creative brief."}
          </h2>
          <p>
            {stage === "analyzing"
              ? "PitchFlow reads metadata and a limited set of public files. It never clones or executes submitted code."
              : "Paste a canonical public GitHub URL to reveal the facts PitchFlow is allowed to use."}
          </p>
        </div>
      ) : campaign && activePanel === "website" ? (
        <WebsitePanel campaign={campaign} assets={assets} />
      ) : campaign && activePanel === "images" ? (
        <ImagesPanel campaign={campaign} assets={assets} />
      ) : campaign && activePanel === "videos" ? (
        <VideosPanel campaign={campaign} assets={assets} />
      ) : campaign && activePanel === "copy" ? (
        <CopyPanel campaign={campaign} editable={editable} onChange={changeCopy} />
      ) : campaign && activePanel === "export" ? (
        <ExportPanel
          campaign={campaign}
          assets={assets}
          exportReceipt={exportReceipt ?? null}
          exporting={exporting}
          exportDisabled={exportDisabled}
          exportNote={exportNote}
          editable={editable}
          {...(onCampaignChange ? { onCampaignChange } : {})}
          {...(onExport ? { onExport } : {})}
        />
      ) : (
        <div className="empty-canvas compact" role="tabpanel">
          <p>Generate the campaign to unlock this view.</p>
        </div>
      )}
    </section>
  );
}

function AssetShelf({ assets }: { assets: DogfoodAsset[] }) {
  return (
    <section className="asset-shelf" aria-labelledby="asset-heading">
      <div className="asset-heading">
        <div>
          <p className="kicker">Verified exports</p>
          <h2 id="asset-heading">The full launch package, ready to inspect.</h2>
        </div>
        <p>
          Every file is served from this cached viewer. Hashes make the immutable handoff auditable.
        </p>
      </div>
      <ul>
        {assets.map((asset) => (
          <li key={asset.href}>
            <div>
              <strong>{asset.label}</strong>
              <span>
                {asset.mediaType} · {formatBytes(asset.bytes)}
              </span>
              <code>sha256:{asset.sha256.slice(0, 12)}…</code>
            </div>
            <a href={asset.href} download>
              Download <span className="sr-only">{asset.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssetFingerprint({ asset }: { asset: DogfoodAsset }) {
  return (
    <span className="asset-fingerprint" title={`SHA-256 ${asset.sha256}`}>
      <span aria-hidden="true">SHA-256 {asset.sha256.slice(0, 12)}…</span>
      <span className="sr-only">SHA-256 {asset.sha256}</span>
    </span>
  );
}

function GalleryImage({ asset }: { asset: DogfoodAsset }) {
  const dimensions = getDogfoodImageDimensions(asset);
  const protectedPreview = asset.href.startsWith("blob:");

  return (
    <figure className="gallery-image-card">
      {/* Dogfood uses immutable paths; fresh jobs use authenticated, in-memory blob previews. */}
      {dimensions || protectedPreview ? (
        <img
          src={asset.href}
          alt={asset.label}
          loading="lazy"
          decoding="async"
          {...(dimensions
            ? {
                width: dimensions.width,
                height: dimensions.height,
                style: { aspectRatio: `${dimensions.width} / ${dimensions.height}` },
              }
            : {})}
        />
      ) : (
        <a className="gallery-image-fallback" href={asset.href} target="_blank" rel="noreferrer">
          <span>Preview withheld</span>
          <strong>Open the immutable image</strong>
          <small>Its dimensions are not part of this viewer contract.</small>
        </a>
      )}
      <figcaption>
        <strong>{asset.label}</strong>
        <span>
          {asset.mediaType} · {formatBytes(asset.bytes)}
        </span>
        <AssetFingerprint asset={asset} />
      </figcaption>
    </figure>
  );
}

function CampaignMediaGallery({ assets }: { assets: DogfoodAsset[] }) {
  const gallery = useMemo(() => selectDogfoodGalleryAssets(assets), [assets]);
  const videos = [
    gallery.landscapeVideo
      ? { asset: gallery.landscapeVideo, orientation: "Landscape", className: "landscape" }
      : null,
    gallery.portraitVideo
      ? { asset: gallery.portraitVideo, orientation: "Portrait", className: "portrait" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const hasPreview =
    videos.length > 0 ||
    gallery.socialGraphics.length > 0 ||
    gallery.carousel.length > 0 ||
    gallery.productCaptures.length > 0;

  return (
    <section className="judge-gallery" aria-labelledby="judge-gallery-heading">
      <div className="judge-gallery-heading">
        <div>
          <p className="kicker">Cached campaign gallery</p>
          <h2 id="judge-gallery-heading">Watch the launch. Inspect the package.</h2>
        </div>
        <p>
          Every preview below is loaded directly from the immutable dogfood export. Each asset hash
          stays visible alongside the work.
        </p>
      </div>

      {(gallery.microsite || gallery.archive) && (
        <div className="gallery-actions" aria-label="Complete campaign handoff">
          {gallery.microsite && (
            <a href={gallery.microsite.href} target="_blank" rel="noreferrer">
              <span>
                <small>Interactive deliverable</small>
                <strong>Open the static microsite</strong>
              </span>
              <AssetFingerprint asset={gallery.microsite} />
              <span className="gallery-action-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          )}
          {gallery.archive && (
            <a href={gallery.archive.href} download>
              <span>
                <small>Complete immutable handoff</small>
                <strong>Download the campaign ZIP</strong>
              </span>
              <AssetFingerprint asset={gallery.archive} />
              <span className="gallery-action-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <section className="gallery-section" aria-labelledby="launch-films-heading">
          <div className="gallery-section-heading">
            <div>
              <span>01</span>
              <h3 id="launch-films-heading">Caption-complete launch films</h3>
            </div>
            <p>Silent masters: the full narrative is rendered on screen and requires no audio.</p>
          </div>
          <div className="video-gallery">
            {videos.map(({ asset, orientation, className }) => {
              const descriptionId = `silent-master-${className}`;
              return (
                <figure className={`video-card ${className}`} key={asset.href}>
                  <div className="video-frame">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      aria-label={`${asset.label}, ${orientation.toLowerCase()} silent master`}
                      aria-describedby={descriptionId}
                    >
                      <source src={asset.href} type={asset.mediaType} />
                      Your browser cannot play this campaign video. Open the MP4 instead.
                    </video>
                  </div>
                  <figcaption>
                    <div>
                      <span>{orientation} master</span>
                      <strong>{asset.label}</strong>
                    </div>
                    <p id={descriptionId}>Caption-complete · silent · {formatBytes(asset.bytes)}</p>
                    <div className="video-card-footer">
                      <AssetFingerprint asset={asset} />
                      <a href={asset.href} target="_blank" rel="noreferrer">
                        Open MP4 <span className="sr-only">{asset.label}</span>
                      </a>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      {gallery.socialGraphics.length > 0 && (
        <section className="gallery-section" aria-labelledby="social-graphics-heading">
          <div className="gallery-section-heading">
            <div>
              <span>02</span>
              <h3 id="social-graphics-heading">Channel-ready social graphics</h3>
            </div>
            <p>Production PNGs, rendered at their exported aspect ratios.</p>
          </div>
          <div className="gallery-image-grid social-grid">
            {gallery.socialGraphics.map((asset) => (
              <GalleryImage asset={asset} key={asset.href} />
            ))}
          </div>
        </section>
      )}

      {gallery.carousel.length > 0 && (
        <section className="gallery-section" aria-labelledby="carousel-heading">
          <div className="gallery-section-heading">
            <div>
              <span>03</span>
              <h3 id="carousel-heading">Campaign carousel</h3>
            </div>
            <p>Read the complete sequence in its intended order.</p>
          </div>
          <div className="gallery-image-grid carousel-grid">
            {gallery.carousel.map((asset) => (
              <GalleryImage asset={asset} key={asset.href} />
            ))}
          </div>
        </section>
      )}

      {gallery.productCaptures.length > 0 && (
        <section className="gallery-section" aria-labelledby="product-captures-heading">
          <div className="gallery-section-heading">
            <div>
              <span>04</span>
              <h3 id="product-captures-heading">Product UI evidence</h3>
            </div>
            <p>Original supplied captures only; PitchFlow does not synthesize product screens.</p>
          </div>
          <div className="gallery-image-grid capture-grid">
            {gallery.productCaptures.map((asset) => (
              <GalleryImage asset={asset} key={asset.href} />
            ))}
          </div>
        </section>
      )}

      {!hasPreview && (
        <p className="gallery-empty" role="status">
          This verified package does not index browser-previewable media. Use the complete asset
          shelf below to inspect its exports.
        </p>
      )}
    </section>
  );
}

function PublicViewer() {
  const [dogfood, setDogfood] = useState<DogfoodPackage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The verified dogfood package has not been published to this build yet.");
        return response.json() as Promise<unknown>;
      })
      .then(parseDogfoodPackage)
      .then((value) => {
        setDogfood(value);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(
          caught instanceof Error ? caught.message : "The cached campaign could not be loaded.",
        );
        setStatus("unavailable");
      });
    return () => controller.abort();
  }, []);

  function revealEvidence(id: string) {
    const target = document.getElementById(evidenceAnchorId(id));
    target?.focus();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <section className="safety-band" aria-labelledby="viewer-heading">
        <div>
          <p className="kicker">Public safety boundary</p>
          <h2 id="viewer-heading">Inspect a complete campaign. Generate only on your machine.</h2>
        </div>
        <div>
          <p>
            This viewer serves immutable dogfood files and never proxies a personal Codex session.
            Fresh generation uses each developer’s own authenticated Codex entitlement locally.
          </p>
          <a href="#local-run">Run the local path</a>
        </div>
      </section>

      {status === "loading" ? (
        <section className="viewer-loading" role="status">
          <span className="large-spinner" aria-hidden="true" />
          <h2>Verifying the cached PitchFlow campaign…</h2>
          <p>Checking its source commit, schema, evidence links, and package contract.</p>
        </section>
      ) : status === "unavailable" ? (
        <section className="viewer-unavailable" role="status">
          <p className="kicker">Cached campaign unavailable</p>
          <h2>The judge package is not present in this deployment.</h2>
          <p>{error}</p>
          <p>No sample output is substituted. The public viewer remains read-only.</p>
        </section>
      ) : dogfood ? (
        <>
          <section className="viewer-source" aria-label="Cached campaign source">
            <div>
              <span>Dogfooded repository</span>
              <strong>
                {dogfood.snapshot.repository.owner}/{dogfood.snapshot.repository.name}
              </strong>
            </div>
            <div>
              <span>Pinned commit</span>
              <code>{dogfood.snapshot.commitSha}</code>
            </div>
            <a href={dogfood.snapshot.repository.canonicalUrl} target="_blank" rel="noreferrer">
              View repository <span aria-hidden="true">↗</span>
            </a>
          </section>
          <div className="public-canvas-wrap evidence-records-wrap">
            <EvidencePanel snapshot={dogfood.snapshot} selectedEvidenceId={null} />
          </div>
          <CampaignMediaGallery assets={dogfood.assets} />
          <div className="public-canvas-wrap">
            <PreviewPanel
              campaign={dogfood.campaign}
              editable={false}
              onRevealEvidence={revealEvidence}
            />
          </div>
          <AssetShelf assets={dogfood.assets} />
        </>
      ) : null}

      <section className="local-run" id="local-run" aria-labelledby="local-heading">
        <div>
          <p className="kicker">Fresh repository path</p>
          <h2 id="local-heading">Bring your own public repository and Codex sign-in.</h2>
        </div>
        <div>
          <ol>
            <li>Install the repository dependencies.</li>
            <li>Launch PitchFlow with the documented one-command runner.</li>
            <li>Review pinned evidence before authorizing GPT‑5.6 generation.</li>
          </ol>
          <code>pnpm pitchflow open</code>
        </div>
      </section>
    </>
  );
}

function readCaptureFile(file: File): Promise<string> {
  return new Promise((resolveRead, rejectRead) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolveRead(reader.result);
      else rejectRead(new Error(`PitchFlow could not read ${file.name}.`));
    });
    reader.addEventListener("error", () =>
      rejectRead(new Error(`PitchFlow could not read ${file.name}.`)),
    );
    reader.readAsDataURL(file);
  });
}

function readCaptureDimensions(dataUrl: string, fileName: string) {
  return new Promise<{ width: number; height: number }>((resolveImage, rejectImage) => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolveImage({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener("error", () => {
      rejectImage(new Error(`${fileName} is not a decodable PNG or JPEG image.`));
    });
    image.src = dataUrl;
  });
}

function CaptureAttachmentPanel({
  captures,
  disabled,
  error,
  onFiles,
  onMove,
  onRemove,
  onUpdate,
}: {
  captures: CaptureDraft[];
  disabled: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, update: Partial<CaptureDraft>) => void;
}) {
  return (
    <fieldset className="capture-fieldset" disabled={disabled}>
      <legend>Real product captures</legend>
      <div className="capture-intro">
        <p>
          Attach 2–4 real PNG or JPEG screenshots of the product. They go only to the local export
          renderer—never to Codex or GPT‑5.6.
        </p>
        <span aria-live="polite">
          {captures.length}/{MAX_CAPTURE_COUNT} attached
        </span>
      </div>
      <label className="capture-picker" htmlFor="product-captures">
        <span>{captures.length === 0 ? "Choose product screenshots" : "Add screenshots"}</span>
        <small>PNG/JPEG · up to {formatBytes(MAX_CAPTURE_BYTES)} each</small>
      </label>
      <input
        className="capture-file-input"
        id="product-captures"
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        multiple
        disabled={disabled || captures.length >= MAX_CAPTURE_COUNT}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      {error ? (
        <p className="inline-warning" role="alert">
          {error}
        </p>
      ) : null}
      {captures.length > 0 ? (
        <ol className="capture-list">
          {captures.map((capture, index) => {
            const labelId = `capture-label-${capture.id}`;
            const descriptionId = `capture-description-${capture.id}`;
            const provenanceId = `capture-provenance-${capture.id}`;
            return (
              <li key={capture.id}>
                <div className="capture-preview">
                  <img
                    src={capture.dataUrl}
                    alt={`Preview of ${capture.label || capture.fileName}`}
                  />
                  <div>
                    <strong>{capture.fileName}</strong>
                    <span>
                      {capture.width}×{capture.height} · {formatBytes(capture.bytes)}
                    </span>
                  </div>
                </div>
                <div className="capture-fields">
                  <label htmlFor={labelId}>Capture label</label>
                  <input
                    id={labelId}
                    value={capture.label}
                    minLength={3}
                    maxLength={80}
                    required
                    onChange={(event) => onUpdate(capture.id, { label: event.target.value })}
                  />
                  <label htmlFor={descriptionId}>What this real screen shows</label>
                  <textarea
                    id={descriptionId}
                    value={capture.description}
                    minLength={12}
                    maxLength={180}
                    rows={3}
                    required
                    placeholder="Describe the visible product state for provenance and accessibility."
                    onChange={(event) => onUpdate(capture.id, { description: event.target.value })}
                  />
                  <label htmlFor={provenanceId}>Provenance</label>
                  <select
                    id={provenanceId}
                    value={capture.provenance}
                    required
                    onChange={(event) =>
                      onUpdate(capture.id, {
                        provenance: event.target.value as CaptureProvenance | "",
                      })
                    }
                  >
                    <option value="">Select provenance</option>
                    {(
                      Object.entries(CAPTURE_PROVENANCE_LABELS) as Array<
                        [CaptureProvenance, string]
                      >
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="capture-actions" aria-label={`Arrange ${capture.fileName}`}>
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={disabled || index === 0}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={disabled || index === captures.length - 1}
                  >
                    Move down
                  </button>
                  <button type="button" onClick={() => onRemove(capture.id)} disabled={disabled}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {captures.length < MIN_CAPTURE_COUNT ? (
        <p className="runtime-note">
          Add {MIN_CAPTURE_COUNT - captures.length} more real product capture
          {MIN_CAPTURE_COUNT - captures.length === 1 ? "" : "s"} to unlock production export.
        </p>
      ) : null}
    </fieldset>
  );
}

function DirectionPanel({
  preferences,
  captures,
  busy,
  captureError,
  onPreferencesChange,
  onVisualDirectionChange,
  onToggleChannel,
  onFiles,
  onMoveCapture,
  onRemoveCapture,
  onUpdateCapture,
}: {
  preferences: CampaignPreferences;
  captures: CaptureDraft[];
  busy: boolean;
  captureError: string | null;
  onPreferencesChange: (preferences: CampaignPreferences) => void;
  onVisualDirectionChange: (value: string) => void;
  onToggleChannel: (channel: CampaignPreferences["channels"][number]) => void;
  onFiles: (files: File[]) => void;
  onMoveCapture: (index: number, direction: -1 | 1) => void;
  onRemoveCapture: (id: string) => void;
  onUpdateCapture: (id: string, update: Partial<CaptureDraft>) => void;
}) {
  return (
    <section
      className="pf-wizard-screen pf-direction-step"
      id="direct"
      aria-labelledby="direct-heading"
    >
      <header className="pf-screen-heading">
        <span>Direction</span>
        <h1 id="direct-heading">Direct the launch.</h1>
        <p>Start with the defaults. Add only what will make the campaign sharper.</p>
      </header>
      <div className="pf-direction-layout">
        <div className="pf-direction-fields">
          <label htmlFor="audience">Audience</label>
          <input
            id="audience"
            value={preferences.audience}
            maxLength={240}
            onChange={(event) =>
              onPreferencesChange({ ...preferences, audience: event.target.value })
            }
            disabled={busy}
          />
          <label htmlFor="positioning">Positioning</label>
          <textarea
            id="positioning"
            value={preferences.positioning}
            maxLength={320}
            rows={4}
            onChange={(event) =>
              onPreferencesChange({ ...preferences, positioning: event.target.value })
            }
            disabled={busy}
          />
          <div className="pf-direction-pair">
            <label>
              Tone
              <select
                value={preferences.tone}
                onChange={(event) =>
                  onPreferencesChange({
                    ...preferences,
                    tone: event.target.value as CampaignPreferences["tone"],
                  })
                }
                disabled={busy}
              >
                <option value="precise">Precise</option>
                <option value="bold">Bold</option>
                <option value="warm">Warm</option>
                <option value="technical">Technical</option>
                <option value="playful">Playful</option>
              </select>
            </label>
            <label>
              Visual direction
              <input
                value={preferences.visualDirection}
                maxLength={140}
                onChange={(event) => onVisualDirectionChange(event.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <details className="pf-advanced-direction">
            <summary>Channels and advanced direction</summary>
            <fieldset className="channel-fieldset" disabled={busy}>
              <legend>Launch channels</legend>
              <div>
                {(Object.keys(channelLabels) as CampaignPreferences["channels"]).map((channel) => (
                  <label key={channel}>
                    <input
                      type="checkbox"
                      checked={preferences.channels.includes(channel)}
                      onChange={() => onToggleChannel(channel)}
                    />
                    <span>{channelLabels[channel]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>
        </div>
        <div className="pf-direction-captures">
          <CaptureAttachmentPanel
            captures={captures}
            disabled={busy}
            error={captureError}
            onFiles={onFiles}
            onMove={onMoveCapture}
            onRemove={onRemoveCapture}
            onUpdate={onUpdateCapture}
          />
        </div>
      </div>
    </section>
  );
}

function LocalEngineStep({
  creditAcknowledged,
  runtime,
  runtimePending,
  onCreditAcknowledgedChange,
  onBack,
  onContinue,
}: {
  creditAcknowledged: boolean;
  runtime: RuntimeStatus | null;
  runtimePending: boolean;
  onCreditAcknowledgedChange: (checked: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="pf-wizard-screen pf-engine-step" aria-labelledby="local-engine-heading">
      <header className="pf-screen-heading">
        <span>Engine</span>
        <h1 id="local-engine-heading">Use your Codex engine.</h1>
        <p>Generation runs in this local workspace with your existing Codex sign-in.</p>
      </header>
      <div
        className="pf-engine-focus"
        data-status={runtime?.generationEnabled ? "connected" : "missing"}
      >
        <span className="pf-engine-dot" aria-hidden="true" />
        <div>
          <strong>
            {runtimePending
              ? "Checking Codex…"
              : runtime?.generationEnabled
                ? "Codex is connected"
                : "Codex authentication required"}
          </strong>
          <p>
            {runtime?.generationEnabled
              ? "GPT‑5.6 Sol will direct the campaign after your confirmation."
              : "Sign in to Codex locally, then reload this workspace."}
          </p>
        </div>
      </div>
      <label className="pf-engine-consent">
        <input
          type="checkbox"
          checked={creditAcknowledged}
          onChange={(event) => onCreditAcknowledgedChange(event.target.checked)}
          disabled={!runtime?.generationEnabled}
        />
        <span>Use my local Codex sign-in for GPT‑5.6 creative direction.</span>
      </label>
      <div className="pf-action-row">
        <button className="pf-secondary-button" type="button" onClick={onBack}>
          Back
        </button>
        <button
          className="pf-primary-button"
          type="button"
          onClick={onContinue}
          disabled={!runtime?.generationEnabled || !creditAcknowledged}
        >
          Continue to generate <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function LocalGenerateStep({
  busy,
  error,
  onBack,
  onGenerate,
}: {
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onGenerate: () => void;
}) {
  return (
    <section className="pf-wizard-screen pf-generate-step" aria-labelledby="local-generate-heading">
      <header className="pf-screen-heading">
        <span>Generate</span>
        <h1 id="local-generate-heading">
          {busy ? "Directing the launch kit." : "Ready to build the launch kit."}
        </h1>
        <p>Repository evidence, direction, and real captures stay bound to this project.</p>
      </header>
      {busy ? (
        <div className="pf-live-progress" role="status">
          <span />
          <strong>GPT‑5.6 is producing the validated campaign manifest.</strong>
          <p>This state follows the real local request and does not advance on a timer.</p>
        </div>
      ) : (
        <div className="pf-generation-ready">
          <strong>Website · Images · Videos · Copy · ZIP</strong>
          <p>The results workspace opens only after the real generation request succeeds.</p>
        </div>
      )}
      {error ? <ErrorBanner message={error} /> : null}
      {!busy ? (
        <div className="pf-action-row">
          <button className="pf-secondary-button" type="button" onClick={onBack}>
            Back
          </button>
          <button className="pf-primary-button" type="button" onClick={onGenerate}>
            Generate launch kit <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

function BridgeGenerateStep({
  view,
  status,
  probing,
  pairing,
  job,
  projectReady,
  canStart,
  connectionError,
  fallbackMessage,
  onBack,
  onContinue,
  onProbe,
  onPair,
  onStart,
  onCancel,
  onRetry,
  onOpenLocal,
}: {
  view: "engine" | "generate";
  status: BridgeStatus | null;
  probing: boolean;
  pairing: PairingUiState;
  job: BridgeJob | null;
  projectReady: boolean;
  canStart: boolean;
  connectionError: string | null;
  fallbackMessage: string | null;
  onBack: () => void;
  onContinue: () => void;
  onProbe: () => void;
  onPair: () => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpenLocal: () => void;
}) {
  const engineStatus = status?.engine?.status ?? status?.status ?? "missing";
  const provider = status?.engine?.provider ?? status?.provider ?? "Codex";
  const connected = engineStatus === "connected";
  const pairingPending = pairing === "requesting" || pairing === "pending";
  const jobRunning = job?.status === "queued" || job?.status === "running";
  const stageIndex = job ? Object.keys(bridgeStageLabels).indexOf(job.stage) : -1;

  return (
    <section
      className={`pf-wizard-screen pf-${view}-step`}
      id="generate"
      aria-labelledby={`bridge-${view}-heading`}
    >
      <header className="pf-screen-heading">
        <span>{view === "engine" ? "Engine" : "Generate"}</span>
        <h1 id={`bridge-${view}-heading`}>
          {view === "engine"
            ? "Connect your Codex engine."
            : jobRunning
              ? "Building your launch kit."
              : "Ready to generate."}
        </h1>
        <p>
          {view === "engine"
            ? "Credentials stay on your machine. PitchFlow pairs only this project after your approval."
            : "Every stage below comes from the real local job."}
        </p>
      </header>
      {view === "engine" ? (
        <div className="bridge-console">
          <div
            className="bridge-connection"
            data-status={engineStatus}
            data-fallback={Boolean(connectionError)}
          >
            <div>
              <span className="bridge-status-dot" aria-hidden="true" />
              <div>
                <strong>
                  {probing
                    ? "Checking the local engine…"
                    : connected
                      ? `${provider} engine found`
                      : "Local engine not connected"}
                </strong>
                <p>
                  {status?.engine?.message ??
                    status?.message ??
                    (connected
                      ? "Pair this browser session, then start the real generation job."
                      : "Start the loopback-only companion in a terminal. Credentials stay local.")}
                </p>
              </div>
            </div>
            <code>pnpm pitchflow connect</code>
            <div className="bridge-actions">
              <button type="button" onClick={onProbe} disabled={probing || jobRunning}>
                {probing ? "Checking…" : "Check connection"}
              </button>
              {connected && pairing !== "paired" ? (
                <button
                  type="button"
                  onClick={onPair}
                  disabled={!projectReady || pairingPending || jobRunning}
                >
                  {pairingPending ? "Waiting for local approval…" : "Pair this browser"}
                </button>
              ) : null}
              {pairing === "paired" ? (
                <button type="button" onClick={onContinue} disabled={!canStart || jobRunning}>
                  Continue to generate
                </button>
              ) : null}
            </div>
            {!canStart && pairing === "paired" && !jobRunning ? (
              <p className="bridge-requirement">
                Complete the direction and attach 2–4 attributed product captures to start.
              </p>
            ) : null}
            {!projectReady && connected && pairing !== "paired" ? (
              <p className="bridge-requirement">
                Complete the direction and 2–4 attributed captures before requesting a pairing. The
                companion binds approval to this exact project.
              </p>
            ) : null}
            {connectionError ? (
              <div className="bridge-fallback" role="alert">
                <strong>The hosted page could not reach loopback.</strong>
                <p>
                  Browser HTTPS, mixed-content, or private-network policy may block the direct
                  connection. Open the same PitchFlow workspace locally and transfer only this
                  non-secret project brief after your click.
                </p>
                <button type="button" onClick={onOpenLocal}>
                  Open local workspace with this project
                </button>
                {fallbackMessage ? <span role="status">{fallbackMessage}</span> : null}
              </div>
            ) : null}
          </div>

          {pairing === "pending" ? (
            <p className="pairing-notice" role="status">
              Approve this short-lived request in the local PitchFlow window. No credentials or
              session token are shown here.
            </p>
          ) : pairing === "expired" || pairing === "rejected" ? (
            <ErrorBanner
              message={
                pairing === "expired"
                  ? "The pairing request expired. Request a new one when you are ready."
                  : "The local user rejected this pairing request."
              }
            />
          ) : null}

          <div className="pf-action-row">
            <button className="pf-secondary-button" type="button" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="bridge-console pf-generation-console">
          {job ? (
            <div className="bridge-job" aria-live="polite">
              <div className="bridge-job-heading">
                <div>
                  <span>Real generation job</span>
                  <strong>{job.message || bridgeStageLabels[job.stage]}</strong>
                </div>
                <span>{Math.max(0, Math.min(100, Math.round(job.progress)))}%</span>
              </div>
              <progress max="100" value={Math.max(0, Math.min(100, job.progress))}>
                {job.progress}%
              </progress>
              <ol className="bridge-stages">
                {(Object.entries(bridgeStageLabels) as Array<[BridgeJobStage, string]>).map(
                  ([stage, label], index) => (
                    <li
                      key={stage}
                      data-state={
                        job.status === "completed" || index < stageIndex
                          ? "complete"
                          : index === stageIndex && job.status !== "failed"
                            ? "active"
                            : job.status === "failed" && index === stageIndex
                              ? "failed"
                              : "upcoming"
                      }
                    >
                      <span aria-hidden="true">{index + 1}</span>
                      {label}
                    </li>
                  ),
                )}
              </ol>
              {job.error ? <ErrorBanner message={job.error.message} /> : null}
              <div className="bridge-job-actions">
                {jobRunning ? (
                  <button type="button" onClick={onCancel}>
                    Cancel generation
                  </button>
                ) : null}
                {job.status === "failed" || job.status === "cancelled" ? (
                  <button type="button" onClick={onRetry}>
                    Retry this job
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="pf-generation-ready">
              <strong>Website · Images · Videos · Copy · ZIP</strong>
              <p>Start one bounded job on your paired local Codex engine.</p>
              <div className="pf-action-row">
                <button className="pf-secondary-button" type="button" onClick={onBack}>
                  Back
                </button>
                <button
                  className="pf-primary-button"
                  type="button"
                  onClick={onStart}
                  disabled={!canStart}
                >
                  Generate launch kit <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LocalPairApproval({
  pairing,
  busy,
  onDecision,
}: {
  pairing: PendingPairing | null;
  busy: boolean;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  if (!pairing) return null;
  return (
    <aside className="local-pair-approval" aria-labelledby="pair-approval-heading">
      <div>
        <span>Short-lived browser pairing</span>
        <h2 id="pair-approval-heading">Allow this PitchFlow project?</h2>
        <p>
          <strong>{pairing.repositoryUrl}</strong> requested access from the exact origin{" "}
          <code>{pairing.origin}</code>. Approval grants only this bounded local session.
        </p>
        <ul aria-label="Captures bound to this pairing">
          {pairing.captures.map((capture) => (
            <li key={capture.contentSha256}>
              {capture.fileName} · {formatBytes(capture.encodedBytes)} ·{" "}
              <code>{capture.contentSha256.slice(0, 12)}…</code>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <button type="button" onClick={() => onDecision("reject")} disabled={busy}>
          Reject
        </button>
        <button type="button" onClick={() => onDecision("approve")} disabled={busy}>
          {busy ? "Applying decision…" : "Approve pairing"}
        </button>
      </div>
    </aside>
  );
}

function ResultsWorkspace({
  snapshot,
  campaign,
  assets,
  ownership,
  stage,
  error,
  exportReceipt,
  exporting,
  exportDisabled,
  exportNote,
  onCreateProject,
  onCampaignChange,
  onExport,
}: {
  snapshot: RepoSnapshot;
  campaign: CampaignManifest;
  assets: DogfoodAsset[];
  ownership: Exclude<ResultOwnership, null>;
  stage: Stage;
  error: string | null;
  exportReceipt: ExportReceipt | null;
  exporting: boolean;
  exportDisabled: boolean;
  exportNote: string | null;
  onCreateProject: () => void;
  onCampaignChange: (campaign: CampaignManifest) => void;
  onExport: () => void;
}) {
  const demo = ownership === "demo";
  return (
    <section className="pf-results" aria-labelledby="results-heading">
      <header className="pf-results-heading">
        <div>
          <span>{demo ? "Demo project" : "Generated project"}</span>
          <h1 id="results-heading">{campaign.productBrief.productName} launch kit</h1>
          <p>
            {demo
              ? "Read-only demo · generated from the PitchFlow repository"
              : `Generated by your connected local engine · ${snapshot.repository.owner}/${snapshot.repository.name}`}
          </p>
        </div>
        <button className="pf-secondary-button" type="button" onClick={onCreateProject}>
          Create from my repository <span aria-hidden="true">→</span>
        </button>
      </header>
      <CampaignCanvas
        snapshot={snapshot}
        campaign={campaign}
        assets={assets}
        stage={stage}
        error={error}
        editable={!demo && ownership === "fresh"}
        onCampaignChange={onCampaignChange}
        exportReceipt={exportReceipt}
        exporting={exporting}
        exportDisabled={exportDisabled}
        exportNote={exportNote}
        onExport={onExport}
      />
    </section>
  );
}

function LocalWorkspace({ publicViewer }: { publicViewer: boolean }) {
  const [screen, setScreen] = useState<ProductScreen>("entry");
  const [resultOwnership, setResultOwnership] = useState<ResultOwnership>(null);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositorySummary, setRepositorySummary] = useState<RepositorySummary | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [campaign, setCampaign] = useState<CampaignManifest | null>(null);
  const [demoPackage, setDemoPackage] = useState<DogfoodPackage | null>(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [demoAssets, setDemoAssets] = useState<DogfoodAsset[]>([]);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [runtimePending, setRuntimePending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditAcknowledged, setCreditAcknowledged] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [processingCaptures, setProcessingCaptures] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CaptureDraft[]>([]);
  const [exportReceipt, setExportReceipt] = useState<ExportReceipt | null>(null);
  const bridge = useRef<PitchFlowBridgeClient | null>(null);
  if (!bridge.current) bridge.current = new PitchFlowBridgeClient();
  const bridgeClient = bridge.current;
  const [freshPublicRepository, setFreshPublicRepository] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [bridgeProbing, setBridgeProbing] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingUiState>("idle");
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [bridgeJob, setBridgeJob] = useState<BridgeJob | null>(null);
  const [bridgeJobId, setBridgeJobId] = useState<string | null>(null);
  const [bridgePackageFilename, setBridgePackageFilename] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [pendingLocalPairing, setPendingLocalPairing] = useState<PendingPairing | null>(null);
  const [pairDecisionBusy, setPairDecisionBusy] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const transferredProjectPending = useRef(false);
  const bridgeObjectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      bridgeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      bridgeObjectUrls.current = [];
      bridgeClient.clearSession();
    },
    [bridgeClient],
  );

  useEffect(() => {
    if (publicViewer) {
      setRuntimePending(false);
      return;
    }
    const controller = new AbortController();
    void fetch("/api/status", { cache: "no-store", signal: controller.signal })
      .then((response) => parseApi<RuntimeStatus>(response))
      .then(setRuntime)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      })
      .finally(() => setRuntimePending(false));
    return () => controller.abort();
  }, [publicViewer]);

  useEffect(() => {
    if (publicViewer) return;
    let active = true;
    async function refreshPendingPairing() {
      try {
        const pending = await bridgeClient.getPendingPairing();
        if (active) setPendingLocalPairing(pending);
      } catch {
        // The normal local workspace may be running without companion mode.
      }
    }
    void refreshPendingPairing();
    const timer = window.setInterval(() => void refreshPendingPairing(), 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridgeClient, publicViewer]);

  useEffect(() => {
    if (publicViewer || new URLSearchParams(window.location.search).get("companion") !== "1") {
      return;
    }
    const opener = window.opener as Window | null;
    if (!opener) return;
    const companionOpener = opener;
    let accepted = false;
    async function receiveProject(event: MessageEvent<unknown>) {
      if (
        accepted ||
        event.source !== companionOpener ||
        !isAllowedPublicTransferOrigin(event.origin) ||
        !isCompanionTransferMessage(event.data)
      ) {
        return;
      }
      try {
        const transfer = parseCompanionTransferMessage(event.data);
        const canonical = canonicalGitHubRepositoryUrl(transfer.project.repositoryUrl);
        const transferredCaptures = await Promise.all(
          transfer.project.captures.map(async (capture) => {
            const [dimensions, blob] = await Promise.all([
              readCaptureDimensions(capture.dataUrl, capture.fileName),
              fetch(capture.dataUrl).then((response) => response.blob()),
            ]);
            return {
              ...capture,
              provenance: capture.provenance,
              width: dimensions.width,
              height: dimensions.height,
              bytes: blob.size,
            } satisfies CaptureDraft;
          }),
        );
        accepted = true;
        transferredProjectPending.current = true;
        setRepositoryUrl(canonical);
        setPreferences(transfer.project.preferences);
        setCaptures(transferredCaptures);
        setTransferNotice(
          "Project transferred from the public workspace. Confirm Analyze repository to begin locally.",
        );
        companionOpener.postMessage(
          { type: "pitchflow:project-accepted", version: 1, nonce: transfer.nonce },
          event.origin,
        );
        window.requestAnimationFrame(() =>
          document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }),
        );
      } catch {
        companionOpener.postMessage(
          {
            type: "pitchflow:project-rejected",
            version: 1,
            nonce:
              event.data && typeof event.data === "object" && "nonce" in event.data
                ? event.data.nonce
                : null,
          },
          event.origin,
        );
      }
    }
    const messageListener = (event: MessageEvent<unknown>) => void receiveProject(event);
    window.addEventListener("message", messageListener);
    let targetOrigin = PUBLIC_PRODUCT_ORIGIN;
    try {
      const referrerOrigin = new URL(document.referrer).origin;
      if (isAllowedPublicTransferOrigin(referrerOrigin)) targetOrigin = referrerOrigin;
    } catch {
      // Use the configured production origin when no valid referrer exists.
    }
    companionOpener.postMessage({ type: "pitchflow:companion-ready", version: 1 }, targetOrigin);
    return () => window.removeEventListener("message", messageListener);
  }, [publicViewer]);

  useEffect(() => {
    if (!publicViewer) return;
    const controller = new AbortController();
    void fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The PitchFlow demo could not be loaded.");
        return response.json() as Promise<unknown>;
      })
      .then(parseDogfoodPackage)
      .then((demo) => {
        setDemoPackage(demo);
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The PitchFlow demo could not load.");
      });
    return () => controller.abort();
  }, [publicViewer]);

  function bridgeProject(): BridgeProjectState {
    if (!freshPublicRepository) throw new Error("Choose a public repository first.");
    return {
      repositoryUrl: freshPublicRepository,
      preferences,
      captures: captures.map((capture) => {
        if (!capture.provenance) throw new Error("Every capture needs attributed provenance.");
        return {
          id: capture.id,
          order: capture.order,
          fileName: capture.fileName,
          label: capture.label,
          description: capture.description,
          provenance: capture.provenance,
          mediaType: capture.mediaType,
          dataUrl: capture.dataUrl,
        };
      }),
      provider: "codex",
    };
  }

  function clearBridgePreviews() {
    bridgeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    bridgeObjectUrls.current = [];
  }

  async function probeBridge() {
    setBridgeProbing(true);
    setBridgeError(null);
    try {
      setBridgeStatus(await bridgeClient.getStatus());
    } catch (caught) {
      setBridgeStatus(null);
      setBridgeError(
        caught instanceof Error
          ? caught.message
          : "The hosted page could not reach the local PitchFlow companion.",
      );
    } finally {
      setBridgeProbing(false);
    }
  }

  async function requestBridgePairing() {
    if (!freshPublicRepository) return;
    setPairing("requesting");
    setBridgeError(null);
    try {
      const response = await bridgeClient.requestPairing(bridgeProject());
      setPairingId(response.pairingId);
      setPairing("pending");
    } catch (caught) {
      setPairing("idle");
      setBridgeError(caught instanceof Error ? caught.message : "Pairing could not be requested.");
    }
  }

  async function startBridgeJob() {
    if (!capturesReady || !freshPublicRepository) return;
    setBridgeError(null);
    setBridgePackageFilename(null);
    setCampaign(null);
    setSnapshot(null);
    setDemoAssets([]);
    setExportReceipt(null);
    setStage("generating");
    setScreen("generate");
    try {
      const response = await bridgeClient.startJob(bridgeProject());
      setBridgeJobId(response.jobId);
      setBridgeJob({
        id: response.jobId,
        status: "queued",
        stage: "fetching_evidence",
        progress: 0,
        message: "Generation queued on your local engine.",
      });
    } catch (caught) {
      setStage("review");
      setBridgeError(caught instanceof Error ? caught.message : "Generation could not start.");
    }
  }

  async function actOnBridgeJob(action: "cancel" | "retry") {
    if (!bridgeJobId) return;
    setBridgeError(null);
    try {
      const response = await bridgeClient.actOnJob(bridgeJobId, action);
      setBridgeJobId(response.jobId);
      setStage(action === "retry" ? "generating" : "review");
      if (action === "retry") {
        setBridgeJob({
          id: response.jobId,
          status: "queued",
          stage: "fetching_evidence",
          progress: 0,
          message: "Retry queued on your local engine.",
        });
      }
    } catch (caught) {
      setBridgeError(caught instanceof Error ? caught.message : `Job ${action} failed.`);
    }
  }

  async function downloadBridgePackage() {
    if (!bridgeJobId || !bridgePackageFilename) return;
    setExporting(true);
    setBridgeError(null);
    try {
      const archive = await bridgeClient.getAsset(bridgeJobId, bridgePackageFilename);
      const href = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = bridgePackageFilename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setExportReceipt({
        filename: bridgePackageFilename,
        assetCount: bridgeJob?.result?.assets.length ?? 0,
        sha256:
          bridgeJob?.result?.assets.find((asset) => asset.filename === bridgePackageFilename)
            ?.sha256 ?? "",
      });
    } catch (caught) {
      setBridgeError(caught instanceof Error ? caught.message : "Package download failed.");
    } finally {
      setExporting(false);
    }
  }

  function openLocalWorkspaceWithProject() {
    let project: BridgeProjectState;
    try {
      project = bridgeProject();
    } catch (caught) {
      setFallbackMessage(caught instanceof Error ? caught.message : "The project is incomplete.");
      return;
    }
    const local = window.open(`${BRIDGE_ORIGIN}/?companion=1`, "pitchflow-local-companion");
    if (!local) {
      setFallbackMessage("Allow this user-initiated popup, then try again.");
      return;
    }
    const localWorkspace = local;
    const transferNonce = crypto.randomUUID();
    let transferSent = false;
    setFallbackMessage("Waiting for the local workspace…");
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      setFallbackMessage(
        "The local workspace did not answer. Start `pnpm pitchflow connect`, then try again.",
      );
    }, 12_000);
    function handleMessage(event: MessageEvent<unknown>) {
      if (event.origin !== BRIDGE_ORIGIN || event.source !== localWorkspace || !event.data) return;
      const message = event.data as { type?: string; version?: number; nonce?: string };
      if (message.type === "pitchflow:companion-ready" && message.version === 1 && !transferSent) {
        transferSent = true;
        localWorkspace.postMessage(
          {
            type: "pitchflow:project-transfer",
            version: 1,
            nonce: transferNonce,
            project,
          },
          BRIDGE_ORIGIN,
        );
      } else if (
        (message.type === "pitchflow:project-accepted" ||
          message.type === "pitchflow:project-rejected") &&
        message.version === 1 &&
        message.nonce === transferNonce
      ) {
        window.clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        setFallbackMessage(
          message.type === "pitchflow:project-accepted"
            ? "Project opened locally. Confirm Analyze repository in that window."
            : "The local workspace rejected the transferred project.",
        );
      }
    }
    window.addEventListener("message", handleMessage);
  }

  async function decideLocalPairing(decision: "approve" | "reject") {
    if (!pendingLocalPairing) return;
    setPairDecisionBusy(true);
    try {
      await bridgeClient.decidePairing(pendingLocalPairing.pairingId, decision);
      setPendingLocalPairing(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pairing decision failed.");
    } finally {
      setPairDecisionBusy(false);
    }
  }

  useEffect(() => {
    if (!publicViewer || !pairingId || pairing !== "pending") return;
    let active = true;
    async function poll() {
      try {
        const response = await bridgeClient.pollPairing(pairingId!);
        if (!active) return;
        if (response.status === "approved") {
          setPairing("paired");
          setPairingId(null);
          setBridgeError(null);
        } else if (response.status === "expired" || response.status === "rejected") {
          setPairing(response.status);
          setPairingId(null);
        }
      } catch (caught) {
        if (active) {
          setPairing("idle");
          setPairingId(null);
          setBridgeError(
            caught instanceof Error ? caught.message : "The pairing request could not be checked.",
          );
        }
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 1250);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridgeClient, pairing, pairingId, publicViewer]);

  useEffect(() => {
    if (!publicViewer || !bridgeJobId) return;
    let active = true;
    let loadingResult = false;

    async function acceptResult(result: BridgeJobResult) {
      if (loadingResult) return;
      loadingResult = true;
      const take = (
        predicate: (asset: BridgeJobResult["assets"][number]) => boolean,
        count: number,
      ) => result.assets.filter(predicate).slice(0, count);
      const previewAssets = [
        ...take((asset) => asset.kind === "microsite", 1),
        ...take((asset) => asset.kind === "image", 2),
        ...take((asset) => asset.kind === "carousel", 2),
        ...take(
          (asset) => asset.kind === "video" && /landscape|1920x1080|16x9/i.test(asset.filename),
          1,
        ),
        ...take(
          (asset) =>
            asset.kind === "video" && /portrait|vertical|1080x1920|9x16/i.test(asset.filename),
          1,
        ),
      ].filter(
        (asset, index, assets) =>
          assets.findIndex((candidate) => candidate.filename === asset.filename) === index,
      );
      const websiteSupportAssets = result.assets.filter(
        (asset) =>
          asset.filename === "site/styles.css" ||
          asset.filename === "images/og-1200x630.png" ||
          /^images\/product-capture-[^/]+\.(?:png|jpe?g)$/i.test(asset.filename),
      );
      const fetchAssets = [...previewAssets, ...websiteSupportAssets].filter(
        (asset, index, assets) =>
          assets.findIndex((candidate) => candidate.filename === asset.filename) === index,
      );
      bridgeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      bridgeObjectUrls.current = [];
      const fetched = await Promise.all(
        fetchAssets.map(async (asset) => ({
          asset,
          blob: await bridgeClient.getAsset(bridgeJobId!, asset.filename),
        })),
      );
      const fetchedByFilename = new Map(
        fetched.map(({ asset, blob }) => [asset.filename, { asset, blob }] as const),
      );
      const micrositeAsset = previewAssets.find((asset) => asset.kind === "microsite");
      let selfContainedMicrosite: Blob | null = null;
      if (micrositeAsset) {
        const microsite = fetchedByFilename.get(micrositeAsset.filename);
        const stylesheet = fetchedByFilename.get("site/styles.css");
        if (!microsite || !stylesheet) {
          throw new Error("The generated website is missing its HTML or stylesheet asset.");
        }
        let html = await microsite.blob.text();
        const css = await stylesheet.blob.text();
        html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`);
        for (const { asset, blob } of fetched) {
          if (
            asset.filename === "images/og-1200x630.png" ||
            /^images\/product-capture-[^/]+\.(?:png|jpe?g)$/i.test(asset.filename)
          ) {
            const assetUrl = URL.createObjectURL(blob);
            bridgeObjectUrls.current.push(assetUrl);
            html = html.replaceAll(`../${asset.filename}`, assetUrl);
          }
        }
        selfContainedMicrosite = new Blob([html], { type: "text/html" });
      }
      const loaded = previewAssets.map((asset) => {
        const fetchedAsset = fetchedByFilename.get(asset.filename);
        if (!fetchedAsset) throw new Error(`Generated preview asset is missing: ${asset.filename}`);
        const blob =
          asset.filename === micrositeAsset?.filename && selfContainedMicrosite
            ? selfContainedMicrosite
            : fetchedAsset.blob;
        const href = URL.createObjectURL(blob);
        bridgeObjectUrls.current.push(href);
        const normalizedKind = asset.kind.toLowerCase();
        const label = /landscape|1920x1080|16x9/i.test(asset.filename)
          ? `Landscape video master · ${asset.filename}`
          : /portrait|vertical|1080x1920|9x16/i.test(asset.filename)
            ? `Portrait video master · ${asset.filename}`
            : normalizedKind.includes("website") || asset.mediaType === "text/html"
              ? `Launch site · ${asset.filename}`
              : normalizedKind.includes("carousel")
                ? `Carousel image · ${asset.filename}`
                : normalizedKind.includes("capture")
                  ? `Product UI capture · ${asset.filename}`
                  : `Social image · ${asset.filename}`;
        return {
          label,
          href,
          mediaType: asset.mediaType,
          bytes: asset.bytes,
          sha256: asset.sha256,
        } satisfies DogfoodAsset;
      });
      if (!active) {
        loaded.forEach((asset) => URL.revokeObjectURL(asset.href));
        return;
      }
      setSnapshot(result.snapshot);
      setCampaign(result.campaign);
      setDemoAssets(loaded);
      setBridgePackageFilename(result.packageFilename);
      setResultOwnership("fresh");
      setStage("ready");
      setScreen("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function pollJob() {
      try {
        const next = await bridgeClient.getJob(bridgeJobId!);
        if (!active) return;
        setBridgeJob(next);
        if (next.status === "completed") {
          if (!next.result) throw new Error("The completed job did not include an owned result.");
          await acceptResult(next.result);
        } else if (next.status === "failed" || next.status === "cancelled") {
          setStage("review");
        }
      } catch (caught) {
        if (!active) return;
        setStage("review");
        setBridgeError(caught instanceof Error ? caught.message : "Job status polling failed.");
      }
    }

    void pollJob();
    const timer = window.setInterval(() => {
      if (!loadingResult) void pollJob();
    }, 1250);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridgeClient, bridgeJobId, publicViewer]);

  useEffect(() => {
    if (publicViewer) return;
    const requestedRepository = new URLSearchParams(window.location.search).get("repo");
    if (requestedRepository) {
      try {
        setRepositoryUrl(canonicalGitHubRepositoryUrl(requestedRepository));
      } catch {
        setError("The repository in this local link is not a canonical public GitHub URL.");
      }
    }
  }, [publicViewer]);

  async function loadDemo() {
    setError(null);
    clearBridgePreviews();
    setFreshPublicRepository(null);
    setBridgeStatus(null);
    setBridgeError(null);
    setPairing("idle");
    setPairingId(null);
    setBridgeJob(null);
    setBridgeJobId(null);
    setBridgePackageFilename(null);
    bridgeClient.clearSession();
    setStage("analyzing");
    try {
      let demo = demoPackage;
      if (!demo) {
        demo = await fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache" }).then(async (response) => {
          if (!response.ok) throw new Error("The PitchFlow demo could not be loaded.");
          return parseDogfoodPackage((await response.json()) as unknown);
        });
      }
      if (!demo) throw new Error("The PitchFlow demo could not be loaded.");
      setDemoPackage(demo);
      setSnapshot(demo.snapshot);
      setCampaign(demo.campaign);
      setDemoAssets(demo.assets);
      setRepositoryUrl(demo.snapshot.repository.canonicalUrl);
      setPreferences({
        audience: demo.campaign.productBrief.audience.join(", "),
        positioning: demo.campaign.productBrief.positioning,
        visualDirection: `${demo.campaign.design.displayFont === "system-serif" ? "Editorial serif" : "Modern sans"}, ${demo.campaign.design.accent} accent, ${demo.campaign.design.radius}px corners`,
        tone: demo.campaign.productBrief.tone,
        channels: [...defaultPreferences.channels],
      });
      setRepositorySummary({
        fullName: `${demo.snapshot.repository.owner}/${demo.snapshot.repository.name}`,
        description: demo.snapshot.repository.description ?? demo.campaign.productBrief.oneLiner,
        language: Object.keys(demo.snapshot.languages)[0] ?? null,
        license: demo.snapshot.repository.licenseSpdx,
      });
      setResultOwnership("demo");
      setStage("ready");
      setScreen("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setStage("idle");
      setError(caught instanceof Error ? caught.message : "The PitchFlow demo could not load.");
    }
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStage("analyzing");
    setResultOwnership(null);
    if (publicViewer) {
      try {
        const canonical = canonicalGitHubRepositoryUrl(repositoryUrl);
        const canonicalUrl = new URL(canonical);
        const [owner, repository] = canonicalUrl.pathname.split("/").filter(Boolean);
        if (!owner || !repository)
          throw new Error("Enter a canonical public GitHub repository URL.");
        const metadataResponse = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
          { headers: { accept: "application/vnd.github+json" } },
        );
        if (!metadataResponse.ok) {
          throw new Error(
            metadataResponse.status === 404
              ? "That public GitHub repository could not be found."
              : "GitHub could not validate this repository. Try again in a moment.",
          );
        }
        const metadata = (await metadataResponse.json()) as {
          full_name?: unknown;
          description?: unknown;
          language?: unknown;
          license?: { spdx_id?: unknown } | null;
        };
        if (typeof metadata.full_name !== "string") {
          throw new Error("GitHub returned an invalid repository summary.");
        }
        setRepositoryUrl(canonical);
        setRepositorySummary({
          fullName: metadata.full_name,
          description:
            typeof metadata.description === "string" && metadata.description.trim()
              ? metadata.description
              : "Public repository validated and ready for local evidence analysis.",
          language: typeof metadata.language === "string" ? metadata.language : null,
          license:
            metadata.license && typeof metadata.license.spdx_id === "string"
              ? metadata.license.spdx_id
              : null,
        });
        setFreshPublicRepository(canonical);
        clearBridgePreviews();
        setSnapshot(null);
        setCampaign(null);
        setDemoAssets([]);
        setPreferences(defaultPreferences);
        setCaptures([]);
        setCaptureError(null);
        setExportReceipt(null);
        setBridgeJob(null);
        setBridgeJobId(null);
        setBridgePackageFilename(null);
        setPairing("idle");
        setPairingId(null);
        bridgeClient.clearSession();
        setStage("review");
        setScreen("repository");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (caught) {
        setStage("idle");
        setError(
          caught instanceof Error ? caught.message : "Enter a public GitHub repository URL.",
        );
      }
      return;
    }
    setSnapshot(null);
    setCampaign(null);
    setDemoAssets([]);
    setCreditAcknowledged(false);
    if (!transferredProjectPending.current) setCaptures([]);
    setCaptureError(null);
    setExportReceipt(null);
    try {
      const payload = await parseApi<{ snapshot: RepoSnapshot }>(
        await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repositoryUrl }),
        }),
      );
      setSnapshot(payload.snapshot);
      setRepositorySummary({
        fullName: `${payload.snapshot.repository.owner}/${payload.snapshot.repository.name}`,
        description:
          payload.snapshot.repository.description ??
          "Public repository analyzed from bounded evidence.",
        language: Object.keys(payload.snapshot.languages)[0] ?? null,
        license: payload.snapshot.repository.licenseSpdx,
      });
      setStage("review");
      setScreen("repository");
      if (transferredProjectPending.current) {
        transferredProjectPending.current = false;
        setTransferNotice(
          "Project transferred from the public workspace. Repository evidence is pinned locally; review the preserved direction and captures before generation.",
        );
      }
    } catch (caught) {
      setStage("idle");
      setError(caught instanceof Error ? caught.message : "Repository analysis failed.");
    }
  }

  async function generate() {
    if (!snapshot) return;
    setError(null);
    setExportReceipt(null);
    setStage("generating");
    try {
      const payload = await parseApi<{ manifest: CampaignManifest }>(
        await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            snapshot,
            preferences,
            ...(campaign ? { previousVersion: campaign.version } : {}),
          }),
        }),
      );
      setCampaign(payload.manifest);
      setDemoAssets([]);
      setResultOwnership("fresh");
      setStage("ready");
      setScreen("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setStage("review");
      setError(caught instanceof Error ? caught.message : "Campaign generation failed.");
    }
  }

  function toggleChannel(channel: CampaignPreferences["channels"][number]) {
    setPreferences((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((value) => value !== channel)
        : [...current.channels, channel],
    }));
  }

  async function addCaptureFiles(files: File[]) {
    if (captures.length + files.length > MAX_CAPTURE_COUNT) {
      setCaptureError(`PitchFlow accepts at most ${MAX_CAPTURE_COUNT} product captures.`);
      return;
    }
    setProcessingCaptures(true);
    setCaptureError(null);
    try {
      const additions: CaptureDraft[] = [];
      for (const [fileIndex, file] of files.entries()) {
        if (file.type !== "image/png" && file.type !== "image/jpeg") {
          throw new Error(`${file.name} is not a PNG or JPEG image.`);
        }
        if (file.size === 0 || file.size > MAX_CAPTURE_BYTES) {
          throw new Error(`${file.name} must contain 1–${formatBytes(MAX_CAPTURE_BYTES)}.`);
        }
        const dataUrl = await readCaptureFile(file);
        const dimensions = await readCaptureDimensions(dataUrl, file.name);
        if (
          dimensions.width < MIN_CAPTURE_WIDTH ||
          dimensions.height < MIN_CAPTURE_HEIGHT ||
          dimensions.width > MAX_CAPTURE_DIMENSION ||
          dimensions.height > MAX_CAPTURE_DIMENSION ||
          dimensions.width * dimensions.height > MAX_CAPTURE_PIXELS
        ) {
          throw new Error(
            `${file.name} has unsupported dimensions. Use a real product screen from ${MIN_CAPTURE_WIDTH}×${MIN_CAPTURE_HEIGHT} up to ${MAX_CAPTURE_DIMENSION}×${MAX_CAPTURE_DIMENSION}.`,
          );
        }
        const fileLabel = file.name
          .replace(/\.(?:png|jpe?g)$/i, "")
          .replaceAll(/[-_]+/g, " ")
          .trim();
        additions.push({
          id: `capture_${crypto.randomUUID().replaceAll("-", "_")}`,
          order: captures.length + fileIndex,
          fileName: file.name,
          label:
            fileLabel.length >= 3
              ? fileLabel.slice(0, 80)
              : `Product screen ${captures.length + fileIndex + 1}`,
          description: "",
          provenance: "",
          mediaType: file.type,
          dataUrl,
          width: dimensions.width,
          height: dimensions.height,
          bytes: file.size,
        });
      }
      setCaptures((current) =>
        [...current, ...additions].map((capture, index) => ({ ...capture, order: index })),
      );
      setExportReceipt(null);
    } catch (caught) {
      setCaptureError(caught instanceof Error ? caught.message : "A product capture was rejected.");
    } finally {
      setProcessingCaptures(false);
    }
  }

  function moveCapture(index: number, direction: -1 | 1) {
    setExportReceipt(null);
    setCaptures((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((capture, order) => ({ ...capture, order }));
    });
  }

  function removeCapture(id: string) {
    setExportReceipt(null);
    setCaptures((current) =>
      current
        .filter((capture) => capture.id !== id)
        .map((capture, order) => ({ ...capture, order })),
    );
    setCaptureError(null);
  }

  function updateCapture(id: string, update: Partial<CaptureDraft>) {
    setExportReceipt(null);
    setCaptures((current) =>
      current.map((capture) => (capture.id === id ? { ...capture, ...update } : capture)),
    );
  }

  async function exportCampaign() {
    if (!snapshot || !campaign) return;
    if (!capturesReady) {
      setCaptureError(
        `Attach ${MIN_CAPTURE_COUNT}–${MAX_CAPTURE_COUNT} real product captures and complete their provenance fields before export.`,
      );
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snapshot,
          campaign,
          captures: captures.map((capture) => {
            if (!capture.provenance) throw new Error("Every product capture needs provenance.");
            return {
              id: capture.id,
              order: capture.order,
              fileName: capture.fileName,
              label: capture.label,
              description: capture.description,
              provenance: capture.provenance,
              mediaType: capture.mediaType,
              dataUrl: capture.dataUrl,
            } satisfies CaptureUpload;
          }),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiFailure;
        throw new Error(
          payload.error?.message ?? `PitchFlow export failed with HTTP ${response.status}.`,
        );
      }
      const assetCount = Number(response.headers.get("x-pitchflow-assets"));
      const receiptSha256 = response.headers.get("x-pitchflow-sha256") ?? "";
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = /filename="([a-z0-9_.-]+)"/i.exec(disposition);
      if (
        !Number.isSafeInteger(assetCount) ||
        assetCount < 1 ||
        !/^[a-f0-9]{64}$/.test(receiptSha256) ||
        !filenameMatch
      ) {
        throw new Error("PitchFlow export completed without a valid integrity receipt.");
      }
      const filename = filenameMatch[1]!;
      const archive = await response.blob();
      const objectUrl = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setExportReceipt({ filename, assetCount, sha256: receiptSha256 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign export failed.");
    } finally {
      setExporting(false);
    }
  }

  const capturesReady =
    captures.length >= MIN_CAPTURE_COUNT &&
    captures.length <= MAX_CAPTURE_COUNT &&
    captures.every(
      (capture) =>
        capture.label.trim().length >= 3 &&
        capture.description.trim().length >= 12 &&
        capture.provenance !== "",
    );
  const busy = stage === "analyzing" || stage === "generating" || exporting || processingCaptures;
  const freshBridgeMode = publicViewer && Boolean(freshPublicRepository);
  const demoMode = resultOwnership === "demo";
  const pendingInferenceCount = pendingClaimCount(campaign);
  const exportDisabled = freshBridgeMode
    ? busy || !bridgePackageFilename
    : busy || pendingInferenceCount > 0 || !capturesReady;
  const exportNote = demoMode
    ? null
    : freshBridgeMode
      ? "The ZIP is fetched from your paired local engine only after you click download."
      : pendingInferenceCount > 0
        ? `Review ${pendingInferenceCount} generated claim${pendingInferenceCount === 1 ? "" : "s"} before download.`
        : !capturesReady
          ? `Complete ${MIN_CAPTURE_COUNT}–${MAX_CAPTURE_COUNT} real product captures to download the package.`
          : "Rendering the videos and ZIP can take a few minutes. Keep this tab open.";

  function resetProject() {
    clearBridgePreviews();
    bridgeClient.clearSession();
    setScreen("entry");
    setResultOwnership(null);
    setRepositoryUrl("");
    setRepositorySummary(null);
    setStage("idle");
    setSnapshot(null);
    setCampaign(null);
    setPreferences(defaultPreferences);
    setDemoAssets([]);
    setFreshPublicRepository(null);
    setError(null);
    setCreditAcknowledged(false);
    setCaptures([]);
    setCaptureError(null);
    setExportReceipt(null);
    setBridgeStatus(null);
    setBridgeError(null);
    setPairing("idle");
    setPairingId(null);
    setBridgeJob(null);
    setBridgeJobId(null);
    setBridgePackageFilename(null);
    setFallbackMessage(null);
    setTransferNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateRepositoryInput(value: string) {
    setRepositoryUrl(value);
    setError(null);
    if (freshPublicRepository && value !== freshPublicRepository) {
      clearBridgePreviews();
      setFreshPublicRepository(null);
      setRepositorySummary(null);
      setSnapshot(null);
      setCampaign(null);
      setDemoAssets([]);
      setPairing("idle");
      setBridgeJob(null);
      setBridgeJobId(null);
      bridgeClient.clearSession();
    }
  }

  const projectLabel =
    repositorySummary?.fullName ??
    (snapshot ? `${snapshot.repository.owner}/${snapshot.repository.name}` : null);
  const wizardScreen = screen as Exclude<ProductScreen, "entry" | "results">;
  const projectReady =
    capturesReady &&
    preferences.visualDirection.trim().length >= 3 &&
    preferences.channels.length > 0;

  return (
    <>
      <ProductAppHeader
        project={screen === "entry" ? null : projectLabel}
        {...(screen === "entry" ? {} : { onExit: resetProject })}
      />
      {screen === "entry" ? (
        <ProductHero
          repositoryUrl={repositoryUrl}
          busy={stage === "analyzing"}
          error={error}
          onRepositoryUrlChange={updateRepositoryInput}
          onAnalyze={(event) => void analyze(event)}
          onTryDemo={() => void loadDemo()}
        />
      ) : screen === "results" && snapshot && campaign && resultOwnership ? (
        <ResultsWorkspace
          snapshot={snapshot}
          campaign={campaign}
          assets={demoAssets}
          ownership={resultOwnership}
          stage={stage}
          error={error ?? bridgeError}
          exportReceipt={exportReceipt}
          exporting={exporting}
          exportDisabled={demoMode ? false : exportDisabled}
          exportNote={exportNote}
          onCreateProject={resetProject}
          onCampaignChange={(nextCampaign) => {
            setExportReceipt(null);
            setCampaign(nextCampaign);
          }}
          onExport={() => void (freshBridgeMode ? downloadBridgePackage() : exportCampaign())}
        />
      ) : (
        <div className="pf-project-shell">
          <ProductStepper
            active={wizardScreen}
            onNavigate={(nextScreen) => {
              if (!busy && !(bridgeJob?.status === "queued" || bridgeJob?.status === "running")) {
                setScreen(nextScreen);
              }
            }}
          />
          {transferNotice ? <p className="project-transfer-notice">{transferNotice}</p> : null}
          {screen === "repository" ? (
            <RepositoryStep
              repositoryUrl={repositoryUrl}
              summary={repositorySummary}
              snapshot={snapshot}
              onBack={resetProject}
              onContinue={() => setScreen("direction")}
            />
          ) : screen === "direction" ? (
            <>
              <DirectionPanel
                preferences={preferences}
                captures={captures}
                busy={busy}
                captureError={captureError}
                onPreferencesChange={setPreferences}
                onVisualDirectionChange={(value) =>
                  setPreferences({ ...preferences, visualDirection: value })
                }
                onToggleChannel={toggleChannel}
                onFiles={(files) => void addCaptureFiles(files)}
                onMoveCapture={moveCapture}
                onRemoveCapture={removeCapture}
                onUpdateCapture={updateCapture}
              />
              <div className="pf-action-row pf-direction-actions">
                <button
                  className="pf-secondary-button"
                  type="button"
                  onClick={() => setScreen("repository")}
                >
                  Back
                </button>
                <button
                  className="pf-primary-button"
                  type="button"
                  disabled={!projectReady}
                  onClick={() => {
                    setScreen("engine");
                    if (freshBridgeMode) void probeBridge();
                  }}
                >
                  Continue to engine <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          ) : screen === "engine" && freshBridgeMode ? (
            <BridgeGenerateStep
              view="engine"
              status={bridgeStatus}
              probing={bridgeProbing}
              pairing={pairing}
              job={bridgeJob}
              projectReady={projectReady}
              canStart={pairing === "paired" && projectReady}
              connectionError={bridgeError}
              fallbackMessage={fallbackMessage}
              onBack={() => setScreen("direction")}
              onContinue={() => setScreen("generate")}
              onProbe={() => void probeBridge()}
              onPair={() => void requestBridgePairing()}
              onStart={() => void startBridgeJob()}
              onCancel={() => void actOnBridgeJob("cancel")}
              onRetry={() => void actOnBridgeJob("retry")}
              onOpenLocal={openLocalWorkspaceWithProject}
            />
          ) : screen === "engine" ? (
            <LocalEngineStep
              creditAcknowledged={creditAcknowledged}
              runtime={runtime}
              runtimePending={runtimePending}
              onCreditAcknowledgedChange={setCreditAcknowledged}
              onBack={() => setScreen("direction")}
              onContinue={() => setScreen("generate")}
            />
          ) : screen === "generate" && freshBridgeMode ? (
            <BridgeGenerateStep
              view="generate"
              status={bridgeStatus}
              probing={bridgeProbing}
              pairing={pairing}
              job={bridgeJob}
              projectReady={projectReady}
              canStart={pairing === "paired" && projectReady}
              connectionError={bridgeError}
              fallbackMessage={fallbackMessage}
              onBack={() => setScreen("engine")}
              onContinue={() => setScreen("generate")}
              onProbe={() => void probeBridge()}
              onPair={() => void requestBridgePairing()}
              onStart={() => void startBridgeJob()}
              onCancel={() => void actOnBridgeJob("cancel")}
              onRetry={() => void actOnBridgeJob("retry")}
              onOpenLocal={openLocalWorkspaceWithProject}
            />
          ) : (
            <LocalGenerateStep
              busy={stage === "generating"}
              error={error}
              onBack={() => setScreen("engine")}
              onGenerate={() => void generate()}
            />
          )}
        </div>
      )}

      {!publicViewer ? (
        <LocalPairApproval
          pairing={pendingLocalPairing}
          busy={pairDecisionBusy}
          onDecision={(decision) => void decideLocalPairing(decision)}
        />
      ) : null}
    </>
  );
}

export function Workspace({ publicViewer }: { publicViewer: boolean }) {
  return (
    <main className="shell pf-shell" id="main-content">
      <LocalWorkspace publicViewer={publicViewer} />
      <footer className="pf-footer">
        <span>PitchFlow</span>
        <a href="/evidence">Build evidence</a>
      </footer>
    </main>
  );
}

export function EvidenceWorkspace() {
  return (
    <main className="shell evidence-shell" id="main-content">
      <AppHeader evidence />
      <EvidenceHero />
      <PublicViewer />
      <footer>
        <a href="/">Return to the PitchFlow workspace</a>
        <span>Claims stay attached to source.</span>
      </footer>
    </main>
  );
}
