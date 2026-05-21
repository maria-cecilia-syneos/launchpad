import {
  getSourceLocationKey,
  normalizeSourceUrl,
  type SourceAccessState,
  type SourceApprovalState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
  type SourceLedgerSourceType,
  type SourceLedgerSystem,
} from "./source-ledger";

export type LaunchArtifactKind =
  | "playbook_template"
  | "launch_task_list"
  | "approved_asset_collection"
  | "handoff_artifact";

export type LaunchArtifactReasonState =
  | "access_restricted"
  | "connector_unavailable"
  | "missing_information"
  | "partial_information";

export type LaunchArtifactSyncStatus =
  | "completed"
  | "failed"
  | "incomplete"
  | "skipped";

export type LaunchAssetApprovalState = "approved" | "draft" | "unapproved";

export type PlaybookStandardTaskAdapterRecord = {
  dependencyIds?: unknown;
  handoffGate?: unknown;
  ownerRole?: unknown;
  phase?: unknown;
  taskId?: unknown;
  taskName?: unknown;
};

export type PlaybookTemplateAdapterRecord = {
  handoffGates?: unknown;
  phases?: unknown;
  sourceUrl?: unknown;
  standardTasks?: unknown;
  supportedLaunchTiers?: unknown;
  templateId?: unknown;
  templateName?: unknown;
};

export type LaunchTaskAdapterRecord = {
  blockerState?: unknown;
  criticalPath?: unknown;
  dependencyIds?: unknown;
  dueDateLabel?: unknown;
  dueDateRule?: unknown;
  handoffRelevance?: unknown;
  ownerName?: unknown;
  ownerRole?: unknown;
  phase?: unknown;
  taskId?: unknown;
  taskName?: unknown;
};

export type LaunchAssetAdapterRecord = {
  approvalState?: unknown;
  assetId?: unknown;
  assetTitle?: unknown;
  assetType?: unknown;
  owner?: unknown;
  sourceUrl?: unknown;
};

export type HandoffArtifactAdapterRecord = {
  assumptions?: unknown;
  commitments?: unknown;
  handoffId?: unknown;
  openQuestions?: unknown;
  owners?: unknown;
  risks?: unknown;
  scope?: unknown;
  sourceUrl?: unknown;
};

export type LaunchArtifactAdapterRecord = {
  accessState: SourceAccessState;
  artifactKind: LaunchArtifactKind;
  assets?: unknown;
  handoffArtifact?: unknown;
  lastModifiedAt: string;
  launchId?: string;
  launchTasks?: unknown;
  objectId?: string;
  owningTeam?: string;
  playbookTemplates?: unknown;
  sourceUrl?: string;
};

type BaseLaunchArtifactRecord = {
  accessState: SourceAccessState;
  approvalState: SourceApprovalState;
  freshnessState: SourceFreshnessState;
  ingestionStatus: SourceIngestionStatus;
  launchId?: string;
  owningTeam: string;
  refreshedAt: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: SourceLedgerSystem;
  sourceUrl?: string;
};

export type NormalizedPlaybookStandardTask = {
  dependencyIds: string[];
  handoffGate?: string;
  ownerRole?: string;
  phase: string;
  taskId: string;
  taskName: string;
};

export type NormalizedPlaybookTemplateRecord = BaseLaunchArtifactRecord & {
  handoffGates: string[];
  phases: string[];
  playbookRecordId: string;
  standardTasks: NormalizedPlaybookStandardTask[];
  supportedLaunchTiers: string[];
  templateId: string;
  templateName: string;
};

export type NormalizedLaunchTaskRecord = BaseLaunchArtifactRecord & {
  blockerState?: string;
  criticalPath: boolean;
  dependencyIds: string[];
  dueDateLabel?: string;
  dueDateRule?: string;
  handoffRelevance?: string;
  launchTaskRecordId: string;
  ownerName?: string;
  ownerRole?: string;
  phase: string;
  taskId: string;
  taskName: string;
};

export type NormalizedLaunchAssetRecord = BaseLaunchArtifactRecord & {
  assetApprovalState: LaunchAssetApprovalState;
  assetId: string;
  assetRecordId: string;
  assetTitle: string;
  assetType: string;
  owner?: string;
};

export type NormalizedHandoffArtifactRecord = BaseLaunchArtifactRecord & {
  assumptions: string[];
  commitments: string[];
  handoffArtifactRecordId: string;
  handoffId: string;
  missingRequiredFields: string[];
  openQuestions: string[];
  owners: string[];
  risks: string[];
  scope: string;
};

