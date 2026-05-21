"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Database, PlusCircle } from "lucide-react";

import {
  approvalStateLabels,
  buildSourceRegistrationAuditEvent,
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
  filterVisibleSourceRecords,
  freshnessStateLabels,
  hasSameSourceLedgerLocation,
  ingestionStatusLabels,
  sourceSystemLabels,
  sourceTypesBySystem,
  sourceTypeLabels,
  validateSourceRegistration,
  type SourceAccessState,
  type SourceApprovalState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
  type SourceLedgerSourceType,
  type SourceLedgerSystem,
  type SourceRegistrationAuditEvent,
} from "@/domain/source-ledger";
import {
  canIngestMicrosoftDocumentSource,
  getSourceIngestionResultMessage,
  runPrototypeMicrosoftDocumentIngestion,
  type SourceSyncAuditEvent,
} from "@/domain/source-ingestion";
import {
  canIngestGovernedCollaborationSource,
  getCollaborationIngestionResultMessage,
  runPrototypeCollaborationIngestion,
  type CollaborationSyncAuditEvent,
} from "@/domain/collaboration-ingestion";
import {
  canIngestSalesforceSource,
  getSalesforceIngestionResultMessage,
  runPrototypeSalesforceIngestion,
  type SalesforceSyncAuditEvent,
} from "@/domain/salesforce-ingestion";
import {
  canIngestLaunchArtifactSource,
  getLaunchArtifactIngestionResultMessage,
  runPrototypeLaunchArtifactIngestion,
  type LaunchArtifactSyncAuditEvent,
} from "@/domain/launch-artifact-ingestion";
import type { WorkspaceSession } from "@/domain/workspace";

import { SourceLedgerResult } from "./SourceLedgerResult";

type SourceLedgerPanelProps = {
  initialSources?: SourceLedgerRecord[];
  onSourceAuditEvent?: (
    event:
      | SourceRegistrationAuditEvent
      | SourceSyncAuditEvent
      | CollaborationSyncAuditEvent
      | SalesforceSyncAuditEvent
      | LaunchArtifactSyncAuditEvent,
  ) => void;
  session: WorkspaceSession;
  viewState?: "ready" | "loading" | "error";
};

type SourceLedgerAuditEvent =
  | SourceRegistrationAuditEvent
  | SourceSyncAuditEvent
  | CollaborationSyncAuditEvent
  | SalesforceSyncAuditEvent
  | LaunchArtifactSyncAuditEvent;

type RegistrationFormState = {
  sourceName: string;
  owningTeam: string;
  sourceSystem: SourceLedgerSystem;
  sourceType: SourceLedgerSourceType;
  approvalState: SourceApprovalState;
  freshnessState: SourceFreshnessState;
  accessState: SourceAccessState;
  ingestionStatus: SourceIngestionStatus;
  sourceUrl: string;
  objectId: string;
};

const sourceSystemOptions: SourceLedgerSystem[] = [
  "sharepoint",
  "word_pdf",
  "teams",
  "email",
  "ecrm_salesforce",
  "smartsheet",
  "playbook",
  "asset",
  "task",
  "handoff",
];

const approvalStateOptions: SourceApprovalState[] = [
  "approved",
  "draft",
  "restricted",
  "stale",
  "inactive",
];

const freshnessStateOptions: SourceFreshnessState[] = [
  "fresh",
  "watch",
  "stale",
  "restricted",
];

const accessStateOptions: SourceAccessState[] = ["authorized", "restricted"];

const ingestionStatusOptions: SourceIngestionStatus[] = [
  "ready",
  "not_started",
  "syncing",
  "complete",
  "incomplete",
  "failed",
  "stale",
  "restricted",
];

const initialFormState: RegistrationFormState = {
  accessState: "authorized",
  approvalState: "approved",
  freshnessState: "fresh",
  ingestionStatus: "ready",
  owningTeam: "",
  sourceName: "",
  sourceSystem: "sharepoint",
  sourceType: "sharepoint_site",
  sourceUrl: "",
  objectId: "",
};

const defaultPrototypeSourceRecords = createPrototypeSourceRecords();

