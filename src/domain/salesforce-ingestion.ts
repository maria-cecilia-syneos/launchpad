import {
  getSourceLocationKey,
  normalizeSourceUrl,
  type SourceAccessState,
  type SourceApprovalState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
  type SourceLedgerSystem,
} from "./source-ledger";

export type SalesforceReasonState =
  | "access_restricted"
  | "connector_unavailable"
  | "missing_information";

export type SalesforceSyncStatus = "completed" | "failed" | "skipped";

export type SalesforceFieldMapping = {
  accountClientLabel: string;
  commercialContext: string[];
  launchId: string;
  opportunityOrEngagementId: string;
  sourceUrl?: string;
  stakeholderNamesOrRoles: string[];
};

export type SalesforceAdapterRecord = {
  accessState: SourceAccessState;
  fieldMapping: SalesforceFieldMapping;
  fieldValues: Record<string, unknown>;
  lastModifiedAt: string;
  objectApiName: string;
  objectId?: string;
  permittedFieldNames: string[];
  sourceUrl?: string;
};

export type SalesforceLaunchContextRecord = {
  accountClientLabel: string;
  commercialContext: string[];
  contextRecordId: string;
  launchId: string;
  opportunityOrEngagementId: string;
  approvalState: SourceApprovalState;
  accessState: SourceAccessState;
  freshnessState: SourceFreshnessState;
  refreshedAt: string;
  sourceId: string;
  sourceLocationKey: string;
  sourceObjectId?: string;
  sourceSystem: SourceLedgerSystem;
  sourceUrl?: string;
  stakeholderNamesOrRoles: string[];
};

export type SalesforceSyncAuditEvent = {
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
    reasonState?: SalesforceReasonState;
    sourceId: string;
    sourceSystem: SourceLedgerSystem;
    syncStatus: SalesforceSyncStatus;
  };
  occurredAt: string;
  sourceSystem: SourceLedgerSystem;
  systemActor?: string;
};

export type SalesforceIngestionResult = {
  auditEvent: SalesforceSyncAuditEvent;
  correlationId: string;
  launchContextRecords: SalesforceLaunchContextRecord[];
  reasonState?: SalesforceReasonState;
  syncStatus: SalesforceSyncStatus;
  updatedSource: SourceLedgerRecord;
  userSafeReason?: string;
};

type BuildSalesforceLaunchContextIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  record: SalesforceAdapterRecord;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type BuildSalesforceSyncOutcomeInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  reasonState: SalesforceReasonState;
  source: SourceLedgerRecord;
  systemActor?: string;
};

type RunPrototypeSalesforceIngestionInput = {
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
  source: SourceLedgerRecord;
  systemActor?: string;
};

export const defaultSalesforceFieldMapping: SalesforceFieldMapping = {
  accountClientLabel: "Account_Name__c",
  commercialContext: ["Commercial_Context__c"],
  launchId: "Launch_Id__c",
  opportunityOrEngagementId: "Opportunity_Number__c",
  sourceUrl: "Record_Url__c",
  stakeholderNamesOrRoles: ["Stakeholder_Role__c"],
};

