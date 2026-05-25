import {
  type SourceBackedAnswer,
  type SourceBackedAnswerState,
  type SourceCitation,
} from "./answer";
import {
  type NormalizedLaunchTaskRecord,
  type NormalizedLaunchTaskStatus,
} from "./launch-artifact-ingestion";
import {
  getSourceLocationKey,
  normalizeSourceUrl,
  type SourceAccessState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
} from "./source-ledger";
import type { WorkspaceRole } from "./workspace";

export type SmartsheetStatusReasonState =
  | "access_restricted"
  | "connector_unavailable"
  | "missing_information"
  | "partial_information";

export type SmartsheetStatusSyncStatus =
  | "completed"
  | "failed"
  | "incomplete"
  | "skipped";

export type SmartsheetStatusFieldMapping = {
  blocker: string;
  dependencyIds: string;
  dueDate: string;
  freshness: string;
  launchId: string;
  milestone: string;
  owner: string;
  phase: string;
  rowId: string;
  sourceUrl: string;
  status: string;
  taskId: string;
  taskName: string;
};

export type SmartsheetStatusAdapterRecord = {
  accessState: SourceAccessState;
  lastModifiedAt: string;
  objectId?: string;
  owningTeam?: string;
  rows?: unknown;
  sheetName?: string;
  sourceUrl?: string;
};

export type NormalizedSmartsheetStatusRecord = {
  accessState: SourceAccessState;
  approvalState: "approved";
  blockerState?: string;
  dependencyIds: string[];
  dueDateLabel?: string;
  freshnessState: SourceFreshnessState;
  ingestionStatus: SourceIngestionStatus;
  launchId?: string;
  milestoneName?: string;
  missingRequiredFields: string[];
  owningTeam: string;
  ownerName?: string;
  phase: string;
  refreshedAt: string;
  rowId: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: "smartsheet";
  sourceType: "smartsheet_sheet";
  sourceUrl?: string;
  statusLabel: string;
  statusRecordId: string;
  taskId: string;
  taskName: string;
  taskStatus: NormalizedLaunchTaskStatus;
};

export type SmartsheetStatusRecordCounts = {
  incompleteRows: number;
  launchTasks: number;
  rows: number;
  staleRows: number;
};

export type SmartsheetStatusSyncAuditEvent = {
  actorId?: string;
  correlationId: string;
  eventId: string;
  eventType:
    | "source.sync_completed"
    | "source.sync_failed"
    | "source.sync_skipped";
  metadata: {
    freshnessState: SourceFreshnessState;
    ingestionStatus: SourceIngestionStatus;
    launchId?: string;
    reasonState?: SmartsheetStatusReasonState;
    recordCounts: SmartsheetStatusRecordCounts;
    sourceId: string;
    sourceSystem: "smartsheet";
    syncStatus: SmartsheetStatusSyncStatus;
  };
  occurredAt: string;
  sourceSystem: "smartsheet";
  systemActor?: string;
};

export type SmartsheetStatusIngestionResult = {
  auditEvent: SmartsheetStatusSyncAuditEvent;
  correlationId: string;
  launchTasks: NormalizedLaunchTaskRecord[];
  reasonState?: SmartsheetStatusReasonState;
  statusRecords: NormalizedSmartsheetStatusRecord[];
  syncStatus: SmartsheetStatusSyncStatus;
  updatedSource: SourceLedgerRecord;
  userSafeReason?: string;
};

export type SmartsheetStatusAnswer = {
  answerText: string;
  citations: Array<{
    label: string;
    sourceId: string;
    url?: string;
  }>;
  freshnessLabel: string;
  sourceBacked: boolean;
  status: "answered" | "access_restricted" | "no_reliable_source";
};

