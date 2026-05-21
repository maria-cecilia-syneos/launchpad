import type { WorkspaceRole } from "./workspace";

export type SourceLedgerSystem =
  | "sharepoint"
  | "word_pdf"
  | "teams"
  | "email"
  | "ecrm_salesforce"
  | "smartsheet"
  | "playbook"
  | "asset"
  | "task"
  | "handoff";

export type SourceLedgerSourceType =
  | "sharepoint_site"
  | "word_document"
  | "pdf_document"
  | "teams_channel"
  | "email_mailbox"
  | "salesforce_record"
  | "smartsheet_sheet"
  | "playbook"
  | "approved_asset"
  | "launch_task"
  | "handoff_artifact";

export type SourceApprovalState =
  | "approved"
  | "draft"
  | "restricted"
  | "stale"
  | "inactive";

export type SourceFreshnessState =
  | "fresh"
  | "watch"
  | "stale"
  | "restricted";

export type SourceAccessState = "authorized" | "restricted";

export type SourceIngestionStatus =
  | "ready"
  | "not_started"
  | "syncing"
  | "complete"
  | "incomplete"
  | "failed"
  | "stale"
  | "restricted";

export type SourceLinkHealthState =
  | "healthy"
  | "missing"
  | "restricted"
  | "unverified";

export type SourceRegistrationAction = "created" | "updated";

export type SourceRegistrationInput = {
  sourceName: string;
  sourceType: SourceLedgerSourceType;
  owningTeam: string;
  sourceSystem: SourceLedgerSystem;
  approvalState: SourceApprovalState;
  freshnessState: SourceFreshnessState;
  accessState: SourceAccessState;
  ingestionStatus: SourceIngestionStatus;
  objectId?: string;
  sourceLinkHealth?: SourceLinkHealthState;
  sourceUrl?: string;
};

export type SourceLedgerRecord = Omit<
  SourceRegistrationInput,
  "sourceLinkHealth"
> & {
  sourceId: string;
  sourceLinkHealth: SourceLinkHealthState;
  registeredAt: string;
  lastRefreshedAt?: string;
};

export type VisibleSourceLedgerRecord = {
  accessState: SourceAccessState;
  approvalState: SourceApprovalState;
  displayName: string;
  displayOwner: string;
  displaySourceSystem: string;
  displaySourceType: string;
  freshnessState: SourceFreshnessState;
  ingestionStatus: SourceIngestionStatus;
  isRedacted: boolean;
  sourceLinkHealth: SourceLinkHealthState;
  sourceKey: string;
  sourceUrl?: string;
  statusMessage: string;
};

export type SourceRegistrationAuditEvent = {
  actorId: string;
  correlationId: string;
  eventId: string;
  eventType: `source.${SourceRegistrationAction}`;
  metadata: {
    action: SourceRegistrationAction;
    approvalState: SourceApprovalState;
    ingestionStatus: SourceIngestionStatus;
    sourceId: string;
    sourceSystem: SourceLedgerSystem;
  };
  occurredAt: string;
  sourceSystem: SourceLedgerSystem;
};

export const sourceSystemLabels: Record<SourceLedgerSystem, string> = {
  asset: "Asset",
  ecrm_salesforce: "ECRM/Salesforce",
  email: "Email",
  handoff: "Handoff artifact",
  playbook: "Playbook",
  sharepoint: "SharePoint",
  smartsheet: "Smartsheet",
  task: "Launch task",
  teams: "Teams",
  word_pdf: "Word/PDF",
};

export const sourceTypeLabels: Record<SourceLedgerSourceType, string> = {
  approved_asset: "Approved asset",
  email_mailbox: "Email mailbox",
  handoff_artifact: "Handoff artifact",
  launch_task: "Launch task",
  pdf_document: "PDF document",
  playbook: "Playbook",
  salesforce_record: "Salesforce record",
  sharepoint_site: "SharePoint site",
  smartsheet_sheet: "Smartsheet sheet",
  teams_channel: "Teams channel",
  word_document: "Word document",
};

export const approvalStateLabels: Record<SourceApprovalState, string> = {
  approved: "Approved",
  draft: "Draft",
  inactive: "Inactive",
  restricted: "Restricted",
  stale: "Stale",
};

export const freshnessStateLabels: Record<SourceFreshnessState, string> = {
  fresh: "Fresh",
  restricted: "Restricted",
  stale: "Stale",
  watch: "Watch",
};

export const accessStateLabels: Record<SourceAccessState, string> = {
  authorized: "Authorized",
  restricted: "Restricted",
};

export const ingestionStatusLabels: Record<SourceIngestionStatus, string> = {
  complete: "Complete",
  failed: "Failed",
  incomplete: "Incomplete",
  not_started: "Not started",
  ready: "Ready",
  restricted: "Restricted",
  stale: "Stale",
  syncing: "Syncing",
};

export const sourceLinkHealthLabels: Record<SourceLinkHealthState, string> = {
  healthy: "Healthy",
  missing: "Missing",
  restricted: "Restricted",
  unverified: "Unverified",
};