const salesforceReasonMessages: Record<SalesforceReasonState, string> = {
  access_restricted:
    "Access restricted. Salesforce launch context is not available for this user or role.",
  connector_unavailable:
    "Salesforce launch context could not be retrieved. Check connector availability and source access.",
  missing_information:
    "Salesforce launch context is missing required mapped launch fields.",
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
      .toLowerCase() || "salesforce";

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

export function canIngestSalesforceSource(source: SourceLedgerRecord) {
  if (
    source.approvalState !== "approved" ||
    source.accessState !== "authorized" ||
    source.freshnessState === "restricted" ||
    source.ingestionStatus === "restricted" ||
    !getSourceLocationKey(source)
  ) {
    return false;
  }

  return (
    source.sourceSystem === "ecrm_salesforce" &&
    source.sourceType === "salesforce_record"
  );
}

export function buildSalesforceLaunchContextIngestionResult({
  actorId,
  correlationId,
  occurredAt,
  record,
  source,
  systemActor,
}: BuildSalesforceLaunchContextIngestionInput): SalesforceIngestionResult {
  if (!canIngestSalesforceSource(source)) {
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  if (record.accessState !== "authorized") {
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  const launchContextRecords = buildSalesforceLaunchContextRecords(source, record);

  if (launchContextRecords.length === 0) {
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  const updatedSource = normalizeSalesforceSource(
    source,
    record,
    launchContextRecords[0],
  );
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `salesforce-sync-${source.sourceId}`);
  const auditEvent = buildSalesforceSyncAuditEvent({
    actorId,
    contextRecordCount: launchContextRecords.length,
    correlationId: syncCorrelationId,
    occurredAt: syncOccurredAt,
    source: updatedSource,
    syncStatus: "completed",
    systemActor,
  });

  return {
    auditEvent,
    correlationId: syncCorrelationId,
    launchContextRecords,
    syncStatus: "completed",
    updatedSource,
  };
}

export function runPrototypeSalesforceIngestion({
  actorId,
  correlationId,
  occurredAt,
  source,
  systemActor,
}: RunPrototypeSalesforceIngestionInput): SalesforceIngestionResult {
  if (!canIngestSalesforceSource(source)) {
    return buildSalesforceSyncOutcome({
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
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "connector_unavailable",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("access-restricted")) {
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "access_restricted",
      source,
      systemActor,
    });
  }

  if (sourceKey.includes("missing")) {
    return buildSalesforceSyncOutcome({
      actorId,
      correlationId,
      occurredAt,
      reasonState: "missing_information",
      source,
      systemActor,
    });
  }

  return buildSalesforceLaunchContextIngestionResult({
    actorId,
    correlationId,
    occurredAt,
    record: createPrototypeSalesforceAdapterRecord(source),
    source,
    systemActor,
  });
}

export function getSalesforceIngestionResultMessage(
  result: SalesforceIngestionResult,
) {
  if (result.userSafeReason) {
    return result.userSafeReason;
  }

  const recordCount = result.launchContextRecords.length;
  const noun = recordCount === 1 ? "record" : "records";

  return `${recordCount} Salesforce launch context ${noun} prepared for retrieval.`;
}

function buildSalesforceSyncOutcome({
  actorId,
  correlationId,
  occurredAt,
  reasonState,
  source,
  systemActor,
}: BuildSalesforceSyncOutcomeInput): SalesforceIngestionResult {
  const syncOccurredAt = occurredAt ?? createTimestamp();
  const syncCorrelationId =
    correlationId ?? createUniqueId("corr", `salesforce-sync-${source.sourceId}`);
  const syncStatus: SalesforceSyncStatus =
    reasonState === "connector_unavailable" ? "failed" : "skipped";
  const updatedSource = buildOutcomeSource(source, reasonState, syncOccurredAt);
  const auditEvent = buildSalesforceSyncAuditEvent({
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
    correlationId: syncCorrelationId,
    launchContextRecords: [],
    reasonState,
    syncStatus,
    updatedSource,
    userSafeReason: salesforceReasonMessages[reasonState],
  };
}

function buildOutcomeSource(
  source: SourceLedgerRecord,
  reasonState: SalesforceReasonState,
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

function buildSalesforceLaunchContextRecords(
  source: SourceLedgerRecord,
  record: SalesforceAdapterRecord,
): SalesforceLaunchContextRecord[] {
  const fieldMapping = normalizeSalesforceFieldMapping(record.fieldMapping);
  const accountClientLabel = getMappedString(
    record,
    fieldMapping.accountClientLabel,
  );
  const launchId = getMappedString(record, fieldMapping.launchId);
  const opportunityOrEngagementId = getMappedString(
    record,
    fieldMapping.opportunityOrEngagementId,
  );

  if (!accountClientLabel || !launchId || !opportunityOrEngagementId) {
    return [];
  }

  const sourceLocationKey = getSourceLocationKey(source);
  const mappedSourceUrl = getMappedSourceUrl(record, fieldMapping.sourceUrl);
  const normalizedRecordSourceUrl =
    mappedSourceUrl ?? normalizeSourceUrl(record.sourceUrl);

  if (
    !sourceLocationKey ||
    hasMismatchedSalesforceIdentity({
      record,
      recordSourceUrl: normalizedRecordSourceUrl,
      source,
    })
  ) {
    return [];
  }

  const sourceObjectId = record.objectId?.trim() || source.objectId;
  const sourceUrl = normalizedRecordSourceUrl ?? normalizeSourceUrl(source.sourceUrl);

  return [
    {
      accessState: source.accessState,
      accountClientLabel,
      approvalState: source.approvalState,
      commercialContext: getMappedStringList(
        record,
        fieldMapping.commercialContext,
      ),
      contextRecordId: createSafeId(
        "sfctx",
        `${source.sourceId}-${sourceLocationKey}-${sourceObjectId ?? accountClientLabel}`,
      ),
      freshnessState: "fresh",
      launchId,
      opportunityOrEngagementId,
      refreshedAt: record.lastModifiedAt,
      sourceId: source.sourceId,
      sourceLocationKey,
      sourceObjectId,
      sourceSystem: source.sourceSystem,
      sourceUrl,
      stakeholderNamesOrRoles: getMappedStringList(
        record,
        fieldMapping.stakeholderNamesOrRoles,
      ),
    },
  ];
}

function normalizeSalesforceSource(
  source: SourceLedgerRecord,
  record: SalesforceAdapterRecord,
  contextRecord: SalesforceLaunchContextRecord,
): SourceLedgerRecord {
  return {
    ...source,
    accessState: "authorized",
    freshnessState: "fresh",
    ingestionStatus: "complete",
    lastRefreshedAt: record.lastModifiedAt,
    objectId: contextRecord.sourceObjectId ?? source.objectId,
    sourceName: `${contextRecord.accountClientLabel} Salesforce Context`,
    sourceLinkHealth: contextRecord.sourceUrl ? "healthy" : "missing",
    sourceUrl: contextRecord.sourceUrl ?? normalizeSourceUrl(source.sourceUrl),
  };
}

function getMappedString(record: SalesforceAdapterRecord, fieldName?: string) {
  if (
    !fieldName ||
    isUnsafeMappedFieldName(fieldName) ||
    !record.permittedFieldNames.includes(fieldName)
  ) {
    return undefined;
  }

  return normalizeFieldValue(record.fieldValues[fieldName]);
}

function getMappedStringList(
  record: SalesforceAdapterRecord,
  fieldNames: string[],
) {
  return getMappedFieldList(fieldNames)
    .flatMap((fieldName) => {
      if (
        isUnsafeMappedFieldName(fieldName) ||
        !record.permittedFieldNames.includes(fieldName)
      ) {
        return [];
      }

      return normalizeFieldValueList(record.fieldValues[fieldName]);
    })
    .filter(Boolean);
}

function getMappedFieldList(fieldNames: unknown): string[] {
  return Array.isArray(fieldNames)
    ? fieldNames.filter(
        (fieldName): fieldName is string => typeof fieldName === "string",
      )
    : [];
}

function getMappedSourceUrl(
  record: SalesforceAdapterRecord,
  sourceUrlField?: string,
) {
  return normalizeSourceUrl(getMappedString(record, sourceUrlField));
}

function normalizeSalesforceFieldMapping(fieldMapping: unknown) {
  const mapping =
    fieldMapping && typeof fieldMapping === "object"
      ? (fieldMapping as Partial<SalesforceFieldMapping>)
      : {};

  return {
    accountClientLabel:
      typeof mapping.accountClientLabel === "string"
        ? mapping.accountClientLabel
        : undefined,
    commercialContext: getMappedFieldList(mapping.commercialContext),
    launchId:
      typeof mapping.launchId === "string" ? mapping.launchId : undefined,
    opportunityOrEngagementId:
      typeof mapping.opportunityOrEngagementId === "string"
        ? mapping.opportunityOrEngagementId
        : undefined,
    sourceUrl:
      typeof mapping.sourceUrl === "string" ? mapping.sourceUrl : undefined,
    stakeholderNamesOrRoles: getMappedFieldList(mapping.stakeholderNamesOrRoles),
  };
}

function hasMismatchedSalesforceIdentity({
  record,
  recordSourceUrl,
  source,
}: {
  record: SalesforceAdapterRecord;
  recordSourceUrl?: string;
  source: SourceLedgerRecord;
}) {
  const sourceObjectId = source.objectId?.trim();
  const recordObjectId = record.objectId?.trim();
  const sourceUrl = normalizeSourceUrl(source.sourceUrl);

  if (sourceObjectId && recordObjectId && sourceObjectId !== recordObjectId) {
    return true;
  }

  if (sourceUrl && recordSourceUrl && sourceUrl !== recordSourceUrl) {
    return true;
  }

  return false;
}

function isUnsafeMappedFieldName(fieldName: string) {
  return /authorization|bearer|client.?secret|credential|password|payload|raw|secret|session|token/i.test(
    fieldName,
  );
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

function normalizeFieldValueList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeFieldValue(item))
      .filter((item): item is string => Boolean(item));
  }

  const normalizedValue = normalizeFieldValue(value);

  return normalizedValue ? [normalizedValue] : [];
}

function buildSalesforceSyncAuditEvent({
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
  reasonState?: SalesforceReasonState;
  source: SourceLedgerRecord;
  syncStatus: SalesforceSyncStatus;
  systemActor?: string;
}): SalesforceSyncAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createUniqueId(
      "evt",
      `${correlationId}-salesforce-sync-${source.sourceId}`,
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

function getAuditEventType(syncStatus: SalesforceSyncStatus) {
  if (syncStatus === "completed") {
    return "source.sync_completed";
  }

  if (syncStatus === "failed") {
    return "source.sync_failed";
  }

  return "source.sync_skipped";
}

function createPrototypeSalesforceAdapterRecord(
  source: SourceLedgerRecord,
): SalesforceAdapterRecord {
  const sourceUrl = source.sourceUrl;

  return {
    accessState: "authorized",
    fieldMapping: defaultSalesforceFieldMapping,
    fieldValues: {
      Account_Name__c: "CARDIOMAX",
      Commercial_Context__c: "Phase 2 expansion is in contracting.",
      Launch_Id__c: "launch-cardiomax-2026",
      Opportunity_Number__c: "OPP-4242",
      ...(sourceUrl ? { Record_Url__c: sourceUrl } : {}),
      Stakeholder_Role__c: "Regional VP sponsor",
    },
    lastModifiedAt: "2026-05-21T14:30:00.000Z",
    objectApiName: "Opportunity",
    objectId: source.objectId,
    permittedFieldNames: [
      "Account_Name__c",
      "Commercial_Context__c",
      "Launch_Id__c",
      "Opportunity_Number__c",
      ...(sourceUrl ? ["Record_Url__c"] : []),
      "Stakeholder_Role__c",
    ],
    sourceUrl,
  };
}