type BuildSmartsheetStatusIngestionInput = {
  actorId?: string;
  correlationId?: string;
  fieldMapping?: Partial<SmartsheetStatusFieldMapping>;
  occurredAt?: string;
  record: SmartsheetStatusAdapterRecord;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type BuildSmartsheetStatusOutcomeInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  reasonState: SmartsheetStatusReasonState;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type RunPrototypeSmartsheetStatusIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type SmartsheetStatusBuildContext = {
  refreshedAt: string;
  source: SourceLedgerRecord;
};

type SmartsheetStatusRowResult = {
  invalidRecordCount: number;
  records: NormalizedSmartsheetStatusRecord[];
};

export const defaultSmartsheetStatusFieldMapping: SmartsheetStatusFieldMapping = {
  blocker: "Blocker",
  dependencyIds: "Dependencies",
  dueDate: "Due Date",
  freshness: "Freshness",
  launchId: "Launch ID",
  milestone: "Milestone",
  owner: "Owner",
  phase: "Phase",
  rowId: "Row ID",
  sourceUrl: "Source Link",
  status: "Status",
  taskId: "Task ID",
  taskName: "Task",
};

const reasonMessages: Record<SmartsheetStatusReasonState, string> = {
  access_restricted:
    "Access restricted. Smartsheet project status is not available for this user or role.",
  connector_unavailable:
    "Smartsheet project status could not be retrieved. Check connector availability and source access.",
  missing_information:
    "Smartsheet project status ingestion is incomplete. Required sheet or row information is missing.",
  partial_information:
    "Smartsheet project status ingestion partially completed. Some status fields are missing or unmapped.",
};

const prototypeSmartsheetStatusSource: SourceLedgerRecord = {
  accessState: "authorized",
  approvalState: "approved",
  freshnessState: "watch",
  ingestionStatus: "ready",
  objectId: "smartsheet-cardiomax-approved-status",
  owningTeam: "Project Management",
  registeredAt: "2026-05-21T12:12:00.000Z",
  sourceId: "src-cardiomax-smartsheet-approved-status",
  sourceLinkHealth: "healthy",
  sourceName: "CARDIOMAX Approved Smartsheet Status",
  sourceSystem: "smartsheet",
  sourceType: "smartsheet_sheet",
  sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
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
      .toLowerCase() || "smartsheet-status";

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

function normalizeTimestamp(value: unknown) {
  const normalizedValue = normalizeFieldValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  const timestamp = new Date(normalizedValue);

  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }

  return timestamp.toISOString();
}

export function canIngestSmartsheetStatusSource(source: SourceLedgerRecord) {
  return (
    source.sourceSystem === "smartsheet" &&
    source.sourceType === "smartsheet_sheet" &&
    source.approvalState === "approved" &&
    source.accessState === "authorized" &&
    source.freshnessState !== "restricted" &&
    source.ingestionStatus !== "restricted" &&
    Boolean(getSourceLocationKey(source))
  );
}

export function buildSmartsheetStatusIngestionResult({
  actorId,
  correlationId,
  fieldMapping,
  occurredAt,
  record,
  source,
  systemActor,
}: BuildSmartsheetStatusIngestionInput): SmartsheetStatusIngestionResult {
  if (!canIngestSmartsheetStatusSource(source)) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: getIneligibleReasonState(source),
      source,
      systemActor,
    });
  }

  if (record.accessState !== "authorized") {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (!hasMatchingSmartsheetIdentity(source, record)) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const refreshedAt = normalizeTimestamp(record.lastModifiedAt);

  if (!refreshedAt) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const mapping = {
    ...defaultSmartsheetStatusFieldMapping,
    ...fieldMapping,
  };
  const rowResult = buildSmartsheetStatusRows(record.rows, mapping, {
    refreshedAt,
    source,
  });

  if (rowResult.records.length === 0) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const recordCounts = getRecordCounts(rowResult.records);
  const hasPartialRows =
    rowResult.invalidRecordCount > 0 || recordCounts.incompleteRows > 0;
  const syncStatus: SmartsheetStatusSyncStatus = hasPartialRows
    ? "incomplete"
    : "completed";
  const reasonState: SmartsheetStatusReasonState | undefined = hasPartialRows
    ? "partial_information"
    : undefined;
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ??
    createUniqueId("corr", `smartsheet-sync-${source.sourceId}`);
  const updatedSource = normalizeSmartsheetStatusSource({
    record,
    records: rowResult.records,
    refreshedAt,
    source,
    syncStatus,
  });
  const launchId = getPrimaryLaunchId(rowResult.records);
  const auditEvent = buildSmartsheetStatusSyncAuditEvent({
    actorId,
    correlationId: syncCorrelationId,
    launchId,
    occurredAt: syncOccurredAt,
    reasonState,
    recordCounts,
    source: updatedSource,
    syncStatus,
    systemActor,
  });

  return {
    auditEvent,
    correlationId: syncCorrelationId,
    launchTasks: rowResult.records.map(toNormalizedLaunchTaskRecord),
    reasonState,
    statusRecords: rowResult.records,
    syncStatus,
    updatedSource,
    userSafeReason: reasonState ? reasonMessages[reasonState] : undefined,
  };
}