export const sourceTypesBySystem: Record<
  SourceLedgerSystem,
  SourceLedgerSourceType[]
> = {
  asset: ["approved_asset"],
  ecrm_salesforce: ["salesforce_record"],
  email: ["email_mailbox"],
  handoff: ["handoff_artifact"],
  playbook: ["playbook"],
  sharepoint: ["sharepoint_site"],
  smartsheet: ["smartsheet_sheet"],
  task: ["launch_task"],
  teams: ["teams_channel"],
  word_pdf: ["word_document", "pdf_document"],
};

type BuildRecordOptions = {
  registeredAt?: string;
  sourceId?: string;
};

type BuildAuditEventInput = {
  action: SourceRegistrationAction;
  actorId: string;
  correlationId?: string;
  occurredAt?: string;
  record: SourceLedgerRecord;
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
      .toLowerCase() || "source";

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

export function normalizeSourceUrl(sourceUrl?: string) {
  const trimmedUrl = sourceUrl?.trim();

  if (!trimmedUrl) {
    return undefined;
  }

  if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith("#")) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.protocol === "https:") {
      return trimmedUrl;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function validateSourceRegistration(input: SourceRegistrationInput) {
  const errors: string[] = [];
  const normalizedUrl = normalizeSourceUrl(input.sourceUrl);
  const hasSourceUrl = Boolean(input.sourceUrl?.trim());
  const hasObjectId = Boolean(input.objectId?.trim());

  if (!input.sourceName.trim()) {
    errors.push("Source name is required.");
  }

  if (!input.owningTeam.trim()) {
    errors.push("Owning team is required.");
  }

  if (hasSourceUrl && !normalizedUrl) {
    errors.push("Source link must use a safe internal path or HTTPS URL.");
  }

  if (!hasObjectId && !normalizedUrl) {
    errors.push("Source link or object ID is required.");
  }

  if (!sourceTypesBySystem[input.sourceSystem].includes(input.sourceType)) {
    errors.push("Source type must match the selected source system.");
  }

  return errors;
}

export function buildSourceRegistrationRecord(
  input: SourceRegistrationInput,
  options: BuildRecordOptions = {},
): SourceLedgerRecord {
  const normalizedSourceUrl = normalizeSourceUrl(input.sourceUrl);

  return {
    accessState: input.accessState,
    approvalState: input.approvalState,
    freshnessState: input.freshnessState,
    ingestionStatus: input.ingestionStatus,
    objectId: input.objectId?.trim() || undefined,
    owningTeam: input.owningTeam.trim(),
    registeredAt: options.registeredAt ?? createTimestamp(),
    sourceId:
      options.sourceId ??
      createUniqueId("src", `${input.sourceSystem}-${input.sourceName}`),
    sourceName: input.sourceName.trim(),
    sourceSystem: input.sourceSystem,
    sourceType: input.sourceType,
    sourceLinkHealth:
      input.sourceLinkHealth ??
      inferSourceLinkHealth({
        ...input,
        sourceUrl: normalizedSourceUrl,
      }),
    sourceUrl: normalizedSourceUrl,
  };
}

export function buildSourceRegistrationAuditEvent(
  input: BuildAuditEventInput,
): SourceRegistrationAuditEvent {
  const { action, actorId, record } = input;
  const correlationId =
    input.correlationId ?? createUniqueId("corr", `${action}-${record.sourceId}`);
  const occurredAt = input.occurredAt ?? createTimestamp();

  return {
    actorId,
    correlationId,
    eventId: createUniqueId(
      "evt",
      `${correlationId}-source-${action}-${record.sourceId}`,
    ),
    eventType: `source.${action}`,
    metadata: {
      action,
      approvalState: record.approvalState,
      ingestionStatus: record.ingestionStatus,
      sourceId: record.sourceId,
      sourceSystem: record.sourceSystem,
    },
    occurredAt,
    sourceSystem: record.sourceSystem,
  };
}

export function createPrototypeSourceRecords(): SourceLedgerRecord[] {
  return [
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
      ingestionStatus: "complete",
      objectId: "sharepoint-site-cardiomax",
      owningTeam: "Launch Operations",
        sourceName: "CARDIOMAX Launch Plan",
        sourceSystem: "sharepoint",
        sourceType: "sharepoint_site",
        sourceUrl: "/sources#cardiomax-launch-plan",
      },
      {
        registeredAt: "2026-05-21T12:00:00.000Z",
        sourceId: "src-cardiomax-launch-plan",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "stale",
        freshnessState: "stale",
        ingestionStatus: "stale",
        objectId: "smartsheet-cardiomax-status",
        owningTeam: "Project Management",
        sourceName: "CARDIOMAX Smartsheet Status",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
        sourceUrl: "/sources#cardiomax-smartsheet-status",
      },
      {
        registeredAt: "2026-05-21T12:10:00.000Z",
        sourceId: "src-cardiomax-smartsheet-status",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "teams-cardiomax-decisions",
        owningTeam: "Launch Operations",
        sourceName: "CARDIOMAX Teams Decisions",
        sourceSystem: "teams",
        sourceType: "teams_channel",
        sourceUrl: "https://teams.microsoft.com/l/channel/cardiomax-decisions",
      },
      {
        registeredAt: "2026-05-21T12:15:00.000Z",
        sourceId: "src-cardiomax-teams-decisions",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "006CARDIOMAX",
        owningTeam: "Sales Operations",
        sourceName: "CARDIOMAX Salesforce Launch Context",
        sourceSystem: "ecrm_salesforce",
        sourceType: "salesforce_record",
        sourceUrl:
          "https://example.my.salesforce.com/lightning/r/Opportunity/006CARDIOMAX/view",
      },
      {
        registeredAt: "2026-05-21T12:18:00.000Z",
        sourceId: "src-cardiomax-salesforce-context",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "restricted",
        approvalState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
        objectId: "restricted-commercial-plan",
        owningTeam: "Commercial Strategy",
        sourceName: "Restricted commercial launch plan",
        sourceSystem: "sharepoint",
        sourceType: "sharepoint_site",
      },
      {
        registeredAt: "2026-05-21T12:20:00.000Z",
        sourceId: "src-restricted-commercial-plan",
      },
    ),
  ];
}

