import {
  getSourceLocationKey,
  normalizeSourceUrl,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
  type SourceLedgerSourceType,
  type SourceLedgerSystem,
} from "./source-ledger";

export type MicrosoftDocumentKind =
  | "sharepoint_page"
  | "word_document"
  | "pdf_document";

export type MicrosoftDocumentAdapterRecord = {
  documentKind: MicrosoftDocumentKind;
  lastModifiedAt: string;
  objectId?: string;
  owner?: string;
  sourceUrl?: string;
  textContent: string;
  title: string;
};

export type SourceIngestionFailureState =
  | "connector_unavailable"
  | "missing_information"
  | "parse_failed";

export type SourceSyncStatus = "completed" | "failed" | "incomplete";

export type SourceExtractedTextRecord = {
  chunkIndex: number;
  documentTitle: string;
  extractedRecordId: string;
  normalizedText: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: SourceLedgerSystem;
  sourceUrl?: string;
};

export type SourceSyncAuditEvent = {
  actorId: string;
  correlationId: string;
  eventId: string;
  eventType: "source.sync_completed" | "source.sync_failed";
  metadata: {
    extractedRecordCount: number;
    failureState?: SourceIngestionFailureState;
    freshnessState: SourceFreshnessState;
    ingestionStatus: SourceIngestionStatus;
    sourceId: string;
    sourceSystem: SourceLedgerSystem;
    syncStatus: SourceSyncStatus;
  };
  occurredAt: string;
  sourceSystem: SourceLedgerSystem;
};

export type SourceIngestionResult = {
  auditEvent: SourceSyncAuditEvent;
  correlationId: string;
  extractedRecords: SourceExtractedTextRecord[];
  failureState?: SourceIngestionFailureState;
  syncStatus: SourceSyncStatus;
  updatedSource: SourceLedgerRecord;
  userSafeReason?: string;
};

type BuildIngestionResultInput = {
  actorId: string;
  correlationId?: string;
  document: MicrosoftDocumentAdapterRecord;
  occurredAt?: string;
  source: SourceLedgerRecord;
};

type BuildFailedIngestionResultInput = {
  actorId: string;
  correlationId?: string;
  failureState: SourceIngestionFailureState;
  occurredAt?: string;
  source: SourceLedgerRecord;
};

type ParseMicrosoftDocumentTextInput = {
  document: MicrosoftDocumentAdapterRecord;
  source: SourceLedgerRecord;
};

type RunPrototypeIngestionInput = {
  actorId: string;
  correlationId?: string;
  occurredAt?: string;
  source: SourceLedgerRecord;
};

const ingestibleSourceTypes: SourceLedgerSourceType[] = [
  "sharepoint_site",
  "word_document",
  "pdf_document",
];

const failureReasonMessages: Record<SourceIngestionFailureState, string> = {
  connector_unavailable:
    "Microsoft document content could not be retrieved. Check connector availability and source access.",
  missing_information:
    "Microsoft document content is missing required metadata or readable text.",
  parse_failed:
    "Microsoft document content could not be parsed into retrieval-ready text.",
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
      .toLowerCase() || "record";

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

export function canIngestMicrosoftDocumentSource(source: SourceLedgerRecord) {
  if (
    source.approvalState !== "approved" ||
    source.accessState !== "authorized" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted"
  ) {
    return false;
  }

  if (!ingestibleSourceTypes.includes(source.sourceType)) {
    return false;
  }

  return source.sourceSystem === "sharepoint" || source.sourceSystem === "word_pdf";
}

export function parseMicrosoftDocumentText({
  document,
  source,
}: ParseMicrosoftDocumentTextInput): SourceExtractedTextRecord[] {
  const sourceLocationKey = getSourceLocationKey(source) ?? source.sourceId;
  const safeSourceUrl = normalizeSourceUrl(document.sourceUrl) ?? source.sourceUrl;
  const sourceObjectId = document.objectId?.trim() || source.objectId;

  return document.textContent
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((normalizedText, chunkIndex) => ({
      chunkIndex,
      documentTitle: document.title.trim() || source.sourceName,
      extractedRecordId: createSafeId(
        "extract",
        `${source.sourceId}-${sourceLocationKey}-${chunkIndex}`,
      ),
      normalizedText,
      sourceId: source.sourceId,
      sourceLocationKey,
      sourceObjectId,
      sourceSystem: source.sourceSystem,
      sourceUrl: safeSourceUrl,
    }));
}

export function buildMicrosoftDocumentIngestionResult({
  actorId,
  correlationId,
  document,
  occurredAt,
  source,
}: BuildIngestionResultInput): SourceIngestionResult {
  if (!canIngestMicrosoftDocumentSource(source)) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "missing_information",
      occurredAt,
      source,
    });
  }

  const normalizedSource = normalizeMicrosoftDocumentSource(source, document);
  const extractedRecords = parseMicrosoftDocumentText({
    document,
    source: normalizedSource,
  });

  if (extractedRecords.length === 0) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "missing_information",
      occurredAt,
      source,
    });
  }

  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `source-sync-${source.sourceId}`);
  const auditEvent = buildSourceSyncAuditEvent({
    actorId,
    correlationId: syncCorrelationId,
    extractedRecordCount: extractedRecords.length,
    failureState: undefined,
    occurredAt: syncOccurredAt,
    source: normalizedSource,
    syncStatus: "completed",
  });

  return {
    auditEvent,
    correlationId: syncCorrelationId,
    extractedRecords,
    syncStatus: "completed",
    updatedSource: normalizedSource,
  };
}