export function runPrototypeSmartsheetStatusIngestion({
  actorId,
  correlationId,
  occurredAt,
  source,
  systemActor,
}: RunPrototypeSmartsheetStatusIngestionInput): SmartsheetStatusIngestionResult {
  if (!canIngestSmartsheetStatusSource(source)) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: getIneligibleReasonState(source),
      source,
      systemActor,
    });
  }

  const sourceKey = `${source.objectId ?? ""} ${source.sourceName}`.toLowerCase();

  if (sourceKey.includes("connector-failure")) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "connector_unavailable",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("access-restricted")) {
    return buildSmartsheetStatusOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  return buildSmartsheetStatusIngestionResult({
    actorId,
    correlationId,
    occurredAt,
    record: {
      accessState: "authorized",
      lastModifiedAt: "2026-05-22T15:45:00.000Z",
      objectId: source.objectId,
      owningTeam: source.owningTeam,
      rows: createPrototypeSmartsheetRows(source),
      sheetName: "CARDIOMAX deployment status",
      sourceUrl: source.sourceUrl,
    },
    source,
    systemActor,
  });
}

export function getSmartsheetStatusIngestionResultMessage(
  result: SmartsheetStatusIngestionResult,
) {
  if (result.userSafeReason) {
    return result.userSafeReason;
  }

  const rowSegment = formatCount(
    result.statusRecords.length,
    "Smartsheet project status record",
  );
  const staleRows = result.statusRecords.filter(
    (record) => record.freshnessState === "stale",
  ).length;

  if (staleRows > 0) {
    return `${rowSegment} prepared for retrieval. ${formatCount(
      staleRows,
      "record",
    )} marked source-stale.`;
  }

  return `${rowSegment} prepared for retrieval.`;
}

export function createPrototypeSmartsheetStatusTasks({
  source = prototypeSmartsheetStatusSource,
}: {
  source?: SourceLedgerRecord;
} = {}): NormalizedLaunchTaskRecord[] {
  const result = runPrototypeSmartsheetStatusIngestion({
    source,
    systemActor: "source-sync-service",
  });

  return result.launchTasks;
}

export function createPrototypeSmartsheetStatusRecords({
  source = prototypeSmartsheetStatusSource,
}: {
  source?: SourceLedgerRecord;
} = {}): NormalizedSmartsheetStatusRecord[] {
  const result = runPrototypeSmartsheetStatusIngestion({
    source,
    systemActor: "source-sync-service",
  });

  return result.statusRecords;
}

export function isSmartsheetStatusQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  const normalizedQuestion = question.trim().toLowerCase();

  if (
    previousQuestion &&
    /^(what about (it|this|that|them|those|the status|the blockers?)|that one|this one)\??$/i.test(
      normalizedQuestion,
    )
  ) {
    return isSmartsheetStatusQuestion(previousQuestion);
  }

  return /\b(deployment status|project status|task status|smartsheet status|timeline status|execution status|blocked tasks?|blockers?)\b/i.test(
    normalizedQuestion,
  );
}

export function buildSmartsheetStatusAnswer({
  launchId,
  records,
  role = "project-manager",
}: {
  launchId?: string;
  records: NormalizedSmartsheetStatusRecord[];
  role?: WorkspaceRole;
}): SmartsheetStatusAnswer {
  const scopedRecords = launchId
    ? records.filter((record) => record.launchId === launchId)
    : records;
  const visibleRecords = scopedRecords.filter(
    (record) => !isRestrictedStatusRecord(record) || role === "admin",
  );

  if (scopedRecords.length > 0 && visibleRecords.length === 0) {
    return {
      answerText:
        "Smartsheet project status is restricted for this role. Ask an admin for access or a source-backed summary.",
      citations: [],
      freshnessLabel: "Restricted",
      sourceBacked: false,
      status: "access_restricted",
    };
  }

  if (visibleRecords.length === 0) {
    return {
      answerText:
        "No reliable Smartsheet project status is available for this launch.",
      citations: [],
      freshnessLabel: "No reliable source",
      sourceBacked: false,
      status: "no_reliable_source",
    };
  }

  const counts = countStatusLabels(visibleRecords);
  const freshnessLabel = getAnswerFreshnessLabel(visibleRecords);
  const blockedCount = counts.blocked ?? 0;
  const completeCount = counts.complete ?? 0;
  const inProgressCount = counts.in_progress ?? 0;
  const notStartedCount = counts.not_started ?? 0;
  const summaryParts = [
    formatCount(blockedCount, "blocked task"),
    formatCount(inProgressCount, "in-progress task"),
    formatCount(completeCount, "complete task"),
    formatCount(notStartedCount, "not-started task"),
  ].filter((segment): segment is string => Boolean(segment));
  const blockerRecord = visibleRecords.find(
    (record) => record.taskStatus === "blocked",
  );
  const blockerSentence = blockerRecord
    ? ` Highest-priority blocker: ${blockerRecord.taskName}.`
    : "";

  return {
    answerText: `Smartsheet shows ${joinSegments(summaryParts)} for this launch.${blockerSentence} Freshness: ${freshnessLabel}.`,
    citations: visibleRecords.map((record) => ({
      label: `${record.taskName} (${record.statusLabel})`,
      sourceId: record.sourceId,
      url: record.sourceUrl,
    })),
    freshnessLabel,
    sourceBacked: true,
    status: "answered",
  };
}

