import { ExternalLink, Lock, RefreshCw, ShieldCheck } from "lucide-react";

import {
  accessStateLabels,
  approvalStateLabels,
  freshnessStateLabels,
  ingestionStatusLabels,
  normalizeSourceUrl,
  type VisibleSourceLedgerRecord,
} from "@/domain/source-ledger";

type SourceLedgerResultProps = {
  canRunIngestion?: boolean;
  ingestionSummary?: string;
  isIngesting?: boolean;
  onRunIngestion?: () => void;
  source: VisibleSourceLedgerRecord;
};

export function SourceLedgerResult({
  canRunIngestion = false,
  ingestionSummary,
  isIngesting = false,
  onRunIngestion,
  source,
}: SourceLedgerResultProps) {
  const AccessIcon = source.isRedacted ? Lock : ShieldCheck;
  const safeSourceUrl = normalizeSourceUrl(source.sourceUrl);

  return (
    <article
      aria-label={source.displayName}
      className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-6"
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
        </div>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SourceTerm label="Source system" value={source.displaySourceSystem} />
        <SourceTerm label="Source type" value={source.displaySourceType} />
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
      </dl>

      <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
        {source.statusMessage}
      </p>

      {ingestionSummary ? (
        <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
          {ingestionSummary}
        </p>
      ) : null}
    </article>
  );
}

function SourceTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd>
        {label}: {value}
      </dd>
    </div>
  );
}
