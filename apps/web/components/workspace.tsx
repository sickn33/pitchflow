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
type Panel = "evidence" | "preview" | "copy" | "handoff";
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

const panels: Panel[] = ["evidence", "preview", "copy"];
const channelLabels: Record<CampaignPreferences["channels"][number], string> = {
  x: "X",
  linkedin: "LinkedIn",
  "product-hunt": "Product Hunt",
  email: "Email",
};

const defaultPreferences: CampaignPreferences = {
  audience: "Indie developers and open-source maintainers",
  positioning: "A developer tool with a concrete, evidence-backed reason to exist",
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

function AppHeader({ publicViewer }: { publicViewer: boolean }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PitchFlow home">
          <span className="brand-mark" aria-hidden="true">
            PF
          </span>
          <span>PitchFlow</span>
        </a>
        <div className="mode-pill" data-mode={publicViewer ? "viewer" : "local"}>
          <span className="pulse" aria-hidden="true" />
          <span className="mode-label-full">
            {publicViewer ? "Cached judge viewer" : "Local Codex workspace"}
          </span>
          <span className="mode-label-short" aria-hidden="true">
            {publicViewer ? "Judge viewer" : "Local workspace"}
          </span>
        </div>
      </header>
    </>
  );
}

function Hero() {
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
  hasExport,
  onChange,
}: {
  active: Panel;
  hasCampaign: boolean;
  hasExport: boolean;
  onChange: (panel: Panel) => void;
}) {
  const enabled = hasCampaign
    ? hasExport
      ? [...panels, "handoff" as const]
      : panels
    : (["evidence"] as Panel[]);
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
          {panel}
        </button>
      ))}
    </div>
  );
}