export function buildSmartsheetStatusSourceBackedAnswer({
  launchId,
  launchName,
  previousQuestion,
  question,
  records = createPrototypeSmartsheetStatusRecords(),
  role = "project-manager",
}: {
  launchId?: string;
  launchName: string;
  previousQuestion?: string | null;
  question: string;
  records?: NormalizedSmartsheetStatusRecord[];
  role?: WorkspaceRole;
}): SourceBackedAnswer {
  const statusAnswer = buildSmartsheetStatusAnswer({
    launchId,
    records,
    role,
  });
  const state = getSourceBackedAnswerState(statusAnswer);
  const citations = getUniqueSmartsheetCitations(records, statusAnswer);
  const citationsBySourceId = new Map(
    citations.map((citation) => [citation.id, citation]),
  );
  const priorContext = previousQuestion
    ? ` Prior question used for follow-up context: "${previousQuestion}".`
    : "";

  return {
    citations,
    confidence: statusAnswer.sourceBacked
      ? statusAnswer.freshnessLabel === "Stale"
        ? "medium"
        : "high"
      : "none",
    freshnessLabel: `Freshness: ${statusAnswer.freshnessLabel}`,
    id: `${launchName}-smartsheet-status`,
    nextActions: [
      {
        href: citations[0]?.href ?? "/sources",
        id: "open-smartsheet-status",
        label: "Open Smartsheet status source.",
      },
      {
        href: "/timeline",
        id: "review-launch-timeline",
        label: "Review launch timeline tasks.",
      },
    ],
    retrievedFacts: statusAnswer.sourceBacked
      ? statusAnswer.citations.map((citation, index) => ({
          citationId: citationsBySourceId.has(citation.sourceId)
            ? citation.sourceId
            : undefined,
          id: `smartsheet-status-fact-${index + 1}`,
          text: citation.label,
        }))
      : [],
    sourceGap: statusAnswer.sourceBacked
      ? undefined
      : statusAnswer.answerText,
    state,
    summary: `${statusAnswer.answerText}${priorContext}`,
    title: isSmartsheetStatusQuestion(question)
      ? "Smartsheet project status"
      : "Smartsheet launch execution status",
  };
}

function buildSmartsheetStatusOutcome({
  actorId,
  correlationId,
  occurredAt,
  reasonState,
  source,
  systemActor,
}: BuildSmartsheetStatusOutcomeInput): SmartsheetStatusIngestionResult {
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ??
    createUniqueId("corr", `smartsheet-sync-${source.sourceId}`);
  const syncStatus = getOutcomeSyncStatus(reasonState);
  const updatedSource = buildOutcomeSource(source, reasonState, syncOccurredAt);
  const auditEvent = buildSmartsheetStatusSyncAuditEvent({
    actorId,
    correlationId: syncCorrelationId,
    occurredAt: syncOccurredAt,
    reasonState,
    recordCounts: emptyRecordCounts(),
    source: updatedSource,
    syncStatus,
    systemActor,
  });

  return {
    auditEvent,
    correlationId: syncCorrelationId,
    launchTasks: [],
    reasonState,
    statusRecords: [],
    syncStatus,
    updatedSource,
    userSafeReason: reasonMessages[reasonState],
  };
}