export type LaunchArtifactRecordCounts = {
  approvedAssets: number;
  assets: number;
  handoffArtifacts: number;
  launchTasks: number;
  playbookTemplates: number;
};

export type LaunchArtifactSyncAuditEvent = {
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
    reasonState?: LaunchArtifactReasonState;
    recordCounts: LaunchArtifactRecordCounts;
    sourceId: string;
    sourceSystem: SourceLedgerSystem;
    syncStatus: LaunchArtifactSyncStatus;
  };
  occurredAt: string;
  sourceSystem: SourceLedgerSystem;
  systemActor?: string;
};

export type LaunchArtifactIngestionResult = {
  assets: NormalizedLaunchAssetRecord[];
  auditEvent: LaunchArtifactSyncAuditEvent;
  correlationId: string;
  handoffArtifacts: NormalizedHandoffArtifactRecord[];
  launchTasks: NormalizedLaunchTaskRecord[];
  playbookTemplates: NormalizedPlaybookTemplateRecord[];
  reasonState?: LaunchArtifactReasonState;
  syncStatus: LaunchArtifactSyncStatus;
  updatedSource: SourceLedgerRecord;
  userSafeReason?: string;
};

type BuildLaunchArtifactIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  record: LaunchArtifactAdapterRecord;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type BuildLaunchArtifactSyncOutcomeInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  reasonState: LaunchArtifactReasonState;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type RunPrototypeLaunchArtifactIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type ArtifactBuildContext = {
  accessState: SourceAccessState;
  approvalState: SourceApprovalState;
  freshnessState: SourceFreshnessState;
  ingestionStatus: SourceIngestionStatus;
  launchId?: string;
  owningTeam: string;
  refreshedAt: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: SourceLedgerSystem;
  sourceUrl?: string;
};

type ArtifactRecordBuildResult<T> = {
  invalidRecordCount: number;
  records: T[];
};

type PlaybookTemplateNormalizationResult = {
  invalidRecordCount: number;
  record?: NormalizedPlaybookTemplateRecord;
};

const eligibleArtifactTypes: Partial<
  Record<SourceLedgerSystem, SourceLedgerSourceType>
> = {
  asset: "approved_asset",
  handoff: "handoff_artifact",
  playbook: "playbook",
  task: "launch_task",
};

const artifactKindBySystem: Record<
  Extract<SourceLedgerSystem, "asset" | "handoff" | "playbook" | "task">,
  LaunchArtifactKind
> = {
  asset: "approved_asset_collection",
  handoff: "handoff_artifact",
  playbook: "playbook_template",
  task: "launch_task_list",
};

