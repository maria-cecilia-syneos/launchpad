import {
  getSourceLocationKey,
  normalizeSourceUrl,
  type SourceAccessState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
  type SourceLedgerSystem,
} from "./source-ledger";

export type CollaborationContextKind = "teams_thread" | "email_thread";

export type CollaborationSummaryCategory =
  | "decision"
  | "commitment"
  | "stakeholder_discussion"
  | "launch_signal"
  | "noise";

export type CollaborationGovernanceState = "allowed" | "blocked";

export type CollaborationRetentionState = "retained" | "expired";

export type CollaborationReasonState =
  | "access_restricted"
  | "connector_unavailable"
  | "governance_skipped"
  | "missing_information";

export type CollaborationSyncStatus = "completed" | "failed" | "skipped";

export type CollaborationSummaryRecord = {
  category: CollaborationSummaryCategory;
  isLaunchRelevant: boolean;
  summary: string;
};

export type CollaborationAdapterRecord = {
  accessState: SourceAccessState;
  contextKind: CollaborationContextKind;
  governanceState: CollaborationGovernanceState;
  lastActivityAt: string;
  objectId?: string;
  ownerOrSender?: string;
  retentionState: CollaborationRetentionState;
  sourceUrl?: string;
  summaries: CollaborationSummaryRecord[];
  threadLabel: string;
};

export type GovernedCollaborationContextRecord = {
  category: Exclude<CollaborationSummaryCategory, "noise">;
  contextRecordId: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: SourceLedgerSystem;
  sourceUrl?: string;
  summary: string;
  threadLabel: string;
};

export type CollaborationSyncAuditEvent = {
  actorId?: string;
  correlationId: string;
  eventId: string;
  eventType:
    | "source.sync_completed"
    | "source.sync_failed"
    | "source.sync_skipped";
  metadata: {
    contextRecordCount: number;
    freshnessState: SourceFreshnessState;
    ingestionStatus: SourceIngestionStatus;
    reasonState?: CollaborationReasonState;
    sourceId: string;
    sourceSystem: SourceLedgerSystem;
    syncStatus: CollaborationSyncStatus;
  };
  occurredAt: string;
  sourceSystem: SourceLedgerSystem;
  systemActor?: string;
};

export type GovernedCollaborationIngestionResult = {
  auditEvent: CollaborationSyncAuditEvent;
  contextRecords: GovernedCollaborationContextRecord[];
  correlationId: string;
  reasonState?: CollaborationReasonState;
  syncStatus: CollaborationSyncStatus;
  updatedSource: SourceLedgerRecord;
  userSafeReason?: string;
};

type BuildGovernedCollaborationIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  record: CollaborationAdapterRecord;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type BuildCollaborationSyncOutcomeInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  reasonState: CollaborationReasonState;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type RunPrototypeCollaborationIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  source: SourceLedgerRecord;
  systemActor?: string;
};

const collaborationReasonMessages: Record<CollaborationReasonState, string> = {
  access_restricted:
    "Access restricted. Collaboration details are not available for this user or role.",
  connector_unavailable:
    "Collaboration content could not be retrieved. Check connector availability and source access.",
  governance_skipped:
    "Collaboration sync was skipped by governance or retention policy.",
  missing_information:
    "Collaboration content is missing required launch-relevant summaries.",
};

function createTimestamp() {
  return new Date().toISOString();
}

function createSafeId(prefix: string, seed: string) {
  const normalized =
    seed
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "collaboration";

  return `${prefix}-${normalized}`;
}