function getOutcomeSyncStatus(
  reasonState: SmartsheetStatusReasonState,
): SmartsheetStatusSyncStatus {
  if (reasonState === "connector_unavailable") {
    return "failed";
  }

  if (reasonState === "access_restricted") {
    return "skipped";
  }

  return "incomplete";
}

function buildOutcomeSource(
  source: SourceLedgerRecord,
  reasonState: SmartsheetStatusReasonState,
  occurredAt: string,
): SourceLedgerRecord {
  if (reasonState === "access_restricted") {
    return {
      ...source,
      accessState: "restricted",
      freshnessState: "restricted",
      ingestionStatus: "restricted",
      lastRefreshedAt: occurredAt,
      sourceLinkHealth: "restricted",
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

function buildSmartsheetStatusRows(
  rows: unknown,
  mapping: SmartsheetStatusFieldMapping,
  context: SmartsheetStatusBuildContext,
): SmartsheetStatusRowResult {
  const result: SmartsheetStatusRowResult = {
    invalidRecordCount: 0,
    records: [],
  };

  getRawRecordList(rows).forEach((row, index) => {
    const normalizedRow = normalizeSmartsheetStatusRow(
      row,
      mapping,
      context,
      index,
    );

    if (normalizedRow) {
      result.records.push(normalizedRow);
      return;
    }

    result.invalidRecordCount += 1;
  });

  return result;
}

function normalizeSmartsheetStatusRow(
  value: unknown,
  mapping: SmartsheetStatusFieldMapping,
  { refreshedAt, source }: SmartsheetStatusBuildContext,
  index: number,
): NormalizedSmartsheetStatusRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rowId = normalizeFieldValue(value[mapping.rowId]);
  const mappedTaskId = normalizeFieldValue(value[mapping.taskId]);
  const mappedTaskName = normalizeFieldValue(value[mapping.taskName]);
  const taskId = mappedTaskId ?? getMissingTaskId(rowId, index);
  const taskName = mappedTaskName ?? "Missing task name";

  const ownerName = normalizeFieldValue(value[mapping.owner]);
  const dueDateLabel = normalizeFieldValue(value[mapping.dueDate]);
  const statusLabel = normalizeFieldValue(value[mapping.status]) ?? "Not started";
  const blockerState = normalizeFieldValue(value[mapping.blocker]);
  const milestoneName = normalizeFieldValue(value[mapping.milestone]);
  const phase =
    normalizeFieldValue(value[mapping.phase]) ?? milestoneName ?? "Execution";
  const freshnessState = normalizeSmartsheetFreshnessState(
    value[mapping.freshness],
    source.freshnessState,
  );
  const taskStatus = normalizeSmartsheetTaskStatus(statusLabel, blockerState);
  const missingRequiredFields = [
    rowId ? undefined : "rowId",
    mappedTaskId ? undefined : "taskId",
    mappedTaskName ? undefined : "taskName",
    ownerName ? undefined : "owner",
    dueDateLabel ? undefined : "dueDate",
    normalizeFieldValue(value[mapping.status]) ? undefined : "status",
    isRecognizedSmartsheetFreshness(value[mapping.freshness])
      ? undefined
      : "freshness",
  ].filter((field): field is string => Boolean(field));
  const ingestionStatus: SourceIngestionStatus =
    missingRequiredFields.length > 0 ? "incomplete" : "complete";
  const sourceUrl =
    normalizeSourceUrl(normalizeFieldValue(value[mapping.sourceUrl])) ??
    normalizeSourceUrl(source.sourceUrl);
  const sourceLocationKey = getSourceLocationKey(source) ?? source.sourceId;
  const safeRowId = rowId ?? taskId;

  return {
    accessState: source.accessState,
    approvalState: "approved",
    blockerState,
    dependencyIds: getDependencyList(value[mapping.dependencyIds]),
    dueDateLabel,
    freshnessState:
      ingestionStatus === "incomplete" && freshnessState === "fresh"
        ? "watch"
        : freshnessState,
    ingestionStatus,
    launchId: normalizeFieldValue(value[mapping.launchId]),
    milestoneName,
    missingRequiredFields,
    owningTeam: source.owningTeam,
    ownerName,
    phase,
    refreshedAt,
    rowId: safeRowId,
    sourceId: source.sourceId,
    sourceLocationKey,
    sourceObjectId: source.objectId,
    sourceSystem: "smartsheet",
    sourceType: "smartsheet_sheet",
    sourceUrl,
    statusLabel,
    statusRecordId: createSafeId(
      "smartsheetstatus",
      `${source.sourceId}-${sourceLocationKey}-${safeRowId}-${index}`,
    ),
    taskId,
    taskName,
    taskStatus,
  };
}

function toNormalizedLaunchTaskRecord(
  record: NormalizedSmartsheetStatusRecord,
): NormalizedLaunchTaskRecord {
  return {
    accessState: record.accessState,
    approvalState: record.approvalState,
    blockerState: record.blockerState,
    criticalPath: false,
    dependencyIds: record.dependencyIds,
    dueDateLabel: record.dueDateLabel,
    freshnessState: record.freshnessState,
    handoffRelevance: record.milestoneName,
    ingestionStatus: record.ingestionStatus,
    launchId: record.launchId,
    launchTaskRecordId: createSafeId(
      "launchtask",
      `${record.statusRecordId}-${record.taskId}`,
    ),
    owningTeam: record.owningTeam,
    ownerName: record.ownerName,
    ownerRole: record.ownerName,
    phase: record.phase,
    refreshedAt: record.refreshedAt,
    sourceId: record.sourceId,
    sourceLocationKey: record.sourceLocationKey,
    sourceObjectId: record.sourceObjectId,
    sourceSystem: "smartsheet",
    sourceType: "smartsheet_sheet",
    sourceUrl: record.sourceUrl,
    taskId: record.taskId,
    taskName: record.taskName,
    taskStatus: record.taskStatus,
  };
}

function normalizeSmartsheetStatusSource({
  record,
  records,
  refreshedAt,
  source,
  syncStatus,
}: {
  record: SmartsheetStatusAdapterRecord;
  records: NormalizedSmartsheetStatusRecord[];
  refreshedAt: string;
  source: SourceLedgerRecord;
  syncStatus: SmartsheetStatusSyncStatus;
}): SourceLedgerRecord {
  const sourceUrl =
    normalizeSourceUrl(record.sourceUrl) ?? normalizeSourceUrl(source.sourceUrl);
  const hasStaleRows = records.some((row) => row.freshnessState === "stale");

  return {
    ...source,
    freshnessState: hasStaleRows
      ? "stale"
      : syncStatus === "completed"
        ? "fresh"
        : "watch",
    ingestionStatus: syncStatus === "completed" ? "complete" : "incomplete",
    lastRefreshedAt: refreshedAt,
    objectId: record.objectId?.trim() || source.objectId,
    owningTeam: record.owningTeam?.trim() || source.owningTeam,
    sourceLinkHealth: sourceUrl ? "healthy" : "missing",
    sourceUrl,
  };
}

function buildSmartsheetStatusSyncAuditEvent({
  actorId,
  correlationId,
  launchId,
  occurredAt,
  reasonState,
  recordCounts,
  source,
  syncStatus,
  systemActor,
}: {
  actorId?: string;
  correlationId: string;
  launchId?: string;
  occurredAt: string;
  reasonState?: SmartsheetStatusReasonState;
  recordCounts: SmartsheetStatusRecordCounts;
  source: SourceLedgerRecord;
  syncStatus: SmartsheetStatusSyncStatus;
  systemActor?: string;
}): SmartsheetStatusSyncAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createUniqueId(
      "evt",
      `${correlationId}-smartsheet-sync-${source.sourceId}`,
    ),
    eventType: getAuditEventType(syncStatus),
    metadata: {
      freshnessState: source.freshnessState,
      ingestionStatus: source.ingestionStatus,
      launchId,
      reasonState,
      recordCounts,
      sourceId: source.sourceId,
      sourceSystem: "smartsheet",
      syncStatus,
    },
    occurredAt,
    sourceSystem: "smartsheet",
    systemActor: systemActor ?? (actorId ? undefined : "source-sync-service"),
  };
}