export function toVisibleSourceRecord(
  record: SourceLedgerRecord,
  role: WorkspaceRole,
  index = 0,
): VisibleSourceLedgerRecord {
  const isRedacted = role !== "admin" && isRestrictedSource(record);

  if (isRedacted) {
    return {
      accessState: "restricted",
      approvalState: "restricted",
      displayName: "Restricted source",
      displayOwner: "Restricted",
      displaySourceSystem: "Restricted",
      displaySourceType: "Restricted",
      freshnessState: "restricted",
      ingestionStatus: "restricted",
      isRedacted,
      sourceKey: `restricted-source-${index}`,
      statusMessage: "Restricted source details are hidden.",
      sourceLinkHealth: "restricted",
    };
  }

  return {
    accessState: record.accessState,
    approvalState: record.approvalState,
    displayName: record.sourceName,
    displayOwner: record.owningTeam,
    displaySourceSystem: sourceSystemLabels[record.sourceSystem],
    displaySourceType: sourceTypeLabels[record.sourceType],
    freshnessState: record.freshnessState,
    ingestionStatus: record.ingestionStatus,
    isRedacted,
    sourceLinkHealth: record.sourceLinkHealth,
    sourceKey: record.sourceId,
    sourceUrl: record.sourceUrl,
    statusMessage: getSourceStatusMessage(record),
  };
}

export function filterVisibleSourceRecords(
  records: SourceLedgerRecord[],
  role: WorkspaceRole,
): VisibleSourceLedgerRecord[] {
  return records.map((record, index) => toVisibleSourceRecord(record, role, index));
}

export function getSourceLocationKey(
  source: Pick<SourceLedgerRecord, "objectId" | "sourceUrl">,
) {
  return source.objectId?.trim() || normalizeSourceUrl(source.sourceUrl);
}

export function hasSameSourceLedgerLocation(
  left: Pick<
    SourceLedgerRecord,
    "objectId" | "sourceSystem" | "sourceType" | "sourceUrl"
  >,
  right: Pick<
    SourceLedgerRecord,
    "objectId" | "sourceSystem" | "sourceType" | "sourceUrl"
  >,
) {
  const leftLocationKey = getSourceLocationKey(left);
  const rightLocationKey = getSourceLocationKey(right);

  return (
    Boolean(leftLocationKey) &&
    leftLocationKey === rightLocationKey &&
    left.sourceSystem === right.sourceSystem &&
    left.sourceType === right.sourceType
  );
}

export function isRestrictedSource(record: SourceLedgerRecord) {
  return (
    record.accessState === "restricted" ||
    record.approvalState === "restricted" ||
    record.freshnessState === "restricted" ||
    record.ingestionStatus === "restricted"
  );
}

function inferSourceLinkHealth(
  source: Pick<
    SourceRegistrationInput,
    "accessState" | "approvalState" | "freshnessState" | "sourceUrl"
  >,
): SourceLinkHealthState {
  if (
    source.accessState === "restricted" ||
    source.approvalState === "restricted" ||
    source.freshnessState === "restricted"
  ) {
    return "restricted";
  }

  return source.sourceUrl ? "healthy" : "unverified";
}

function getSourceStatusMessage(record: SourceLedgerRecord) {
  if (record.ingestionStatus === "complete") {
    return "Source content is synced and ready for retrieval.";
  }

  if (record.ingestionStatus === "syncing") {
    return "Source ingestion is in progress.";
  }

  if (record.ingestionStatus === "failed") {
    return "Ingestion failed with a user-safe reason.";
  }

  if (record.ingestionStatus === "incomplete") {
    return "Ingestion is incomplete.";
  }

  if (record.freshnessState === "stale" || record.ingestionStatus === "stale") {
    return "Source freshness needs review.";
  }

  if (record.accessState === "restricted") {
    return "Restricted source details are hidden.";
  }

  return "Source is ready for future ingestion.";
}