function createUniqueId(prefix: string, seed: string) {
  return createSafeId(
    prefix,
    `${seed}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,
  );
}

export function canIngestGovernedCollaborationSource(
  source: SourceLedgerRecord,
) {
  if (
    source.approvalState !== "approved" ||
    source.accessState !== "authorized" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted"
  ) {
    return false;
  }

  return (
    (source.sourceSystem === "teams" && source.sourceType === "teams_channel") ||
    (source.sourceSystem === "email" && source.sourceType === "email_mailbox")
  );
}

export function buildGovernedCollaborationIngestionResult({
  actorId,
  correlationId,
  occurredAt,
  record,
  source,
  systemActor,
}: BuildGovernedCollaborationIngestionInput): GovernedCollaborationIngestionResult {
  if (!canIngestGovernedCollaborationSource(source)) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  if (record.accessState === "restricted") {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (record.governanceState === "blocked" || record.retentionState === "expired") {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "governance_skipped",
      source,
      systemActor,
    });
  }

  const contextRecords = buildGovernedContextRecords(source, record);

  if (contextRecords.length === 0) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const updatedSource = normalizeCollaborationSource(source, record);
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `collaboration-sync-${source.sourceId}`);
  const auditEvent = buildCollaborationSyncAuditEvent({
    actorId,
    contextRecordCount: contextRecords.length,
    correlationId: syncCorrelationId,
    occurredAt: syncOccurredAt,
    source: updatedSource,
    syncStatus: "completed",
    systemActor,
  });

  return {
    auditEvent,
    contextRecords,
    correlationId: syncCorrelationId,
    syncStatus: "completed",
    updatedSource,
  };
}

export function runPrototypeCollaborationIngestion({
  actorId,
  correlationId,
  occurredAt,
  source,
  systemActor,
}: RunPrototypeCollaborationIngestionInput): GovernedCollaborationIngestionResult {
  if (!canIngestGovernedCollaborationSource(source)) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const sourceKey = `${source.objectId ?? ""} ${source.sourceName}`.toLowerCase();

  if (sourceKey.includes("connector-failure")) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "connector_unavailable",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("access-restricted")) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("governance-skip")) {
    return buildCollaborationSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "governance_skipped",
      source,
      systemActor,
    });
  }

  return buildGovernedCollaborationIngestionResult({
    actorId,
    correlationId,
    occurredAt,
    record: createPrototypeCollaborationAdapterRecord(source),
    source,
    systemActor,
  });
}

export function getCollaborationIngestionResultMessage(
  result: GovernedCollaborationIngestionResult,
) {
  if (result.userSafeReason) {
    return result.userSafeReason;
  }

  const recordCount = result.contextRecords.length;
  const noun = recordCount === 1 ? "summary" : "summaries";

  return `${recordCount} governed collaboration ${noun} prepared for retrieval.`;
}

function buildCollaborationSyncOutcome({
  actorId,
  correlationId,
  occurredAt,
  reasonState,
  source,
  systemActor,
}: BuildCollaborationSyncOutcomeInput): GovernedCollaborationIngestionResult {
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `collaboration-sync-${source.sourceId}`);
  const syncStatus: CollaborationSyncStatus =
    reasonState === "connector_unavailable" ? "failed" : "skipped";
  const updatedSource = buildOutcomeSource(source, reasonState, syncOccurredAt);
  const auditEvent = buildCollaborationSyncAuditEvent({
    actorId,
    contextRecordCount: 0,
    correlationId: syncCorrelationId,
    occurredAt: syncOccurredAt,
    reasonState,
    source: updatedSource,
    syncStatus,
    systemActor,
  });

  return {
    auditEvent,
    contextRecords: [],
    correlationId: syncCorrelationId,
    reasonState,
    syncStatus,
    updatedSource,
    userSafeReason: collaborationReasonMessages[reasonState],
  };
}

function buildOutcomeSource(
  source: SourceLedgerRecord,
  reasonState: CollaborationReasonState,
  occurredAt: string,
): SourceLedgerRecord {
  if (reasonState === "access_restricted") {
    return {
      ...source,
      accessState: "restricted",
      freshnessState: "restricted",
      ingestionStatus: "restricted",
      lastRefreshedAt: occurredAt,
    };
  }

  if (reasonState === "connector_unavailable") {
    return {
      ...source,
      freshnessState: "stale",
      ingestionStatus: "failed",
      lastRefreshedAt: occurredAt,
    };
  }

  return {
    ...source,
    freshnessState: "watch",
    ingestionStatus: "incomplete",
    lastRefreshedAt: occurredAt,
  };
}

function normalizeCollaborationSource(
  source: SourceLedgerRecord,
  record: CollaborationAdapterRecord,
): SourceLedgerRecord {
  return {
    ...source,
    accessState: "authorized",
    freshnessState: "fresh",
    ingestionStatus: "complete",
    lastRefreshedAt: record.lastActivityAt,
    objectId: record.objectId?.trim() || source.objectId,
    owningTeam: record.ownerOrSender?.trim() || source.owningTeam,
    sourceName: record.threadLabel.trim() || source.sourceName,
    sourceUrl: normalizeSourceUrl(record.sourceUrl) ?? source.sourceUrl,
  };
}

function buildGovernedContextRecords(
  source: SourceLedgerRecord,
  record: CollaborationAdapterRecord,
): GovernedCollaborationContextRecord[] {
  const sourceLocationKey = getSourceLocationKey(source) ?? source.sourceId;
  const sourceObjectId = record.objectId?.trim() || source.objectId;
  const sourceUrl = normalizeSourceUrl(record.sourceUrl) ?? source.sourceUrl;
  const threadLabel = record.threadLabel.trim() || source.sourceName;

  return record.summaries
    .filter(
      (summary): summary is CollaborationSummaryRecord & {
        category: Exclude<CollaborationSummaryCategory, "noise">;
      } =>
        summary.isLaunchRelevant &&
        summary.category !== "noise" &&
        Boolean(summary.summary.trim()),
    )
    .map((summary, index) => ({
      category: summary.category,
      contextRecordId: createSafeId(
        "collab",
        `${source.sourceId}-${sourceLocationKey}-${index}`,
      ),
      sourceId: source.sourceId,
      sourceLocationKey,
      sourceObjectId,
      sourceSystem: source.sourceSystem,
      sourceUrl,
      summary: summary.summary.replace(/\s+/g, " ").trim(),
      threadLabel,
    }));
}

function buildCollaborationSyncAuditEvent({
  actorId,
  contextRecordCount,
  correlationId,
  occurredAt,
  reasonState,
  source,
  syncStatus,
  systemActor,
}: {
  actorId?: string;
  contextRecordCount: number;
  correlationId: string;
  occurredAt: string;
  reasonState?: CollaborationReasonState;
  source: SourceLedgerRecord;
  syncStatus: CollaborationSyncStatus;
  systemActor?: string;
}): CollaborationSyncAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createUniqueId(
      "evt",
      `${correlationId}-collaboration-sync-${source.sourceId}`,
    ),
    eventType: getAuditEventType(syncStatus),
    metadata: {
      contextRecordCount,
      freshnessState: source.freshnessState,
      ingestionStatus: source.ingestionStatus,
      reasonState,
      sourceId: source.sourceId,
      sourceSystem: source.sourceSystem,
      syncStatus,
    },
    occurredAt,
    sourceSystem: source.sourceSystem,
    systemActor: systemActor ?? (actorId ? undefined : "source-sync-service"),
  };
}

function getAuditEventType(syncStatus: CollaborationSyncStatus) {
  if (syncStatus === "completed") {
    return "source.sync_completed";
  }

  if (syncStatus === "failed") {
    return "source.sync_failed";
  }

  return "source.sync_skipped";
}

function createPrototypeCollaborationAdapterRecord(
  source: SourceLedgerRecord,
): CollaborationAdapterRecord {
  const isTeams = source.sourceSystem === "teams";

  return {
    accessState: "authorized",
    contextKind: isTeams ? "teams_thread" : "email_thread",
    governanceState: "allowed",
    lastActivityAt: "2026-05-21T14:00:00.000Z",
    objectId: source.objectId,
    ownerOrSender: source.owningTeam,
    retentionState: "retained",
    sourceUrl: source.sourceUrl,
    summaries: [
      {
        category: "decision",
        isLaunchRelevant: true,
        summary: `${source.sourceName} records an approved launch decision that can support source-backed answers.`,
      },
      {
        category: "commitment",
        isLaunchRelevant: true,
        summary:
          "The launch team captured a follow-up commitment with ownership and timing for readiness review.",
      },
      {
        category: "noise",
        isLaunchRelevant: false,
        summary: "Non-launch chatter omitted by governance filtering.",
      },
    ],
    threadLabel: source.sourceName,
  };
}