export function buildFailedMicrosoftDocumentIngestionResult({
  actorId,
  correlationId,
  failureState,
  occurredAt,
  source,
}: BuildFailedIngestionResultInput): SourceIngestionResult {
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `source-sync-${source.sourceId}`);
  const syncStatus: SourceSyncStatus =
    failureState === "missing_information" ? "incomplete" : "failed";
  const updatedSource: SourceLedgerRecord = {
    ...source,
    freshnessState: syncStatus === "incomplete" ? "watch" : "stale",
    ingestionStatus: syncStatus === "incomplete" ? "incomplete" : "failed",
    lastRefreshedAt: syncOccurredAt,
  };
  const auditEvent = buildSourceSyncAuditEvent({
    actorId,
    correlationId: syncCorrelationId,
    extractedRecordCount: 0,
    failureState,
    occurredAt: syncOccurredAt,
    source: updatedSource,
    syncStatus,
  });

  return {
    auditEvent,
    correlationId: syncCorrelationId,
    extractedRecords: [],
    failureState,
    syncStatus,
    updatedSource,
    userSafeReason: failureReasonMessages[failureState],
  };
}

export function runPrototypeMicrosoftDocumentIngestion({
  actorId,
  correlationId,
  occurredAt,
  source,
}: RunPrototypeIngestionInput): SourceIngestionResult {
  if (!canIngestMicrosoftDocumentSource(source)) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "missing_information",
      occurredAt,
      source,
    });
  }

  const sourceKey = `${source.objectId ?? ""} ${source.sourceName}`.toLowerCase();

  if (sourceKey.includes("connector-failure")) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "connector_unavailable",
      occurredAt,
      source,
    });
  }

  if (sourceKey.includes("parse-failure")) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "parse_failed",
      occurredAt,
      source,
    });
  }

  if (sourceKey.includes("missing")) {
    return buildFailedMicrosoftDocumentIngestionResult({
      actorId,
      correlationId,
      failureState: "missing_information",
      occurredAt,
      source,
    });
  }

  return buildMicrosoftDocumentIngestionResult({
    actorId,
    correlationId,
    document: createPrototypeMicrosoftDocumentAdapterRecord(source),
    occurredAt,
    source,
  });
}

export function getSourceIngestionResultMessage(result: SourceIngestionResult) {
  if (result.userSafeReason) {
    return result.userSafeReason;
  }

  const recordCount = result.extractedRecords.length;
  const noun = recordCount === 1 ? "record" : "records";

  return `${recordCount} normalized text ${noun} prepared for retrieval.`;
}

function normalizeMicrosoftDocumentSource(
  source: SourceLedgerRecord,
  document: MicrosoftDocumentAdapterRecord,
): SourceLedgerRecord {
  return {
    ...source,
    freshnessState: "fresh",
    ingestionStatus: "complete",
    lastRefreshedAt: document.lastModifiedAt,
    objectId: document.objectId?.trim() || source.objectId,
    owningTeam: document.owner?.trim() || source.owningTeam,
    sourceName: document.title.trim() || source.sourceName,
    sourceUrl: normalizeSourceUrl(document.sourceUrl) ?? source.sourceUrl,
  };
}

function buildSourceSyncAuditEvent({
  actorId,
  correlationId,
  extractedRecordCount,
  failureState,
  occurredAt,
  source,
  syncStatus,
}: {
  actorId: string;
  correlationId: string;
  extractedRecordCount: number;
  failureState?: SourceIngestionFailureState;
  occurredAt: string;
  source: SourceLedgerRecord;
  syncStatus: SourceSyncStatus;
}): SourceSyncAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createUniqueId("evt", `${correlationId}-source-sync-${source.sourceId}`),
    eventType:
      syncStatus === "completed" ? "source.sync_completed" : "source.sync_failed",
    metadata: {
      extractedRecordCount,
      failureState,
      freshnessState: source.freshnessState,
      ingestionStatus: source.ingestionStatus,
      sourceId: source.sourceId,
      sourceSystem: source.sourceSystem,
      syncStatus,
    },
    occurredAt,
    sourceSystem: source.sourceSystem,
  };
}

function createPrototypeMicrosoftDocumentAdapterRecord(
  source: SourceLedgerRecord,
): MicrosoftDocumentAdapterRecord {
  return {
    documentKind: getDocumentKind(source.sourceType),
    lastModifiedAt: "2026-05-21T13:00:00.000Z",
    objectId: source.objectId,
    owner: source.owningTeam,
    sourceUrl: source.sourceUrl,
    textContent: [
      `${source.sourceName} contains approved launch guidance for source-backed answers.`,
      "Launch users should verify freshness, owner, and source location before reuse.",
    ].join("\n\n"),
    title: source.sourceName,
  };
}

function getDocumentKind(sourceType: SourceLedgerSourceType): MicrosoftDocumentKind {
  if (sourceType === "pdf_document") {
    return "pdf_document";
  }

  if (sourceType === "word_document") {
    return "word_document";
  }

  return "sharepoint_page";
}