function HandoffPanel({ receipt }: { receipt: ExportReceipt }) {
  const outputs = [
    ["Microsite", "Responsive static site"],
    ["Social system", "OG, X, LinkedIn, Instagram"],
    ["Carousel", "Five 1080×1350 slides"],
    ["Channel copy", "X, LinkedIn, Product Hunt, email"],
    ["Landscape master", "1920×1080 H.264"],
    ["Portrait master", "1080×1920 H.264"],
    ["Integrity", "Asset index + SHA-256"],
    ["Archive", "Traversal-safe ZIP"],
  ] as const;
  return (
    <div
      className="handoff-view"
      id="campaign-panel-handoff"
      role="tabpanel"
      aria-labelledby="campaign-tab-handoff"
      data-receipt-sha256={receipt.sha256}
    >
      <header className="handoff-hero">
        <div>
          <p className="kicker">Verified export receipt</p>
          <h3>Your launch package is ready.</h3>
          <p>
            One evidence-linked manifest produced the complete handoff. The download remains local
            until you choose where to publish it.
          </p>
        </div>
        <div className="handoff-stat" aria-label={`${receipt.assetCount} indexed assets`}>
          <strong>{receipt.assetCount}</strong>
          <span>indexed assets</span>
        </div>
      </header>
      <ul className="handoff-grid" aria-label="Rendered package contents">
        {outputs.map(([label, detail], index) => (
          <li key={label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{label}</strong>
              <small>{detail}</small>
            </div>
            <span aria-hidden="true">✓</span>
          </li>
        ))}
      </ul>
      <footer className="handoff-footer">
        <div>
          <span>Downloaded package</span>
          <code>{receipt.filename}</code>
        </div>
        <div>
          <span>Integrity</span>
          <strong>SHA-256 recorded in asset-index.json</strong>
        </div>
      </footer>
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
    <div
      className="evidence-view"
      id="campaign-panel-evidence"
      role="tabpanel"
      aria-labelledby="campaign-tab-evidence"
      tabIndex={0}
    >
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
            id={`evidence-${item.id}`}
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
      id="campaign-panel-preview"
      role="tabpanel"
      aria-labelledby="campaign-tab-preview"
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

function CampaignCanvas({
  snapshot,
  campaign,
  stage,
  error,
  onDismissError,
  editable,
  onCampaignChange,
  exportReceipt,
}: {
  snapshot: RepoSnapshot | null;
  campaign: CampaignManifest | null;
  stage: Stage;
  error: string | null;
  onDismissError?: () => void;
  editable: boolean;
  onCampaignChange?: (campaign: CampaignManifest) => void;
  exportReceipt?: ExportReceipt | null;
}) {
  const [activePanel, setActivePanel] = useState<Panel>(snapshot ? "evidence" : "evidence");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const previousSnapshotId = useRef<string | null>(null);
  const previousCampaignId = useRef<string | null>(null);
  const previousExportSha = useRef<string | null>(null);

  useEffect(() => {
    if (snapshot && snapshot.id !== previousSnapshotId.current) {
      previousSnapshotId.current = snapshot.id;
      setSelectedEvidenceId(null);
      setActivePanel("evidence");
    }
  }, [snapshot]);

  useEffect(() => {
    if (campaign && campaign.id !== previousCampaignId.current) {
      previousCampaignId.current = campaign.id;
      setActivePanel("preview");
    }
  }, [campaign]);

  useEffect(() => {
    if (exportReceipt && exportReceipt.sha256 !== previousExportSha.current) {
      previousExportSha.current = exportReceipt.sha256;
      setActivePanel("handoff");
    }
  }, [exportReceipt]);

  function revealEvidence(id: string) {
    setSelectedEvidenceId(id);
    setActivePanel("evidence");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`evidence-${id}`);
        target?.focus();
        target?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      });
    });
  }

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

  function changeClaim(claimId: string, text: string) {
    if (!campaign || !onCampaignChange || text.trim().length === 0) return;
    onCampaignChange({
      ...campaign,
      claims: campaign.claims.map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              text,
              classification: "user_supplied",
              confidence: 1,
              approvalRequired: false,
              rationale: "Edited by the local user after generation; verify before publishing.",
            }
          : claim,
      ),
    });
  }

  function approveClaim(claimId: string) {
    if (!campaign || !onCampaignChange) return;
    onCampaignChange({
      ...campaign,
      claims: campaign.claims.map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              classification: "user_supplied",
              confidence: 1,
              approvalRequired: false,
              rationale: "Reviewed and approved by the local user after generation.",
            }
          : claim,
      ),
    });
  }

  return (
    <section
      className="canvas"
      aria-label="Campaign workspace"
      aria-busy={stage === "analyzing" || stage === "generating"}
    >
      <div className="canvas-toolbar">
        <Tabs
          active={activePanel}
          hasCampaign={Boolean(campaign)}
          hasExport={Boolean(exportReceipt)}
          onChange={setActivePanel}
        />
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
      ) : activePanel === "evidence" ? (
        <EvidencePanel snapshot={snapshot} selectedEvidenceId={selectedEvidenceId} />
      ) : campaign && activePanel === "preview" ? (
        <PreviewPanel
          campaign={campaign}
          editable={editable}
          onRevealEvidence={revealEvidence}
          onClaimChange={changeClaim}
          onApproveClaim={approveClaim}
        />
      ) : campaign && activePanel === "copy" ? (
        <CopyPanel campaign={campaign} editable={editable} onChange={changeCopy} />
      ) : campaign && exportReceipt && activePanel === "handoff" ? (
        <HandoffPanel receipt={exportReceipt} />
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
  return (
    <figure className="gallery-image-card">
      {/* This is a same-origin, immutable dogfood asset rather than reconstructed product UI. */}
      <img src={asset.href} alt={asset.label} loading="lazy" decoding="async" />
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
          <CampaignMediaGallery assets={dogfood.assets} />
          <div className="public-canvas-wrap">
            <CampaignCanvas
              snapshot={dogfood.snapshot}
              campaign={dogfood.campaign}
              stage="ready"
              error={null}
              editable={false}
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

function LocalWorkspace() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [campaign, setCampaign] = useState<CampaignManifest | null>(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
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
    const controller = new AbortController();
    void fetch("/api/status", { cache: "no-store", signal: controller.signal })
      .then((response) => parseApi<RuntimeStatus>(response))
      .then(setRuntime)
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      })
      .finally(() => setRuntimePending(false));
    return () => controller.abort();
  }, []);

  const analyzedLabel = useMemo(() => {
    if (!snapshot) return null;
    return `${snapshot.repository.owner}/${snapshot.repository.name} @ ${snapshot.commitSha.slice(0, 7)}`;
  }, [snapshot]);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSnapshot(null);
    setCampaign(null);
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

  function updateDesign(key: keyof CampaignManifest["design"], value: string | number) {
    if (!campaign) return;
    setExportReceipt(null);
    setCampaign({ ...campaign, design: { ...campaign.design, [key]: value } });
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

  const busy = stage === "analyzing" || stage === "generating" || exporting || processingCaptures;
  const canGenerate =
    Boolean(snapshot) &&
    !busy &&
    creditAcknowledged &&
    Boolean(runtime?.generationEnabled) &&
    preferences.channels.length > 0;
  const pendingInferenceCount =
    campaign?.claims.filter((claim) => claim.approvalRequired).length ?? 0;
  const capturesReady =
    captures.length >= MIN_CAPTURE_COUNT &&
    captures.length <= MAX_CAPTURE_COUNT &&
    captures.every(
      (capture) =>
        capture.label.trim().length >= 3 &&
        capture.description.trim().length >= 12 &&
        capture.provenance !== "",
    );

  return (
    <section className="workspace" aria-label="PitchFlow local generation workspace">
      <aside className="control-rail" aria-labelledby="controls-heading">
        <div className="rail-heading">
          <p className="kicker">Campaign input</p>
          <h2 id="controls-heading">Ground the story.</h2>
          <p>
            PitchFlow reads bounded public evidence. It never clones or executes submitted code.
          </p>
        </div>

        <form onSubmit={(event) => void analyze(event)} className="repo-form">
          <label htmlFor="repository-url">Canonical public GitHub URL</label>
          <input
            id="repository-url"
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            title="Enter a canonical URL such as https://github.com/owner/repository"
            required
            disabled={busy}
            autoComplete="url"
            aria-describedby="repository-hint"
          />
          <p className="field-hint" id="repository-hint">
            Public repositories only. Branch links, pull requests, and arbitrary hosts are rejected.
          </p>
          <button className="primary-button" type="submit" disabled={busy || !repositoryUrl.trim()}>
            {stage === "analyzing" ? (
              <>
                <span className="button-spinner" aria-hidden="true" /> Analyzing repository
              </>
            ) : (
              "Analyze repository"
            )}
          </button>
        </form>

        {snapshot ? (
          <div className="direction-form">
            <div className="commit-chip">
              <span>Analyzed</span>
              <code>{analyzedLabel}</code>
            </div>
            <div className="direction-heading">
              <p className="kicker">Creative direction</p>
              <p>Adjust the brief before GPT‑5.6 builds the evidence-linked campaign.</p>
            </div>
            <label htmlFor="audience">Primary audience</label>
            <input
              id="audience"
              value={preferences.audience}
              onChange={(event) => setPreferences({ ...preferences, audience: event.target.value })}
              disabled={stage === "generating"}
            />
            <label htmlFor="positioning">Positioning</label>
            <textarea
              id="positioning"
              value={preferences.positioning}
              onChange={(event) =>
                setPreferences({ ...preferences, positioning: event.target.value })
              }
              rows={4}
              disabled={stage === "generating"}
            />
            <label htmlFor="tone">Tone</label>
            <select
              id="tone"
              value={preferences.tone}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  tone: event.target.value as CampaignPreferences["tone"],
                })
              }
              disabled={stage === "generating"}
            >
              <option value="precise">Precise</option>
              <option value="bold">Bold</option>
              <option value="warm">Warm</option>
              <option value="technical">Technical</option>
              <option value="playful">Playful</option>
            </select>
            <fieldset className="channel-fieldset" disabled={stage === "generating"}>
              <legend>Launch channels</legend>
              <div>
                {(Object.keys(channelLabels) as CampaignPreferences["channels"]).map((channel) => (
                  <label key={channel}>
                    <input
                      type="checkbox"
                      checked={preferences.channels.includes(channel)}
                      onChange={() => toggleChannel(channel)}
                    />
                    <span>{channelLabels[channel]}</span>
                  </label>
                ))}
              </div>
              {preferences.channels.length === 0 ? (
                <p className="inline-warning">Choose at least one launch channel.</p>
              ) : null}
            </fieldset>
            {campaign ? (
              <fieldset className="design-fieldset" disabled={busy}>
                <legend>Campaign design</legend>
                <div className="design-controls">
                  <label>
                    Accent
                    <input
                      type="color"
                      value={campaign.design.accent}
                      onChange={(event) => updateDesign("accent", event.target.value)}
                    />
                  </label>
                  <label>
                    Background
                    <input
                      type="color"
                      value={campaign.design.background}
                      onChange={(event) => updateDesign("background", event.target.value)}
                    />
                  </label>
                </div>
                <label htmlFor="campaign-radius">Corner radius · {campaign.design.radius}px</label>
                <input
                  id="campaign-radius"
                  type="range"
                  min="0"
                  max="32"
                  value={campaign.design.radius}
                  onChange={(event) => updateDesign("radius", Number(event.target.value))}
                />
              </fieldset>
            ) : null}
            <label className="credit-check">
              <input
                type="checkbox"
                checked={creditAcknowledged}
                onChange={(event) => setCreditAcknowledged(event.target.checked)}
                disabled={stage === "generating"}
              />
              <span>
                Run GPT‑5.6 with my local Codex entitlement. No Platform API billing or credential
                copying.
              </span>
            </label>
            <button
              type="button"
              className="primary-button accent"
              onClick={() => void generate()}
              disabled={!canGenerate}
            >
              {stage === "generating" ? (
                <>
                  <span className="button-spinner dark" aria-hidden="true" /> Directing campaign
                </>
              ) : campaign ? (
                `Regenerate as version ${campaign.version + 1}`
              ) : (
                "Generate launch system"
              )}
            </button>
            {campaign ? (
              <>
                <CaptureAttachmentPanel
                  captures={captures}
                  disabled={stage === "generating" || exporting || processingCaptures}
                  error={captureError}
                  onFiles={(files) => void addCaptureFiles(files)}
                  onMove={moveCapture}
                  onRemove={removeCapture}
                  onUpdate={updateCapture}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void exportCampaign()}
                  disabled={busy || pendingInferenceCount > 0 || !capturesReady}
                >
                  {exporting ? (
                    <>
                      <span className="button-spinner" aria-hidden="true" /> Rendering full package
                    </>
                  ) : (
                    "Export captured launch package"
                  )}
                </button>
                <p className="runtime-note">
                  The local export renders your documented product UI into full-resolution 16:9 and
                  9:16 Remotion videos before the ZIP downloads. Keep this tab open for a few
                  minutes.
                </p>
                {pendingInferenceCount > 0 ? (
                  <p className="inline-warning" role="alert">
                    Review and approve {pendingInferenceCount} supported inference
                    {pendingInferenceCount === 1 ? "" : "s"} before export.
                  </p>
                ) : null}
              </>
            ) : null}
            {runtimePending ? (
              <p className="runtime-note" role="status">
                Checking local Codex authentication…
              </p>
            ) : null}
            {!runtimePending && runtime && !runtime.generationEnabled ? (
              <p className="inline-warning">
                Sign in to Codex locally, then reload this workspace to enable generation.
              </p>
            ) : null}
            {runtime?.codex?.authenticated ? (
              <p className="runtime-note">Codex authenticated · credential values were not read</p>
            ) : null}
          </div>
        ) : null}
      </aside>

      <CampaignCanvas
        snapshot={snapshot}
        campaign={campaign}
        stage={stage}
        error={error}
        onDismissError={() => setError(null)}
        editable
        onCampaignChange={(nextCampaign) => {
          setExportReceipt(null);
          setCampaign(nextCampaign);
        }}
        exportReceipt={exportReceipt}
      />
    </section>
  );
}

export function Workspace({ publicViewer }: { publicViewer: boolean }) {
  return (
    <main className="shell" id="main-content">
      <AppHeader publicViewer={publicViewer} />
      <Hero />
      {publicViewer ? <PublicViewer /> : <LocalWorkspace />}
      <footer>
        <span>PitchFlow · Built with Codex + GPT‑5.6</span>
        <span>Claims stay attached to source.</span>
      </footer>
    </main>
  );
}