function getAuditEventType(syncStatus: SmartsheetStatusSyncStatus) {
  if (syncStatus === "completed") {
    return "source.sync_completed";
  }

  if (syncStatus === "skipped") {
    return "source.sync_skipped";
  }

  return "source.sync_failed";
}

function hasMatchingSmartsheetIdentity(
  source: SourceLedgerRecord,
  record: SmartsheetStatusAdapterRecord,
) {
  const sourceObjectId = source.objectId?.trim();
  const recordObjectId = record.objectId?.trim();
  const sourceUrl = normalizeSourceUrl(source.sourceUrl);
  const recordSourceUrl = normalizeSourceUrl(record.sourceUrl);
  const hasObjectIdentity = Boolean(sourceObjectId && recordObjectId);
  const hasUrlIdentity = Boolean(sourceUrl && recordSourceUrl);

  if (hasObjectIdentity && sourceObjectId !== recordObjectId) {
    return false;
  }

  if (hasUrlIdentity && sourceUrl !== recordSourceUrl) {
    return false;
  }

  return (
    (hasObjectIdentity && sourceObjectId === recordObjectId) ||
    (hasUrlIdentity && sourceUrl === recordSourceUrl)
  );
}

function getIneligibleReasonState(
  source: SourceLedgerRecord,
): SmartsheetStatusReasonState {
  if (
    source.accessState === "restricted" ||
    source.approvalState === "restricted" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted"
  ) {
    return "access_restricted";
  }

  return "missing_information";
}