export function SourceLedgerPanel({
  initialSources = defaultPrototypeSourceRecords,
  onSourceAuditEvent,
  session,
  viewState = "ready",
}: SourceLedgerPanelProps) {
  const localSourceIds = useRef(new Set<string>());
  const [, setAuditEvents] = useState<SourceLedgerAuditEvent[]>([]);
  const [ingestionMessages, setIngestionMessages] = useState<
    Record<string, string>
  >({});
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [sources, setSources] = useState(() => initialSources);
  const [formState, setFormState] =
    useState<RegistrationFormState>(initialFormState);
  const [statusMessage, setStatusMessage] = useState("");
  const isAdmin = session.user.role === "admin";
  const visibleSources = useMemo(
    () => filterVisibleSourceRecords(sources, session.user.role),
    [session.user.role, sources],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.sourceId, source])),
    [sources],
  );
  const hasOnlyRestrictedDetails =
    viewState === "ready" &&
    sources.length > 0 &&
    visibleSources.every((source) => source.isRedacted);

  useEffect(() => {
    setSources((currentSources) => {
      const currentById = new Map(
        currentSources.map((source) => [source.sourceId, source]),
      );
      const nextSources = initialSources.map((source) =>
        localSourceIds.current.has(source.sourceId)
          ? currentById.get(source.sourceId) ?? source
          : source,
      );
      const nextSourceIds = new Set(
        nextSources.map((source) => source.sourceId),
      );

      for (const source of currentSources) {
        if (
          localSourceIds.current.has(source.sourceId) &&
          !nextSourceIds.has(source.sourceId)
        ) {
          nextSources.push(source);
          nextSourceIds.add(source.sourceId);
        }
      }

      return nextSources;
    });
  }, [initialSources]);

  function updateFormField<Key extends keyof RegistrationFormState>(
    key: Key,
    value: RegistrationFormState[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSourceSystemChange(value: string) {
    const sourceSystem = value as SourceLedgerSystem;

    setFormState((current) => ({
      ...current,
      sourceSystem,
      sourceType: sourceTypesBySystem[sourceSystem][0],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = {
      ...formState,
      objectId: formState.objectId || undefined,
      sourceUrl: formState.sourceUrl || undefined,
    };
    const validationErrors = validateSourceRegistration(input);

    if (validationErrors.length > 0) {
      setStatusMessage(validationErrors.join(" "));
      return;
    }

    const record = buildSourceRegistrationRecord(input);
    const matchingSource = sources.find(
      (source) => hasSameSourceLedgerLocation(source, record),
    );
    const storedRecord = matchingSource
      ? {
          ...record,
          registeredAt: matchingSource.registeredAt,
          sourceId: matchingSource.sourceId,
        }
      : record;
    const auditEvent = buildSourceRegistrationAuditEvent({
      action: matchingSource ? "updated" : "created",
      actorId: session.user.name,
      record: storedRecord,
    });

    try {
      setAuditEvents((current) => [...current, auditEvent]);
      onSourceAuditEvent?.(auditEvent);
      localSourceIds.current.add(storedRecord.sourceId);
      setSources((currentSources) => {
        const currentIndex = currentSources.findIndex(
          (source) =>
            hasSameSourceLedgerLocation(source, storedRecord),
        );

        if (currentIndex === -1) {
          return [storedRecord, ...currentSources];
        }

        return currentSources.map((source, index) =>
          index === currentIndex ? storedRecord : source,
        );
      });
      setStatusMessage(
        matchingSource
          ? "Source updated in Source Ledger."
          : "Source registered in Source Ledger.",
      );
      setFormState(initialFormState);
    } catch {
      setStatusMessage("Source could not be saved because audit recording failed.");
    }
  }

  function handleRunIngestion(source: SourceLedgerRecord) {
    if (!canRunSourceIngestion(source)) {
      setStatusMessage(
        "Only approved, authorized SharePoint, Word, PDF, Teams, email, Salesforce, or structured launch artifact sources can be ingested.",
      );
      return;
    }

    setSyncingSourceId(source.sourceId);
    setStatusMessage(
      `Applying governance constraints and retrieving source context for ${source.sourceName}.`,
    );

    try {
      const { auditEvent, message, updatedSource } = runSourceIngestion(
        source,
        session.user.name,
      );

      setAuditEvents((current) => [...current, auditEvent]);
      onSourceAuditEvent?.(auditEvent);
      localSourceIds.current.add(updatedSource.sourceId);
      setSources((currentSources) =>
        currentSources.map((currentSource) =>
          currentSource.sourceId === updatedSource.sourceId
            ? updatedSource
            : currentSource,
        ),
      );
      setIngestionMessages((current) => ({
        ...current,
        [updatedSource.sourceId]: message,
      }));
      setStatusMessage(message);
    } catch {
      setStatusMessage(
        "Source sync could not be saved because audit recording failed.",
      );
    } finally {
      setSyncingSourceId(null);
    }
  }

  return (
    <section aria-labelledby="source-ledger-title" className="grid gap-4">
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
          <Database aria-hidden="true" className="h-4 w-4" />
          Source Ledger
        </p>
        <h2 className="text-2xl font-semibold tracking-normal" id="source-ledger-title">
          Source Ledger
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Governed source inventory with provenance, approval, access,
          freshness, and ingestion status.
        </p>
      </div>

      {viewState === "loading" ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-3 text-sm"
          role="status"
        >
          Retrieving sources and checking access.
        </div>
      ) : null}

      {viewState === "error" ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Source Ledger could not load. Try refreshing source status.
        </div>
      ) : null}

      {isAdmin ? (
        <form
          aria-label="Register enterprise source"
          className="rounded-lg border border-border bg-card p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="mb-4 flex items-center gap-2">
            <PlusCircle aria-hidden="true" className="h-4 w-4 text-syneos-orange" />
            <h3 className="font-semibold">Register source location</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Source name
              <input
                className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  updateFormField("sourceName", event.target.value)
                }
                value={formState.sourceName}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Owning team
              <input
                className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  updateFormField("owningTeam", event.target.value)
                }
                value={formState.owningTeam}
              />
            </label>
            <SourceSelect
              label="Source system"
              onChange={handleSourceSystemChange}
              options={sourceSystemOptions.map((value) => ({
                label: sourceSystemLabels[value],
                value,
              }))}
              value={formState.sourceSystem}
            />
            <SourceSelect
              label="Source type"
              onChange={(value) =>
                updateFormField("sourceType", value as SourceLedgerSourceType)
              }
              options={sourceTypesBySystem[formState.sourceSystem].map((value) => ({
                label: sourceTypeLabels[value],
                value,
              }))}
              value={formState.sourceType}
            />
            <SourceSelect
              label="Approval state"
              onChange={(value) =>
                updateFormField("approvalState", value as SourceApprovalState)
              }
              options={approvalStateOptions.map((value) => ({
                label: approvalStateLabels[value],
                value,
              }))}
              value={formState.approvalState}
            />
            <SourceSelect
              label="Freshness state"
              onChange={(value) =>
                updateFormField("freshnessState", value as SourceFreshnessState)
              }
              options={freshnessStateOptions.map((value) => ({
                label: freshnessStateLabels[value],
                value,
              }))}
              value={formState.freshnessState}
            />
            <SourceSelect
              label="Access state"
              onChange={(value) =>
                updateFormField("accessState", value as SourceAccessState)
              }
              options={accessStateOptions.map((value) => ({
                label: value === "authorized" ? "Authorized" : "Restricted",
                value,
              }))}
              value={formState.accessState}
            />
            <SourceSelect
              label="Ingestion status"
              onChange={(value) =>
                updateFormField("ingestionStatus", value as SourceIngestionStatus)
              }
              options={ingestionStatusOptions.map((value) => ({
                label: ingestionStatusLabels[value],
                value,
              }))}
              value={formState.ingestionStatus}
            />
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Source link
              <input
                className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  updateFormField("sourceUrl", event.target.value)
                }
                placeholder="/sources#approved-source"
                value={formState.sourceUrl}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Object ID
              <input
                className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  updateFormField("objectId", event.target.value)
                }
                placeholder="enterprise-source-object-id"
                value={formState.objectId}
              />
            </label>
          </div>

          <button
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-syneos-orange px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-orange"
            type="submit"
          >
            Register source
          </button>
        </form>
      ) : null}

      {statusMessage ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {statusMessage}
        </div>
      ) : null}

      {viewState === "ready" && visibleSources.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No registered sources yet. Add an approved source location to prepare
          for ingestion.
        </div>
      ) : null}

      {hasOnlyRestrictedDetails ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Sources exist, but no accessible source details are available for this
          role.
        </div>
      ) : null}

      {visibleSources.length > 0 ? (
        <div aria-label="Registered source records" className="grid gap-3">
          {visibleSources.map((source) => {
            const sourceRecord = sourceById.get(source.sourceKey);
            const canRunIngestion =
              isAdmin &&
              sourceRecord !== undefined &&
              canRunSourceIngestion(sourceRecord);

            return (
              <SourceLedgerResult
                canRunIngestion={canRunIngestion}
                ingestionSummary={ingestionMessages[source.sourceKey]}
                isIngesting={syncingSourceId === source.sourceKey}
                key={source.sourceKey}
                onRunIngestion={
                  sourceRecord ? () => handleRunIngestion(sourceRecord) : undefined
                }
                source={source}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function canRunSourceIngestion(source: SourceLedgerRecord) {
  return (
    canIngestMicrosoftDocumentSource(source) ||
    canIngestGovernedCollaborationSource(source) ||
    canIngestSalesforceSource(source) ||
    canIngestLaunchArtifactSource(source)
  );
}

function runSourceIngestion(source: SourceLedgerRecord, actorId: string) {
  if (canIngestLaunchArtifactSource(source)) {
    const result = runPrototypeLaunchArtifactIngestion({
      actorId,
      source,
    });

    return {
      auditEvent: result.auditEvent,
      message: getLaunchArtifactIngestionResultMessage(result),
      updatedSource: result.updatedSource,
    };
  }

  if (canIngestSalesforceSource(source)) {
    const result = runPrototypeSalesforceIngestion({
      actorId,
      source,
    });

    return {
      auditEvent: result.auditEvent,
      message: getSalesforceIngestionResultMessage(result),
      updatedSource: result.updatedSource,
    };
  }

  if (canIngestGovernedCollaborationSource(source)) {
    const result = runPrototypeCollaborationIngestion({
      actorId,
      source,
    });

    return {
      auditEvent: result.auditEvent,
      message: getCollaborationIngestionResultMessage(result),
      updatedSource: result.updatedSource,
    };
  }

  const result = runPrototypeMicrosoftDocumentIngestion({
    actorId,
    source,
  });

  return {
    auditEvent: result.auditEvent,
    message: getSourceIngestionResultMessage(result),
    updatedSource: result.updatedSource,
  };
}

function SourceSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select
        className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