const reasonMessages: Record<LaunchArtifactReasonState, string> = {
  access_restricted:
    "Access restricted. Structured launch artifact details are not available for this user or role.",
  connector_unavailable:
    "Structured launch artifacts could not be retrieved. Check connector availability and source access.",
  missing_information:
    "Structured launch artifact ingestion is incomplete. Required artifact information is missing.",
  partial_information:
    "Structured launch artifact ingestion partially completed. Some artifact information is missing.",
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
      .toLowerCase() || "artifact";

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

function getIneligibleSourceReasonState(
  source: SourceLedgerRecord,
): LaunchArtifactReasonState {
  if (isLaunchArtifactSourceRestricted(source)) {
    return "access_restricted";
  }

  return "missing_information";
}

function isLaunchArtifactSourceRestricted(source: SourceLedgerRecord) {
  return (
    source.accessState === "restricted" ||
    source.approvalState === "restricted" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted"
  );
}

export function canIngestLaunchArtifactSource(source: SourceLedgerRecord) {
  if (
    source.approvalState !== "approved" ||
    source.accessState !== "authorized" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted" ||
    !getSourceLocationKey(source)
  ) {
    return false;
  }

  return eligibleArtifactTypes[source.sourceSystem] === source.sourceType;
}

export function buildLaunchArtifactIngestionResult({
  actorId,
  correlationId,
  occurredAt,
  record,
  source,
  systemActor,
}: BuildLaunchArtifactIngestionInput): LaunchArtifactIngestionResult {
  if (!canIngestLaunchArtifactSource(source)) {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: getIneligibleSourceReasonState(source),
      source,
      systemActor,
    });
  }

  if (record.accessState !== "authorized") {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (
    !hasMatchingArtifactKind(source, record.artifactKind) ||
    !hasMatchingArtifactIdentity(source, record)
  ) {
    return buildLaunchArtifactSyncOutcome({
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
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const baseContext = buildArtifactContext({
    freshnessState: "fresh",
    ingestionStatus: "complete",
    record,
    refreshedAt,
    source,
  });
  const playbookTemplateResult = buildPlaybookTemplateRecords(
    record,
    baseContext,
  );
  const launchTaskResult = buildLaunchTaskRecords(record, baseContext);
  const assetResult = buildAssetRecords(record, baseContext);
  const handoffArtifactResult = buildHandoffArtifactRecords(record, baseContext);
  const playbookTemplates = playbookTemplateResult.records;
  const launchTasks = launchTaskResult.records;
  const assets = assetResult.records;
  const handoffArtifacts = handoffArtifactResult.records;
  const recordCounts = getRecordCounts({
    assets,
    handoffArtifacts,
    launchTasks,
    playbookTemplates,
  });
  const totalRecordCount =
    recordCounts.playbookTemplates +
    recordCounts.launchTasks +
    recordCounts.assets +
    recordCounts.handoffArtifacts;

  if (totalRecordCount === 0) {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const hasMissingRequiredHandoffInformation = handoffArtifacts.some(
    (artifact) => artifact.missingRequiredFields.length > 0,
  );
  const hasPartialStructuredData =
    playbookTemplateResult.invalidRecordCount +
      launchTaskResult.invalidRecordCount +
      assetResult.invalidRecordCount +
      handoffArtifactResult.invalidRecordCount >
    0;
  const syncStatus: LaunchArtifactSyncStatus =
    hasMissingRequiredHandoffInformation || hasPartialStructuredData
      ? "incomplete"
      : "completed";
  const reasonState: LaunchArtifactReasonState | undefined =
    hasMissingRequiredHandoffInformation
      ? "missing_information"
      : hasPartialStructuredData
        ? "partial_information"
        : undefined;
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ??
    createUniqueId("corr", `artifact-sync-${source.sourceId}`);
  const updatedSource = normalizeLaunchArtifactSource({
    record,
    refreshedAt,
    source,
    syncStatus,
  });
  const auditEvent = buildLaunchArtifactSyncAuditEvent({
    actorId,
    correlationId: syncCorrelationId,
    occurredAt: syncOccurredAt,
    reasonState,
    recordCounts,
    source: updatedSource,
    syncStatus,
    systemActor,
    launchId: record.launchId,
  });

  return {
    assets: applyLaunchArtifactSyncState(assets, syncStatus),
    auditEvent,
    correlationId: syncCorrelationId,
    handoffArtifacts: applyLaunchArtifactSyncState(
      handoffArtifacts,
      syncStatus,
    ),
    launchTasks: applyLaunchArtifactSyncState(launchTasks, syncStatus),
    playbookTemplates: applyLaunchArtifactSyncState(
      playbookTemplates,
      syncStatus,
    ),
    reasonState,
    syncStatus,
    updatedSource,
    userSafeReason: reasonState ? reasonMessages[reasonState] : undefined,
  };
}

export function runPrototypeLaunchArtifactIngestion({
  actorId,
  correlationId,
  occurredAt,
  source,
  systemActor,
}: RunPrototypeLaunchArtifactIngestionInput): LaunchArtifactIngestionResult {
  if (!canIngestLaunchArtifactSource(source)) {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: getIneligibleSourceReasonState(source),
      source,
      systemActor,
    });
  }

  const sourceKey = `${source.objectId ?? ""} ${source.sourceName}`.toLowerCase();

  if (sourceKey.includes("connector-failure")) {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "connector_unavailable",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("access-restricted")) {
    return buildLaunchArtifactSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (
    source.sourceSystem === "handoff" &&
    sourceKey.includes("missing-handoff")
  ) {
    return buildLaunchArtifactIngestionResult({
      actorId,
      correlationId,
      occurredAt,
      record: {
        accessState: "authorized",
        artifactKind: "handoff_artifact",
        handoffArtifact: {
          assumptions: ["Deployment staffing is confirmed."],
          commitments: ["Sales will confirm client access window."],
          handoffId: source.objectId,
          openQuestions: ["Who owns the readiness deck?"],
          owners: ["Deployment Lead"],
          risks: ["Client kickoff date may move."],
          scope: "",
        },
        lastModifiedAt: "2026-05-21T16:15:00.000Z",
        launchId: "launch-cardiomax-2026",
        objectId: source.objectId,
        owningTeam: source.owningTeam,
        sourceUrl: source.sourceUrl,
      },
      source,
      systemActor,
    });
  }

  return buildLaunchArtifactIngestionResult({
    actorId,
    correlationId,
    occurredAt,
    record: createPrototypeLaunchArtifactAdapterRecord(source),
    source,
    systemActor,
  });
}

export function getLaunchArtifactIngestionResultMessage(
  result: LaunchArtifactIngestionResult,
) {
  if (result.userSafeReason) {
    return result.userSafeReason;
  }

  const counts = getRecordCounts(result);
  const nonApprovedAssetCount = counts.assets - counts.approvedAssets;
  const segments = [
    formatCount(counts.playbookTemplates, "Playbook template"),
    formatCount(counts.launchTasks, "launch task"),
    formatCount(counts.approvedAssets, "approved asset"),
    formatCount(counts.handoffArtifacts, "handoff artifact"),
  ].filter((segment): segment is string => Boolean(segment));
  const nonApprovedAssetSegment = formatCount(
    nonApprovedAssetCount,
    "non-approved asset record",
  );

  if (segments.length === 0) {
    if (nonApprovedAssetSegment) {
      return `${nonApprovedAssetSegment} retained as governed metadata.`;
    }

    return "No structured launch artifact records prepared for retrieval.";
  }

  const retrievalMessage = `${joinSegments(segments)} prepared for retrieval.`;

  if (!nonApprovedAssetSegment) {
    return retrievalMessage;
  }

  return `${retrievalMessage} ${nonApprovedAssetSegment} retained as governed metadata.`;
}

function buildLaunchArtifactSyncOutcome({
  actorId,
  correlationId,
  occurredAt,
  reasonState,
  source,
  systemActor,
}: BuildLaunchArtifactSyncOutcomeInput): LaunchArtifactIngestionResult {
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ??
    createUniqueId("corr", `artifact-sync-${source.sourceId}`);
  const syncStatus = getOutcomeSyncStatus(reasonState);
  const updatedSource = buildOutcomeSource(source, reasonState, syncOccurredAt);
  const auditEvent = buildLaunchArtifactSyncAuditEvent({
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
    assets: [],
    auditEvent,
    correlationId: syncCorrelationId,
    handoffArtifacts: [],
    launchTasks: [],
    playbookTemplates: [],
    reasonState,
    syncStatus,
    updatedSource,
    userSafeReason: reasonMessages[reasonState],
  };
}

function getOutcomeSyncStatus(
  reasonState: LaunchArtifactReasonState,
): LaunchArtifactSyncStatus {
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
  reasonState: LaunchArtifactReasonState,
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

function applyLaunchArtifactSyncState<T extends BaseLaunchArtifactRecord>(
  records: T[],
  syncStatus: LaunchArtifactSyncStatus,
): T[] {
  if (syncStatus === "completed") {
    return records;
  }

  return records.map((record) => ({
    ...record,
    freshnessState: "watch",
    ingestionStatus: "incomplete",
  }));
}

function normalizeLaunchArtifactSource({
  record,
  refreshedAt,
  source,
  syncStatus,
}: {
  record: LaunchArtifactAdapterRecord;
  refreshedAt: string;
  source: SourceLedgerRecord;
  syncStatus: LaunchArtifactSyncStatus;
}): SourceLedgerRecord {
  const sourceUrl = getSafeRecordSourceUrl(record, source);

  return {
    ...source,
    accessState: "authorized",
    freshnessState: syncStatus === "completed" ? "fresh" : "watch",
    ingestionStatus: syncStatus === "completed" ? "complete" : "incomplete",
    lastRefreshedAt: refreshedAt,
    objectId: record.objectId?.trim() || source.objectId,
    owningTeam: record.owningTeam?.trim() || source.owningTeam,
    sourceLinkHealth: sourceUrl ? "healthy" : "missing",
    sourceUrl,
  };
}

function buildArtifactContext({
  freshnessState,
  ingestionStatus,
  record,
  refreshedAt,
  source,
}: {
  freshnessState: SourceFreshnessState;
  ingestionStatus: SourceIngestionStatus;
  record: LaunchArtifactAdapterRecord;
  refreshedAt: string;
  source: SourceLedgerRecord;
}): ArtifactBuildContext {
  return {
    accessState: source.accessState,
    approvalState: source.approvalState,
    freshnessState,
    ingestionStatus,
    launchId: record.launchId,
    owningTeam: record.owningTeam?.trim() || source.owningTeam,
    refreshedAt,
    sourceId: source.sourceId,
    sourceLocationKey: getSourceLocationKey(source) ?? source.sourceId,
    sourceObjectId: record.objectId?.trim() || source.objectId,
    sourceSystem: source.sourceSystem,
    sourceUrl: getSafeRecordSourceUrl(record, source),
  };
}

function buildPlaybookTemplateRecords(
  record: LaunchArtifactAdapterRecord,
  context: ArtifactBuildContext,
): ArtifactRecordBuildResult<NormalizedPlaybookTemplateRecord> {
  if (record.artifactKind !== "playbook_template") {
    return emptyArtifactRecordBuildResult();
  }

  const result: ArtifactRecordBuildResult<NormalizedPlaybookTemplateRecord> = {
    invalidRecordCount: 0,
    records: [],
  };

  getRawRecordList(record.playbookTemplates).forEach((template, index) => {
    const normalizedTemplate = normalizePlaybookTemplate(
      template,
      context,
      index,
    );

    result.invalidRecordCount += normalizedTemplate.invalidRecordCount;

    if (normalizedTemplate.record) {
      result.records.push(normalizedTemplate.record);
    }
  });

  return result;
}

function normalizePlaybookTemplate(
  value: unknown,
  context: ArtifactBuildContext,
  index: number,
): PlaybookTemplateNormalizationResult {
  if (!isRecord(value)) {
    return {
      invalidRecordCount: 1,
    };
  }

  const template = value as PlaybookTemplateAdapterRecord;
  const templateName = normalizeFieldValue(template.templateName);
  const templateId = normalizeFieldValue(template.templateId) ?? templateName;
  const standardTaskResult = buildPlaybookStandardTaskRecords(
    template.standardTasks,
  );
  const standardTasks = standardTaskResult.records;
  const supportedLaunchTiers = getStringList(template.supportedLaunchTiers);

  const handoffGates = uniqueStrings([
    ...getStringList(template.handoffGates),
    ...standardTasks.flatMap((task) => task.handoffGate ? [task.handoffGate] : []),
  ]);

  if (
    !templateName ||
    !templateId ||
    standardTasks.length === 0 ||
    supportedLaunchTiers.length === 0 ||
    handoffGates.length === 0
  ) {
    return {
      invalidRecordCount: standardTaskResult.invalidRecordCount + 1,
    };
  }

  const phases = uniqueStrings([
    ...getStringList(template.phases),
    ...standardTasks.map((task) => task.phase),
  ]);
  const templateSourceUrl =
    normalizeSourceUrl(normalizeFieldValue(template.sourceUrl)) ??
    context.sourceUrl;

  return {
    invalidRecordCount: standardTaskResult.invalidRecordCount,
    record: {
      ...context,
      handoffGates,
      phases,
      playbookRecordId: createSafeId(
        "playbook",
        `${context.sourceId}-${context.sourceLocationKey}-${templateId}-${index}`,
      ),
      sourceUrl: templateSourceUrl,
      standardTasks,
      supportedLaunchTiers,
      templateId,
      templateName,
    },
  };
}

function buildPlaybookStandardTaskRecords(
  value: unknown,
): ArtifactRecordBuildResult<NormalizedPlaybookStandardTask> {
  const result: ArtifactRecordBuildResult<NormalizedPlaybookStandardTask> = {
    invalidRecordCount: 0,
    records: [],
  };

  getRawRecordList(value).forEach((task) => {
    const normalizedTask = normalizePlaybookStandardTask(task);

    if (normalizedTask) {
      result.records.push(normalizedTask);
      return;
    }

    result.invalidRecordCount += 1;
  });

  return result;
}

function normalizePlaybookStandardTask(
  value: unknown,
): NormalizedPlaybookStandardTask | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const taskId = normalizeFieldValue(value.taskId);
  const taskName = normalizeFieldValue(value.taskName);
  const ownerRole = normalizeFieldValue(value.ownerRole);
  const phase = normalizeFieldValue(value.phase);

  if (!taskId || !taskName || !ownerRole || !phase) {
    return undefined;
  }

  return {
    dependencyIds: getStringList(value.dependencyIds),
    handoffGate: normalizeFieldValue(value.handoffGate),
    ownerRole,
    phase,
    taskId,
    taskName,
  };
}

function buildLaunchTaskRecords(
  record: LaunchArtifactAdapterRecord,
  context: ArtifactBuildContext,
): ArtifactRecordBuildResult<NormalizedLaunchTaskRecord> {
  if (record.artifactKind !== "launch_task_list") {
    return emptyArtifactRecordBuildResult();
  }

  return normalizeRecordCollection(record.launchTasks, (task, index) =>
    normalizeLaunchTask(task, context, index),
  );
}

function normalizeLaunchTask(
  value: unknown,
  context: ArtifactBuildContext,
  index: number,
): NormalizedLaunchTaskRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const task = value as LaunchTaskAdapterRecord;
  const taskId = normalizeFieldValue(task.taskId);
  const taskName = normalizeFieldValue(task.taskName);
  const phase = normalizeFieldValue(task.phase);

  if (!taskId || !taskName || !phase) {
    return undefined;
  }

  return {
    ...context,
    blockerState: normalizeFieldValue(task.blockerState),
    criticalPath: task.criticalPath === true,
    dependencyIds: getStringList(task.dependencyIds),
    dueDateLabel: normalizeFieldValue(task.dueDateLabel),
    dueDateRule: normalizeFieldValue(task.dueDateRule),
    handoffRelevance: normalizeFieldValue(task.handoffRelevance),
    launchTaskRecordId: createSafeId(
      "launchtask",
      `${context.sourceId}-${context.sourceLocationKey}-${taskId}-${index}`,
    ),
    ownerName: normalizeFieldValue(task.ownerName),
    ownerRole: normalizeFieldValue(task.ownerRole),
    phase,
    taskId,
    taskName,
  };
}

function buildAssetRecords(
  record: LaunchArtifactAdapterRecord,
  context: ArtifactBuildContext,
): ArtifactRecordBuildResult<NormalizedLaunchAssetRecord> {
  if (record.artifactKind !== "approved_asset_collection") {
    return emptyArtifactRecordBuildResult();
  }

  return normalizeRecordCollection(record.assets, (asset, index) =>
    normalizeAsset(asset, context, index),
  );
}

function normalizeAsset(
  value: unknown,
  context: ArtifactBuildContext,
  index: number,
): NormalizedLaunchAssetRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const asset = value as LaunchAssetAdapterRecord;
  const assetTitle = normalizeFieldValue(asset.assetTitle);
  const assetType = normalizeFieldValue(asset.assetType);
  const assetApprovalState = normalizeAssetApprovalState(asset.approvalState);
  const assetId = normalizeFieldValue(asset.assetId) ?? assetTitle;

  if (!assetTitle || !assetType || !assetApprovalState || !assetId) {
    return undefined;
  }

  return {
    ...context,
    assetApprovalState,
    assetId,
    assetRecordId: createSafeId(
      "asset",
      `${context.sourceId}-${context.sourceLocationKey}-${assetId}-${index}`,
    ),
    assetTitle,
    assetType,
    owner: normalizeFieldValue(asset.owner),
    sourceUrl:
      normalizeSourceUrl(normalizeFieldValue(asset.sourceUrl)) ??
      context.sourceUrl,
  };
}

function buildHandoffArtifactRecords(
  record: LaunchArtifactAdapterRecord,
  context: ArtifactBuildContext,
): ArtifactRecordBuildResult<NormalizedHandoffArtifactRecord> {
  if (record.artifactKind !== "handoff_artifact") {
    return emptyArtifactRecordBuildResult();
  }

  if (!isRecord(record.handoffArtifact)) {
    return {
      invalidRecordCount: 1,
      records: [],
    };
  }

  const handoff = record.handoffArtifact as HandoffArtifactAdapterRecord;
  const handoffId =
    normalizeFieldValue(handoff.handoffId) ?? context.sourceObjectId;

  if (!handoffId) {
    return {
      invalidRecordCount: 1,
      records: [],
    };
  }

  const scope = normalizeFieldValue(handoff.scope) ?? "";
  const owners = getStringList(handoff.owners);
  const commitments = getStringList(handoff.commitments);
  const missingRequiredFields = [
    !scope ? "scope" : undefined,
    owners.length === 0 ? "owners" : undefined,
    commitments.length === 0 ? "commitments" : undefined,
  ].filter((field): field is string => Boolean(field));

  return {
    invalidRecordCount: 0,
    records: [
      {
        ...context,
        assumptions: getStringList(handoff.assumptions),
        commitments,
        freshnessState:
          missingRequiredFields.length === 0 ? "fresh" : "watch",
        handoffArtifactRecordId: createSafeId(
          "handoff",
          `${context.sourceId}-${context.sourceLocationKey}-${handoffId}`,
        ),
        handoffId,
        ingestionStatus:
          missingRequiredFields.length === 0 ? "complete" : "incomplete",
        missingRequiredFields,
        openQuestions: getStringList(handoff.openQuestions),
        owners,
        risks: getStringList(handoff.risks),
        scope,
        sourceUrl:
          normalizeSourceUrl(normalizeFieldValue(handoff.sourceUrl)) ??
          context.sourceUrl,
      },
    ],
  };
}

function buildLaunchArtifactSyncAuditEvent({
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
  reasonState?: LaunchArtifactReasonState;
  recordCounts: LaunchArtifactRecordCounts;
  source: SourceLedgerRecord;
  syncStatus: LaunchArtifactSyncStatus;
  systemActor?: string;
}): LaunchArtifactSyncAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createUniqueId(
      "evt",
      `${correlationId}-artifact-sync-${source.sourceId}`,
    ),
    eventType: getAuditEventType(syncStatus),
    metadata: {
      freshnessState: source.freshnessState,
      ingestionStatus: source.ingestionStatus,
      launchId,
      reasonState,
      recordCounts,
      sourceId: source.sourceId,
      sourceSystem: source.sourceSystem,
      syncStatus,
    },
    occurredAt,
    sourceSystem: source.sourceSystem,
    systemActor: systemActor ?? (actorId ? undefined : "source-sync-service"),
  };
}