function getRecordCounts(
  records: NormalizedSmartsheetStatusRecord[],
): SmartsheetStatusRecordCounts {
  return {
    incompleteRows: records.filter(
      (record) => record.missingRequiredFields.length > 0,
    ).length,
    launchTasks: records.length,
    rows: records.length,
    staleRows: records.filter((record) => record.freshnessState === "stale")
      .length,
  };
}

function emptyRecordCounts(): SmartsheetStatusRecordCounts {
  return {
    incompleteRows: 0,
    launchTasks: 0,
    rows: 0,
    staleRows: 0,
  };
}

function getPrimaryLaunchId(records: NormalizedSmartsheetStatusRecord[]) {
  return records.find((record) => record.launchId)?.launchId;
}

function normalizeSmartsheetFreshnessState(
  value: unknown,
  fallback: SourceFreshnessState,
): SourceFreshnessState {
  const normalizedValue = normalizeFieldValue(value)?.toLowerCase();

  if (normalizedValue === "fresh") {
    return "fresh";
  }

  if (normalizedValue === "watch") {
    return "watch";
  }

  if (normalizedValue === "stale" || normalizedValue === "source-stale") {
    return "stale";
  }

  return fallback;
}

function normalizeSmartsheetTaskStatus(
  statusLabel: string,
  blockerState?: string,
): NormalizedLaunchTaskStatus {
  const normalizedStatus = statusLabel.trim().toLowerCase();

  if (
    hasBlockingStateLabel(blockerState) ||
    ["blocked", "at risk", "at-risk"].includes(normalizedStatus)
  ) {
    return "blocked";
  }

  if (["complete", "completed", "done"].includes(normalizedStatus)) {
    return "complete";
  }

  if (["in progress", "in-progress", "watch", "on track"].includes(normalizedStatus)) {
    return "in_progress";
  }

  return "not_started";
}

function hasBlockingStateLabel(blockerState?: string) {
  const normalizedState = blockerState?.trim().toLowerCase();

  if (!normalizedState) {
    return false;
  }

  return ![
    "clear",
    "none",
    "no",
    "no blocker",
    "not blocked",
    "n/a",
  ].includes(normalizedState);
}

function createPrototypeSmartsheetRows(source: SourceLedgerRecord) {
  const sourceKey = `${source.objectId ?? ""} ${source.sourceName}`.toLowerCase();
  const sourceUrl = source.sourceUrl;

  if (sourceKey.includes("missing-fields") || sourceKey.includes("unmapped")) {
    return [
      {
        "Due Date": "2026-06-04",
        Freshness: "Watch",
        "Launch ID": "cardiomax",
        Milestone: "Deployment readiness",
        "Row ID": "row-1001",
        Status: "Watch",
        "Task ID": "smartsheet-task-readiness-review",
        Task: "Confirm readiness owners",
      },
    ];
  }

  return [
    {
      Blocker: "none",
      Dependencies: "",
      "Due Date": "2026-06-01",
      Freshness: "Fresh",
      "Launch ID": "cardiomax",
      Milestone: "Mobilize",
      Owner: "Launch PM",
      Phase: "Mobilize",
      "Row ID": "row-1001",
      "Source Link": sourceUrl,
      Status: "Complete",
      "Task ID": "smartsheet-task-scope",
      Task: "Confirm deployment scope",
    },
    {
      Blocker: "Client kickoff window not confirmed",
      Dependencies: "smartsheet-task-scope",
      "Due Date": "2026-06-08",
      Freshness: "Watch",
      "Launch ID": "cardiomax",
      Milestone: "Deployment readiness",
      Owner: "Deployment Lead",
      Phase: "Launch",
      "Row ID": "row-1002",
      "Source Link": sourceUrl,
      Status: "Blocked",
      "Task ID": "smartsheet-task-readiness-review",
      Task: "Resolve deployment readiness blockers",
    },
    {
      Blocker: "none",
      Dependencies: "smartsheet-task-readiness-review",
      "Due Date": "2026-06-13",
      Freshness: "Stale",
      "Launch ID": "cardiomax",
      Milestone: "Training readiness",
      Owner: "Learning Solutions",
      Phase: "Launch",
      "Row ID": "row-1003",
      "Source Link": sourceUrl,
      Status: "In progress",
      "Task ID": "smartsheet-task-training-assets",
      Task: "Verify training asset deployment",
    },
  ];
}

