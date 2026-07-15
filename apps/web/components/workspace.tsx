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
  approveCampaignClaim,
  buildLocalWorkspaceDeepLink,
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
  assets,
  publicViewer,
  busy,
  error,
  onRepositoryUrlChange,
  onAnalyze,
  onTryDemo,
}: {
  repositoryUrl: string;
  assets: DogfoodAsset[];
  publicViewer: boolean;
  busy: boolean;
  error: string | null;
  onRepositoryUrlChange: (value: string) => void;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onTryDemo: () => void;
}) {
  return (
    <section className="product-hero" id="top" aria-labelledby="hero-heading">
      <div className="product-hero-left">
        <div className="product-hero-copy">
          <h1 id="hero-heading">
            Paste your repo. Get a launch-ready site, social kit, and product video.
          </h1>
          <p>
            PitchFlow understands your product from repository evidence and directs a complete
            launch campaign with GPT‑5.6.
          </p>
        </div>
        <form className="hero-repo-form" onSubmit={onAnalyze}>
          <label className="sr-only" htmlFor="repository-url">
            Public GitHub repository
          </label>
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
          />
          <div>
            <button type="submit" disabled={busy || !repositoryUrl.trim()}>
              {busy ? "Analyzing repository…" : "Analyze repository"}
            </button>
            <button className="demo-button" type="button" onClick={onTryDemo} disabled={busy}>
              <span aria-hidden="true">▶</span> Try the PitchFlow demo
            </button>
          </div>
          <p className="hero-input-contract">
            Then add 2–4 real product captures plus audience, positioning, tone, and visual
            direction.
          </p>
          {publicViewer ? (
            <p>Fresh repository analysis runs in the local PitchFlow workspace.</p>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
        </form>
      </div>
      <HeroMediaMontage assets={assets} />
    </section>
  );
}

function HeroMediaMontage({ assets }: { assets: DogfoodAsset[] }) {
  const gallery = selectDogfoodGalleryAssets(assets);
  const leadImage = gallery.socialGraphics[0] ?? gallery.productCaptures[0];
  if (!leadImage && !gallery.landscapeVideo && !gallery.portraitVideo) return null;
  const leadDimensions = leadImage ? getDogfoodImageDimensions(leadImage) : null;
  return (
    <div className="hero-media-montage" aria-label="Real outputs from the PitchFlow demo">
      {leadImage && leadDimensions ? (
        <img
          src={leadImage.href}
          alt={leadImage.label}
          width={leadDimensions.width}
          height={leadDimensions.height}
        />
      ) : null}
      {gallery.landscapeVideo ? (
        <video controls playsInline preload="metadata" aria-label={gallery.landscapeVideo.label}>
          <source src={gallery.landscapeVideo.href} type={gallery.landscapeVideo.mediaType} />
        </video>
      ) : null}
      {gallery.portraitVideo ? (
        <video controls playsInline preload="metadata" aria-label={gallery.portraitVideo.label}>
          <source src={gallery.portraitVideo.href} type={gallery.portraitVideo.mediaType} />
        </video>
      ) : null}
    </div>
  );
}

function ProductStepper({ activeStep }: { activeStep: number }) {
  const steps = ["Analyze", "Direct", "Generate", "Deliver", "Export"];
  return (
    <nav className="product-stepper" aria-label="PitchFlow workflow" tabIndex={0}>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          return (
            <li
              key={step}
              data-state={
                number < activeStep ? "complete" : number === activeStep ? "active" : "upcoming"
              }
            >
              <span>{number < activeStep ? "✓" : number}</span>
              <strong>{step}</strong>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ProductOutputs() {
  const outputs = ["Website", "Images", "Videos", "Copy", "Export"];
  return (
    <section className="product-outputs" aria-labelledby="product-outputs-heading">
      <p id="product-outputs-heading">What you get</p>
      <ul>
        {outputs.map((output) => (
          <li key={output}>{output}</li>
        ))}
      </ul>
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
            ? "Production images from the complete PitchFlow demo."
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
            ? "Play the landscape and portrait masters from the PitchFlow demo."
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

  return (
    <figure className="gallery-image-card">
      {/* This is a same-origin, immutable dogfood asset rather than reconstructed product UI. */}
      {dimensions ? (
        <img
          src={asset.href}
          alt={asset.label}
          loading="lazy"
          decoding="async"
          width={dimensions.width}
          height={dimensions.height}
          style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
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

function ProductUnderstanding({
  snapshot,
  campaign,
}: {
  snapshot: RepoSnapshot;
  campaign: CampaignManifest | null;
}) {
  const languages = Object.entries(snapshot.languages)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([language]) => language);
  const facts = snapshot.evidence
    .map((item) => item.normalizedFact)
    .filter((fact): fact is string => Boolean(fact))
    .slice(0, 4);

  return (
    <section className="product-step analyze-step" id="analyze" aria-labelledby="analyze-heading">
      <header className="step-heading">
        <span>01 · Analyze</span>
        <h2 id="analyze-heading">Here’s what PitchFlow understood.</h2>
        <p>
          {campaign?.productBrief.oneLiner ??
            snapshot.repository.description ??
            `${snapshot.repository.name} is ready for a clearer launch story.`}
        </p>
      </header>
      <div className="understanding-grid">
        <article>
          <span>Product</span>
          <strong>{campaign?.productBrief.productName ?? snapshot.repository.name}</strong>
          <p>{snapshot.repository.description ?? "Public repository"}</p>
        </article>
        <article>
          <span>Built with</span>
          <strong>{languages.length > 0 ? languages.join(" · ") : "Repository source"}</strong>
          <p>{snapshot.limits.discoveredFiles.toLocaleString()} files mapped</p>
        </article>
        <article>
          <span>For</span>
          <strong>
            {campaign?.productBrief.audience.join(" · ") ?? "The audience you choose next"}
          </strong>
          <p>{snapshot.repository.licenseSpdx ?? "Repository license not declared"}</p>
        </article>
      </div>
      {facts.length > 0 ? (
        <ul className="plain-fact-list" aria-label="Repository facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DemoCaptureStrip({ assets }: { assets: DogfoodAsset[] }) {
  const captures = selectDogfoodGalleryAssets(assets).productCaptures;
  if (captures.length === 0) return null;
  return (
    <div className="demo-capture-strip" aria-label="Real product captures in the demo">
      {captures.map((asset) => {
        const dimensions = getDogfoodImageDimensions(asset);
        return dimensions ? (
          <img
            key={asset.href}
            src={asset.href}
            alt={asset.label}
            width={dimensions.width}
            height={dimensions.height}
            loading="lazy"
          />
        ) : null;
      })}
    </div>
  );
}

function DirectionPanel({
  preferences,
  captures,
  demoAssets,
  publicViewer,
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
  demoAssets: DogfoodAsset[];
  publicViewer: boolean;
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
    <section className="product-step direct-step" id="direct" aria-labelledby="direct-heading">
      <header className="step-heading">
        <span>02 · Direct</span>
        <h2 id="direct-heading">Set the launch direction.</h2>
        <p>Choose who it is for, how it should land, and what the real product looks like.</p>
      </header>
      <div className="direction-workspace">
        <div className="direction-fields">
          <label htmlFor="audience">Primary audience</label>
          <input
            id="audience"
            value={preferences.audience}
            maxLength={240}
            onChange={(event) =>
              onPreferencesChange({ ...preferences, audience: event.target.value })
            }
            disabled={busy || publicViewer}
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
            disabled={busy || publicViewer}
          />
          <div className="direction-pair">
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
                disabled={busy || publicViewer}
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
                disabled={busy || publicViewer}
              />
            </label>
          </div>
          <fieldset className="channel-fieldset" disabled={busy || publicViewer}>
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
        </div>
        <div className="direction-captures">
          {publicViewer ? (
            <>
              <div className="demo-capture-heading">
                <span>Real product captures</span>
                <p>The demo campaign uses creator-owned screens from PitchFlow itself.</p>
              </div>
              <DemoCaptureStrip assets={demoAssets} />
            </>
          ) : (
            <CaptureAttachmentPanel
              captures={captures}
              disabled={busy}
              error={captureError}
              onFiles={onFiles}
              onMove={onMoveCapture}
              onRemove={onRemoveCapture}
              onUpdate={onUpdateCapture}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function GenerateStep({
  publicViewer,
  publicRepoHandoff,
  busy,
  campaign,
  canGenerate,
  creditAcknowledged,
  runtime,
  runtimePending,
  onCreditAcknowledgedChange,
  onGenerate,
}: {
  publicViewer: boolean;
  publicRepoHandoff: string | null;
  busy: boolean;
  campaign: CampaignManifest | null;
  canGenerate: boolean;
  creditAcknowledged: boolean;
  runtime: RuntimeStatus | null;
  runtimePending: boolean;
  onCreditAcknowledgedChange: (checked: boolean) => void;
  onGenerate: () => void;
}) {
  const [handoffCopied, setHandoffCopied] = useState(false);

  async function copyHandoff() {
    if (!publicRepoHandoff) return;
    await navigator.clipboard.writeText(publicRepoHandoff);
    setHandoffCopied(true);
    window.setTimeout(() => setHandoffCopied(false), 1800);
  }

  return (
    <section
      className="product-step generate-step"
      id="generate"
      aria-labelledby="generate-heading"
    >
      <header className="step-heading">
        <span>03 · Generate</span>
        <h2 id="generate-heading">
          {publicViewer
            ? "Run the creative direction through your Codex sign-in."
            : "Turn the brief into a launch campaign."}
        </h2>
        <p>
          {publicViewer
            ? "The public demo below was created through the same local workflow. Fresh generation stays on your machine."
            : "GPT‑5.6 turns the repository facts, your direction, and real screens into one structured campaign."}
        </p>
      </header>
      <div className="generate-handoff">
        {publicViewer ? (
          <div>
            <strong>
              {publicRepoHandoff
                ? "Your repository is ready for the local workspace."
                : "Open PitchFlow locally for a fresh repository."}
            </strong>
            <p>
              Your authenticated Codex workflow performs the generation without a public AI backend.
            </p>
            {publicRepoHandoff ? (
              <div className="handoff-steps">
                <div>
                  <span>1</span>
                  <p>Start the loopback-only local workspace.</p>
                  <code>pnpm pitchflow open</code>
                </div>
                <div>
                  <span>2</span>
                  <p>Open the preserved repository link after the launcher is ready.</p>
                  <div className="handoff-deep-link">
                    <a href={publicRepoHandoff}>{publicRepoHandoff}</a>
                    <button type="button" onClick={() => void copyHandoff()}>
                      {handoffCopied ? "Copied" : "Copy local link"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <code>pnpm pitchflow open</code>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="credit-check">
                <input
                  type="checkbox"
                  checked={creditAcknowledged}
                  onChange={(event) => onCreditAcknowledgedChange(event.target.checked)}
                  disabled={busy}
                />
                <span>Use my local Codex sign-in for GPT‑5.6 creative direction.</span>
              </label>
              <p className="runtime-note" role="status">
                {runtimePending
                  ? "Checking local Codex sign-in…"
                  : runtime?.generationEnabled
                    ? "Codex is ready for local generation."
                    : "Sign in to Codex locally, then reload to enable generation."}
              </p>
            </div>
            <button type="button" onClick={onGenerate} disabled={!canGenerate}>
              {busy
                ? "Generating campaign…"
                : campaign
                  ? `Regenerate campaign · v${campaign.version + 1}`
                  : "Generate campaign"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function LocalWorkspace({ publicViewer }: { publicViewer: boolean }) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [campaign, setCampaign] = useState<CampaignManifest | null>(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [demoAssets, setDemoAssets] = useState<DogfoodAsset[]>([]);
  const [showcaseAssets, setShowcaseAssets] = useState<DogfoodAsset[]>([]);
  const [publicRepoHandoff, setPublicRepoHandoff] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [runtimePending, setRuntimePending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditAcknowledged, setCreditAcknowledged] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [processingCaptures, setProcessingCaptures] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CaptureDraft[]>([]);
  const [exportReceipt, setExportReceipt] = useState<ExportReceipt | null>(null);

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
    if (!publicViewer) return;
    const controller = new AbortController();
    setStage("analyzing");
    void fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The PitchFlow demo could not be loaded.");
        return response.json() as Promise<unknown>;
      })
      .then(parseDogfoodPackage)
      .then((demo) => {
        setSnapshot(demo.snapshot);
        setCampaign(demo.campaign);
        setDemoAssets(demo.assets);
        setShowcaseAssets(demo.assets);
        setRepositoryUrl(demo.snapshot.repository.canonicalUrl);
        setPreferences({
          audience: demo.campaign.productBrief.audience.join(", "),
          positioning: demo.campaign.productBrief.positioning,
          visualDirection: `${demo.campaign.design.displayFont === "system-serif" ? "Editorial serif" : "Modern sans"}, ${demo.campaign.design.accent} accent, ${demo.campaign.design.radius}px corners`,
          tone: demo.campaign.productBrief.tone,
          channels: [...defaultPreferences.channels],
        });
        setStage("ready");
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setStage("idle");
        setError(caught instanceof Error ? caught.message : "The PitchFlow demo could not load.");
      });
    return () => controller.abort();
  }, [publicViewer]);

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
    const controller = new AbortController();
    void fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache", signal: controller.signal })
      .then(
        async (response): Promise<unknown> =>
          response.ok ? ((await response.json()) as unknown) : null,
      )
      .then((value: unknown) => {
        if (value) setShowcaseAssets(parseDogfoodPackage(value).assets);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [publicViewer]);

  async function loadDemo() {
    setError(null);
    setPublicRepoHandoff(null);
    setStage("analyzing");
    try {
      const response = await fetch(DOGFOOD_PACKAGE_URL, { cache: "force-cache" });
      if (!response.ok) throw new Error("The PitchFlow demo could not be loaded.");
      const demo = parseDogfoodPackage((await response.json()) as unknown);
      setSnapshot(demo.snapshot);
      setCampaign(demo.campaign);
      setDemoAssets(demo.assets);
      setShowcaseAssets(demo.assets);
      setRepositoryUrl(demo.snapshot.repository.canonicalUrl);
      setPreferences({
        audience: demo.campaign.productBrief.audience.join(", "),
        positioning: demo.campaign.productBrief.positioning,
        visualDirection: `${demo.campaign.design.displayFont === "system-serif" ? "Editorial serif" : "Modern sans"}, ${demo.campaign.design.accent} accent, ${demo.campaign.design.radius}px corners`,
        tone: demo.campaign.productBrief.tone,
        channels: [...defaultPreferences.channels],
      });
      setStage("ready");
      window.requestAnimationFrame(() =>
        document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (caught) {
      setStage("idle");
      setError(caught instanceof Error ? caught.message : "The PitchFlow demo could not load.");
    }
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (publicViewer) {
      try {
        const canonical = canonicalGitHubRepositoryUrl(repositoryUrl);
        setRepositoryUrl(canonical);
        setPublicRepoHandoff(buildLocalWorkspaceDeepLink(canonical));
        window.requestAnimationFrame(() =>
          document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
        );
      } catch (caught) {
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
    setCaptures([]);
    setCaptureError(null);
    setExportReceipt(null);
    setStage("analyzing");
    try {
      const payload = await parseApi<{ snapshot: RepoSnapshot }>(
        await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repositoryUrl }),
        }),
      );
      setSnapshot(payload.snapshot);
      setStage("review");
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
      setStage("ready");
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
  const demoMode = publicViewer || demoAssets.length > 0;
  const canGenerate =
    Boolean(snapshot) &&
    !busy &&
    !demoMode &&
    creditAcknowledged &&
    capturesReady &&
    preferences.visualDirection.trim().length >= 3 &&
    Boolean(runtime?.generationEnabled) &&
    preferences.channels.length > 0;
  const pendingInferenceCount = pendingClaimCount(campaign);
  const exportDisabled = busy || pendingInferenceCount > 0 || !capturesReady;
  const exportNote = demoMode
    ? null
    : pendingInferenceCount > 0
      ? `Review ${pendingInferenceCount} generated claim${pendingInferenceCount === 1 ? "" : "s"} before download.`
      : !capturesReady
        ? `Complete ${MIN_CAPTURE_COUNT}–${MAX_CAPTURE_COUNT} real product captures to download the package.`
        : "Rendering the videos and ZIP can take a few minutes. Keep this tab open.";
  const activeStep = exportReceipt
    ? 5
    : campaign
      ? 4
      : stage === "generating"
        ? 3
        : snapshot
          ? 2
          : 1;

  return (
    <>
      <ProductHero
        repositoryUrl={repositoryUrl}
        assets={showcaseAssets}
        publicViewer={publicViewer}
        busy={stage === "analyzing"}
        error={error}
        onRepositoryUrlChange={(value) => {
          setRepositoryUrl(value);
          setPublicRepoHandoff(null);
        }}
        onAnalyze={(event) => void analyze(event)}
        onTryDemo={() => void loadDemo()}
      />

      {publicViewer && campaign ? (
        <p className="demo-truthline">Interactive demo · generated from the PitchFlow repository</p>
      ) : null}
      <ProductStepper activeStep={activeStep} />
      <ProductOutputs />

      {stage === "analyzing" && !snapshot ? (
        <section className="product-loading" role="status">
          <span className="large-spinner" aria-hidden="true" />
          <h2>{publicViewer ? "Opening the PitchFlow demo…" : "Understanding the repository…"}</h2>
        </section>
      ) : null}

      {snapshot ? (
        <div className="product-intake-workbench">
          <ProductUnderstanding snapshot={snapshot} campaign={campaign} />
          <DirectionPanel
            preferences={preferences}
            captures={captures}
            demoAssets={demoAssets}
            publicViewer={demoMode}
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
        </div>
      ) : null}

      {snapshot ? (
        <GenerateStep
          publicViewer={demoMode}
          publicRepoHandoff={publicRepoHandoff}
          busy={stage === "generating"}
          campaign={campaign}
          canGenerate={canGenerate}
          creditAcknowledged={creditAcknowledged}
          runtime={runtime}
          runtimePending={runtimePending}
          onCreditAcknowledgedChange={setCreditAcknowledged}
          onGenerate={() => void generate()}
        />
      ) : null}

      {campaign ? (
        <section
          className="product-step deliver-step"
          id="deliver"
          aria-labelledby="deliver-heading"
        >
          <header className="step-heading">
            <span>04 · Deliver</span>
            <h2 id="deliver-heading">
              {demoMode
                ? "Explore the finished PitchFlow demo."
                : exportReceipt
                  ? "Your launch package is ready."
                  : "Review the campaign plan before rendering."}
            </h2>
            <p>
              {demoMode
                ? "Every image and video here is a real rendered output from the PitchFlow dogfood campaign."
                : exportReceipt
                  ? "The complete website, images, videos, copy, and manifest have been downloaded."
                  : "Website and copy are editable now. Images are creative previews and videos are storyboards until export."}
            </p>
          </header>
          <CampaignCanvas
            snapshot={snapshot}
            campaign={campaign}
            assets={demoAssets}
            stage={stage}
            error={null}
            editable={!demoMode}
            onCampaignChange={(nextCampaign) => {
              setExportReceipt(null);
              setCampaign(nextCampaign);
            }}
            exportReceipt={exportReceipt}
            exporting={exporting}
            exportDisabled={exportDisabled}
            exportNote={exportNote}
            onExport={() => void exportCampaign()}
          />
        </section>
      ) : null}
    </>
  );
}

export function Workspace({ publicViewer }: { publicViewer: boolean }) {
  return (
    <main className="shell" id="main-content">
      <AppHeader />
      <LocalWorkspace publicViewer={publicViewer} />
      <footer className="product-footer">
        <span>PitchFlow</span>
        <a href="/evidence">View product evidence</a>
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
