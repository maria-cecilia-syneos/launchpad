import { useId, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  accessStateLabels,
  approvalStateLabels,
  freshnessStateLabels,
  ingestionStatusLabels,
  normalizeSourceUrl,
  sourceLinkHealthLabels,
  type SourceLedgerSearchResult,
} from "@/domain/source-ledger";

type SourceLedgerResultProps = {
  canRunIngestion?: boolean;
  ingestionSummary?: string;
  isIngesting?: boolean;
  onRunIngestion?: () => void;
  source: SourceLedgerSearchResult;
};

export function SourceLedgerResult({
  canRunIngestion = false,
  ingestionSummary,
  isIngesting = false,
  onRunIngestion,
  source,
}: SourceLedgerResultProps) {
  const detailsId = useId();
  const [isInspecting, setIsInspecting] = useState(false);
  const AccessIcon = source.isRedacted ? Lock : ShieldCheck;
  const safeSourceUrl = source.isRedacted
    ? undefined
    : normalizeSourceUrl(source.sourceUrl);
  const sourceAnchorId = getSourceAnchorId(safeSourceUrl, source.sourceKey);
  const detailsButtonLabel = `${
    isInspecting ? "Hide" : "Show"
  } details for ${source.displayName}`;

  return (
    <article
      aria-label={source.displayName}
      className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-6"
      id={sourceAnchorId}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-syneos-teal">
            <AccessIcon aria-hidden="true" className="h-4 w-4" />
            Source Ledger record
          </p>
          <h3 className="text-base font-semibold">{source.displayName}</h3>
          <p className="text-muted-foreground">
            Owner: {source.displayOwner}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canRunIngestion ? (
            <button
              aria-label={`Run ingestion for ${source.displayName}`}
              className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-2 font-medium text-syneos-teal hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-teal disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isIngesting}
              onClick={onRunIngestion}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              {isIngesting ? "Syncing" : "Run ingestion"}
            </button>
          ) : null}

          {safeSourceUrl ? (
            <a
              aria-label={`Open source: ${source.displayName}`}
              className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-2 font-medium text-syneos-orange underline-offset-4 hover:underline"
              href={safeSourceUrl}
            >
              Open source
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          ) : null}

          <button
            aria-controls={detailsId}
            aria-expanded={isInspecting}
            aria-label={detailsButtonLabel}
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-2 font-medium text-syneos-teal hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-teal"
            onClick={() => setIsInspecting((current) => !current)}
            type="button"
          >
            Details
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform ${
                isInspecting ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SourceTerm label="Source system" value={source.displaySourceSystem} />
        <SourceTerm label="Source type" value={source.displaySourceType} />
        <SourceTerm
          label="Content category"
          value={source.displayContentCategory}
        />
        <SourceTerm
          label="Approval"
          value={approvalStateLabels[source.approvalState]}
        />
        <SourceTerm
          label="Freshness"
          value={freshnessStateLabels[source.freshnessState]}
        />
        <SourceTerm label="Access" value={accessStateLabels[source.accessState]} />
        <SourceTerm
          label="Ingestion"
          value={ingestionStatusLabels[source.ingestionStatus]}
        />
        <SourceTerm
          label="Source-link health"
          value={sourceLinkHealthLabels[source.sourceLinkHealth]}
        />
        <SourceTerm label="Approved for use" value={source.displayTrainingUse} />
        <SourceTerm
          label="Launch or workstream"
          value={source.displayLaunchOrWorkstream}
        />
        <SourceTerm label="Last refreshed" value={source.displayLastRefreshed} />
      </dl>

      <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
        {source.statusMessage}
      </p>

      <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
        {source.relevanceSummary}
      </p>

      <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
        {source.matchRationale}
      </p>

      {source.trainingImpact ? (
        <section
          aria-label={`Training impact for ${source.displayName}`}
          className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground"
        >
          <p className="font-medium text-foreground">
            {source.trainingImpact.changedContentTypeLabel}:{" "}
            {source.trainingImpact.displayChangedContent}
          </p>
          <p>
            Impacted content location:{" "}
            {source.trainingImpact.displayMatchLocation}
          </p>
          <p>{source.trainingImpact.displayMatchContext}</p>
          {source.trainingImpact.approvedReplacement ? (
            <p>
              Approved replacement source:{" "}
              {source.trainingImpact.approvedReplacement.title} (
              {source.trainingImpact.approvedReplacement.trainingUseLabel}).
            </p>
          ) : null}
          {source.trainingImpact.alternativeSources.length > 0 ? (
            <p>
              Draft or unapproved alternative:{" "}
              {source.trainingImpact.alternativeSources
                .map(
                  (alternative) =>
                    `${alternative.title} (${alternative.trainingUseLabel})`,
                )
                .join(", ")}
              .
            </p>
          ) : null}
        </section>
      ) : null}

      {ingestionSummary ? (
        <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
          {ingestionSummary}
        </p>
      ) : null}

      {isInspecting ? (
        <div
          className="mt-3 rounded-md border border-border bg-card p-3"
          id={detailsId}
          aria-label={`Source details for ${source.displayName}`}
          role="group"
        >
          <h4 className="text-sm font-semibold">Source details</h4>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <SourceDetailTerm label="Source title" value={source.displayName} />
            <SourceDetailTerm
              label="Source system"
              value={source.displaySourceSystem}
            />
            <SourceDetailTerm
              label="Source type"
              value={source.displaySourceType}
            />
            <SourceDetailTerm
              label="Content category"
              value={source.displayContentCategory}
            />
            <SourceDetailTerm label="Owner" value={source.displayOwner} />
            <SourceDetailTerm
              label="Approval"
              value={approvalStateLabels[source.approvalState]}
            />
            <SourceDetailTerm
              label="Freshness"
              value={freshnessStateLabels[source.freshnessState]}
            />
            <SourceDetailTerm
              label="Access"
              value={accessStateLabels[source.accessState]}
            />
            <SourceDetailTerm
              label="Ingestion"
              value={ingestionStatusLabels[source.ingestionStatus]}
            />
            <SourceDetailTerm
              label="Ingestion history"
              value={source.ingestionHistorySummary}
            />
            <SourceDetailTerm
              label="Source-link health"
              value={sourceLinkHealthLabels[source.sourceLinkHealth]}
            />
            <SourceDetailTerm
              label="Approved for use"
              value={source.displayTrainingUse}
            />
            <SourceDetailTerm
              label="Linked launch or asset context"
              value={source.displayLaunchOrWorkstream}
            />
            <SourceDetailTerm
              label="Relevance"
              value={source.relevanceSummary}
            />
            {source.displaySourceId ? (
              <SourceDetailTerm
                label="Source ID"
                value={source.displaySourceId}
              />
            ) : null}
            {source.displayObjectId ? (
              <SourceDetailTerm
                label="Object ID"
                value={source.displayObjectId}
              />
            ) : null}
            {source.registeredAt ? (
              <SourceDetailTerm
                label="Registered"
                value={source.registeredAt}
              />
            ) : null}
            <SourceDetailTerm
              label="Last refreshed"
              value={source.displayLastRefreshed}
            />
            <SourceDetailTerm
              label="Match rationale"
              value={source.matchRationale}
            />
            {source.trainingImpact ? (
              <>
                <SourceDetailTerm
                  label="Impacted content type"
                  value={source.trainingImpact.changedContentTypeLabel}
                />
                <SourceDetailTerm
                  label="Impacted content"
                  value={source.trainingImpact.displayChangedContent}
                />
                <SourceDetailTerm
                  label="Impacted content location"
                  value={source.trainingImpact.displayMatchLocation}
                />
                <SourceDetailTerm
                  label="Impact context"
                  value={source.trainingImpact.displayMatchContext}
                />
                {source.trainingImpact.approvedReplacement ? (
                  <SourceDetailTerm
                    label="Approved replacement source"
                    value={`${source.trainingImpact.approvedReplacement.title} (${source.trainingImpact.approvedReplacement.trainingUseLabel})`}
                  />
                ) : null}
              </>
            ) : null}
            <SourceDetailTerm
              label="Next useful action"
              value={source.nextAction}
            />
            {safeSourceUrl ? (
              <SourceDetailLinkTerm
                href={safeSourceUrl}
                label="Authorized source link"
                sourceTitle={source.displayName}
              />
            ) : null}
          </dl>
        </div>
      ) : null}
    </article>
  );
}

function SourceTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="[overflow-wrap:anywhere]">
        {label}: {value}
      </dd>
    </div>
  );
}

function getSourceAnchorId(safeSourceUrl: string | undefined, sourceKey: string) {
  const fragment = safeSourceUrl?.split("#")[1]?.trim();

  return fragment || sourceKey;
}

function SourceDetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="[overflow-wrap:anywhere]">
        {label}: {value}
      </dd>
    </div>
  );
}

function SourceDetailLinkTerm({
  href,
  label,
  sourceTitle,
}: {
  href: string;
  label: string;
  sourceTitle: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="[overflow-wrap:anywhere]">
        {label}:{" "}
        <a
          aria-label={`${label}: ${sourceTitle}`}
          className="font-medium text-syneos-orange underline-offset-4 hover:underline"
          href={href}
        >
          {href}
        </a>
      </dd>
    </div>
  );
}