function getRawRecordList(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFieldValue(value: unknown) {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim() || undefined;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}

function getDependencyList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeFieldValue(item))
      .filter((item): item is string => Boolean(item));
  }

  const normalizedValue = normalizeFieldValue(value);

  if (!normalizedValue) {
    return [];
  }

  return normalizedValue
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRestrictedStatusRecord(record: NormalizedSmartsheetStatusRecord) {
  return (
    record.accessState === "restricted" ||
    record.freshnessState === "restricted" ||
    record.ingestionStatus === "restricted"
  );
}

function isRecognizedSmartsheetFreshness(value: unknown) {
  const normalizedValue = normalizeFieldValue(value)?.toLowerCase();

  return (
    normalizedValue === "fresh" ||
    normalizedValue === "watch" ||
    normalizedValue === "stale" ||
    normalizedValue === "source-stale"
  );
}

function getMissingTaskId(rowId: string | undefined, index: number) {
  return rowId ? `smartsheet-row-${rowId}` : `smartsheet-row-${index + 1}`;
}

function getSourceBackedAnswerState(
  statusAnswer: SmartsheetStatusAnswer,
): SourceBackedAnswerState {
  if (statusAnswer.status === "access_restricted") {
    return "access_restricted";
  }

  if (statusAnswer.status === "no_reliable_source") {
    return "no_reliable_source";
  }

  return statusAnswer.freshnessLabel === "Stale" ? "source_stale" : "answered";
}

function getUniqueSmartsheetCitations(
  records: NormalizedSmartsheetStatusRecord[],
  statusAnswer: SmartsheetStatusAnswer,
): SourceCitation[] {
  const citedSourceIds = new Set(
    statusAnswer.citations.map((citation) => citation.sourceId),
  );
  const uniqueRecords = records.filter((record, index, sourceRecords) => {
    if (citedSourceIds.size > 0 && !citedSourceIds.has(record.sourceId)) {
      return false;
    }

    return (
      sourceRecords.findIndex((candidate) => candidate.sourceId === record.sourceId) ===
      index
    );
  });

  return uniqueRecords.map((record, index) => ({
    accessState: record.accessState,
    freshnessLabel: `Freshness: ${record.freshnessState}`,
    href: record.sourceUrl,
    id: record.sourceId,
    marker: String(index + 1),
    sourceType: "Smartsheet sheet",
    system: "Smartsheet",
    title: "Smartsheet project status",
  }));
}

function countStatusLabels(records: NormalizedSmartsheetStatusRecord[]) {
  return records.reduce<
    Partial<Record<NormalizedLaunchTaskStatus, number>>
  >((counts, record) => {
    counts[record.taskStatus] = (counts[record.taskStatus] ?? 0) + 1;
    return counts;
  }, {});
}

function getAnswerFreshnessLabel(records: NormalizedSmartsheetStatusRecord[]) {
  if (records.some((record) => record.freshnessState === "stale")) {
    return "Stale";
  }

  if (
    records.some(
      (record) =>
        record.freshnessState === "watch" ||
        record.ingestionStatus === "incomplete",
    )
  ) {
    return "Watch";
  }

  return "Fresh";
}

function formatCount(count: number, singularNoun: string) {
  if (count <= 0) {
    return undefined;
  }

  return `${count} ${singularNoun}${count === 1 ? "" : "s"}`;
}

function joinSegments(segments: string[]) {
  if (segments.length === 0) {
    return "no current status records";
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (segments.length === 2) {
    return `${segments[0]} and ${segments[1]}`;
  }

  return `${segments.slice(0, -1).join(", ")}, and ${segments.at(-1)}`;
}