function getAuditEventType(syncStatus: LaunchArtifactSyncStatus) {
  if (syncStatus === "completed") {
    return "source.sync_completed";
  }

  if (syncStatus === "skipped") {
    return "source.sync_skipped";
  }

  return "source.sync_failed";
}

function hasMatchingArtifactKind(
  source: SourceLedgerRecord,
  artifactKind: LaunchArtifactKind,
) {
  if (
    source.sourceSystem !== "asset" &&
    source.sourceSystem !== "handoff" &&
    source.sourceSystem !== "playbook" &&
    source.sourceSystem !== "task"
  ) {
    return false;
  }

  return artifactKindBySystem[source.sourceSystem] === artifactKind;
}

function hasMatchingArtifactIdentity(
  source: SourceLedgerRecord,
  record: LaunchArtifactAdapterRecord,
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

function getSafeRecordSourceUrl(
  record: LaunchArtifactAdapterRecord,
  source: SourceLedgerRecord,
) {
  return normalizeSourceUrl(record.sourceUrl) ?? normalizeSourceUrl(source.sourceUrl);
}

function getRecordCounts({
  assets,
  handoffArtifacts,
  launchTasks,
  playbookTemplates,
}: Pick<
  LaunchArtifactIngestionResult,
  "assets" | "handoffArtifacts" | "launchTasks" | "playbookTemplates"
>): LaunchArtifactRecordCounts {
  return {
    approvedAssets: assets.filter(
      (asset) => asset.assetApprovalState === "approved",
    ).length,
    assets: assets.length,
    handoffArtifacts: handoffArtifacts.length,
    launchTasks: launchTasks.length,
    playbookTemplates: playbookTemplates.length,
  };
}

function emptyRecordCounts(): LaunchArtifactRecordCounts {
  return {
    approvedAssets: 0,
    assets: 0,
    handoffArtifacts: 0,
    launchTasks: 0,
    playbookTemplates: 0,
  };
}

function emptyArtifactRecordBuildResult<T>(): ArtifactRecordBuildResult<T> {
  return {
    invalidRecordCount: 0,
    records: [],
  };
}

function normalizeRecordCollection<T>(
  value: unknown,
  normalizeRecord: (value: unknown, index: number) => T | undefined,
): ArtifactRecordBuildResult<T> {
  const result: ArtifactRecordBuildResult<T> = {
    invalidRecordCount: 0,
    records: [],
  };

  getRawRecordList(value).forEach((item, index) => {
    const normalizedRecord = normalizeRecord(item, index);

    if (normalizedRecord) {
      result.records.push(normalizedRecord);
      return;
    }

    result.invalidRecordCount += 1;
  });

  return result;
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

function getStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeFieldValue(item))
      .filter((item): item is string => Boolean(item));
  }

  const normalizedValue = normalizeFieldValue(value);

  return normalizedValue ? [normalizedValue] : [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function normalizeAssetApprovalState(
  value: unknown,
): LaunchAssetApprovalState | undefined {
  if (
    value === "approved" ||
    value === "draft" ||
    value === "unapproved"
  ) {
    return value;
  }

  return undefined;
}

function formatCount(count: number, singularNoun: string) {
  if (count <= 0) {
    return undefined;
  }

  return `${count} ${singularNoun}${count === 1 ? "" : "s"}`;
}

function joinSegments(segments: string[]) {
  if (segments.length === 1) {
    return segments[0];
  }

  if (segments.length === 2) {
    return `${segments[0]} and ${segments[1]}`;
  }

  return `${segments.slice(0, -1).join(", ")}, and ${segments.at(-1)}`;
}

function createPrototypeLaunchArtifactAdapterRecord(
  source: SourceLedgerRecord,
): LaunchArtifactAdapterRecord {
  if (source.sourceSystem === "task") {
    return {
      accessState: "authorized",
      artifactKind: "launch_task_list",
      lastModifiedAt: "2026-05-21T16:00:00.000Z",
      launchId: "launch-cardiomax-2026",
      launchTasks: [
        {
          blockerState: "none",
          criticalPath: true,
          dependencyIds: ["task-confirm-scope"],
          dueDateLabel: "T-30",
          handoffRelevance: "deployment",
          ownerRole: "Project Manager",
          phase: "Launch",
          taskId: "task-readiness-review",
          taskName: "Run readiness review",
        },
      ],
      objectId: source.objectId,
      owningTeam: source.owningTeam,
      sourceUrl: source.sourceUrl,
    };
  }

  if (source.sourceSystem === "asset") {
    return {
      accessState: "authorized",
      artifactKind: "approved_asset_collection",
      assets: [
        {
          approvalState: "approved",
          assetId: "asset-approved-messaging",
          assetTitle: "Approved messaging guide",
          assetType: "Messaging guide",
          owner: source.owningTeam,
          sourceUrl: source.sourceUrl,
        },
        {
          approvalState: "draft",
          assetId: "asset-draft-training-aid",
          assetTitle: "Draft training aid",
          assetType: "Training aid",
        },
      ],
      lastModifiedAt: "2026-05-21T16:05:00.000Z",
      launchId: "launch-cardiomax-2026",
      objectId: source.objectId,
      owningTeam: source.owningTeam,
      sourceUrl: source.sourceUrl,
    };
  }

  if (source.sourceSystem === "handoff") {
    return {
      accessState: "authorized",
      artifactKind: "handoff_artifact",
      handoffArtifact: {
        assumptions: ["Deployment staffing is confirmed."],
        commitments: ["Sales will confirm client access window."],
        handoffId: source.objectId,
        openQuestions: ["Who owns the readiness deck?"],
        owners: ["Deployment Lead"],
        risks: ["Client kickoff date may move."],
        scope: "Deployment readiness for CARDIOMAX launch.",
      },
      lastModifiedAt: "2026-05-21T16:10:00.000Z",
      launchId: "launch-cardiomax-2026",
      objectId: source.objectId,
      owningTeam: source.owningTeam,
      sourceUrl: source.sourceUrl,
    };
  }

  return {
    accessState: "authorized",
    artifactKind: "playbook_template",
    lastModifiedAt: "2026-05-21T15:35:00.000Z",
    launchId: "launch-cardiomax-2026",
    objectId: source.objectId,
    owningTeam: source.owningTeam,
    playbookTemplates: [
      {
        handoffGates: ["Sales to Deployment readiness"],
        phases: ["Mobilize", "Launch", "Stabilize"],
        standardTasks: [
          {
            dependencyIds: [],
            handoffGate: "Sales to Deployment readiness",
            ownerRole: "Launch PM",
            phase: "Mobilize",
            taskId: "pb-task-1",
            taskName: "Confirm launch tier and scope",
          },
          {
            dependencyIds: ["pb-task-1"],
            ownerRole: "Deployment Lead",
            phase: "Launch",
            taskId: "pb-task-2",
            taskName: "Complete deployment handoff review",
          },
        ],
        supportedLaunchTiers: ["Tier 2", "Tier 3"],
        templateId: "tier-2-playbook",
        templateName: "Tier 2 Launch Playbook",
      },
    ],
    sourceUrl: source.sourceUrl,
  };
}
