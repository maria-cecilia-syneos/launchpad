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
  displayObjectId?: string;
  displayName: string;
  displayOwner: string;
  displaySourceId?: string;
  displaySourceSystem: string;
  displaySourceType: string;
  freshnessState: SourceFreshnessState;
  ingestionHistorySummary: string;
  ingestionStatus: SourceIngestionStatus;
  isRedacted: boolean;
  lastRefreshedAt?: string;
  registeredAt?: string;
  sourceLinkHealth: SourceLinkHealthState;
  sourceKey: string;
  sourceUrl?: string;
  statusMessage: string;
};

export type SourceLedgerFilters = {
  accessState: SourceAccessState | "";
  approvalState: SourceApprovalState | "";
  freshnessState: SourceFreshnessState | "";
  ingestionStatus: SourceIngestionStatus | "";
  owner: string;
  query: string;
  sourceSystem: SourceLedgerSystem | "";
  sourceType: SourceLedgerSourceType | "";
};

export type SourceLedgerActiveFilter = {
  key: keyof SourceLedgerFilters;
  label: string;
  value: string;
};

export type SourceLedgerSearchResult = VisibleSourceLedgerRecord & {
  matchRationale: string;
  nextAction: string;
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

export const defaultSourceLedgerFilters: SourceLedgerFilters = {
  accessState: "",
  approvalState: "",
  freshnessState: "",
  ingestionStatus: "",
  owner: "",
  query: "",
  sourceSystem: "",
  sourceType: "",
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
    if (hasCredentialQueryParams(trimmedUrl)) {
      return undefined;
    }

    return trimmedUrl;
  }

  if (trimmedUrl.startsWith("#")) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (
      parsedUrl.protocol === "https:" &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      !hasCredentialQueryParams(parsedUrl.search)
    ) {
      return trimmedUrl;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function hasCredentialQueryParams(urlOrSearch: string) {
  const queryStart = urlOrSearch.indexOf("?");
  const search =
    urlOrSearch.startsWith("?")
      ? urlOrSearch
      : queryStart >= 0
        ? urlOrSearch.slice(queryStart)
        : "";

  if (!search) {
    return false;
  }

  const params = new URLSearchParams(search);

  return [...params.keys()].some((key) =>
    /access.?token|authorization|bearer|client.?secret|credential|password|secret|session|token/i.test(
      key,
    ),
  );
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
        objectId: "smartsheet-cardiomax-approved-status",
        owningTeam: "Project Management",
        sourceName: "CARDIOMAX Approved Smartsheet Status",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      {
        registeredAt: "2026-05-21T12:12:00.000Z",
        sourceId: "src-cardiomax-smartsheet-approved-status",
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
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "playbook-cardiomax-tier-2",
        owningTeam: "Launch Excellence",
        sourceName: "CARDIOMAX Tier 2 Launch Playbook",
        sourceSystem: "playbook",
        sourceType: "playbook",
        sourceUrl: "/sources#cardiomax-tier-2-playbook",
      },
      {
        registeredAt: "2026-05-21T12:22:00.000Z",
        sourceId: "src-cardiomax-tier-2-playbook",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "assets-cardiomax-approved",
        owningTeam: "Learning Solutions",
        sourceName: "CARDIOMAX Approved Asset Library",
        sourceSystem: "asset",
        sourceType: "approved_asset",
        sourceUrl: "/sources#cardiomax-approved-assets",
      },
      {
        registeredAt: "2026-05-21T12:24:00.000Z",
        sourceId: "src-cardiomax-approved-assets",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "handoff-cardiomax-deployment",
        owningTeam: "Deployment Solutions",
        sourceName: "CARDIOMAX Deployment Handoff",
        sourceSystem: "handoff",
        sourceType: "handoff_artifact",
        sourceUrl: "/sources#cardiomax-deployment-handoff",
      },
      {
        registeredAt: "2026-05-21T12:26:00.000Z",
        sourceId: "src-cardiomax-deployment-handoff",
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
      ingestionHistorySummary: "Restricted ingestion history is hidden.",
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
    displayObjectId: record.objectId,
    displayName: record.sourceName,
    displayOwner: record.owningTeam,
    displaySourceId: record.sourceId,
    displaySourceSystem: sourceSystemLabels[record.sourceSystem],
    displaySourceType: sourceTypeLabels[record.sourceType],
    freshnessState: record.freshnessState,
    ingestionHistorySummary: getVisibleIngestionHistorySummary(record),
    ingestionStatus: record.ingestionStatus,
    isRedacted,
    lastRefreshedAt: record.lastRefreshedAt,
    registeredAt: record.registeredAt,
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

export function filterSourceLedgerResults(
  visibleSources: VisibleSourceLedgerRecord[],
  filters: SourceLedgerFilters,
  options: { isAdmin?: boolean } = {},
): SourceLedgerSearchResult[] {
  return visibleSources
    .filter((source) => sourceMatchesFilters(source, filters))
    .map((source) => ({
      ...source,
      matchRationale: getSourceMatchRationale(source, filters),
      nextAction: getSourceLedgerNextAction(source, Boolean(options.isAdmin)),
    }));
}

export function hasActiveSourceLedgerFilters(filters: SourceLedgerFilters) {
  return getActiveSourceLedgerFilters(filters).length > 0;
}

export function getActiveSourceLedgerFilters(
  filters: SourceLedgerFilters,
): SourceLedgerActiveFilter[] {
  const activeFilters: SourceLedgerActiveFilter[] = [];
  const query = normalizeSearchValue(filters.query);
  const owner = normalizeSearchValue(filters.owner);

  if (query) {
    activeFilters.push({
      key: "query",
      label: "Search",
      value: filters.query.trim(),
    });
  }

  if (filters.sourceSystem) {
    activeFilters.push({
      key: "sourceSystem",
      label: "Source system",
      value: sourceSystemLabels[filters.sourceSystem],
    });
  }

  if (filters.sourceType) {
    activeFilters.push({
      key: "sourceType",
      label: "Source type",
      value: sourceTypeLabels[filters.sourceType],
    });
  }

  if (filters.approvalState) {
    activeFilters.push({
      key: "approvalState",
      label: "Approval",
      value: approvalStateLabels[filters.approvalState],
    });
  }

  if (filters.freshnessState) {
    activeFilters.push({
      key: "freshnessState",
      label: "Freshness",
      value: freshnessStateLabels[filters.freshnessState],
    });
  }

  if (filters.accessState) {
    activeFilters.push({
      key: "accessState",
      label: "Access",
      value: accessStateLabels[filters.accessState],
    });
  }

  if (filters.ingestionStatus) {
    activeFilters.push({
      key: "ingestionStatus",
      label: "Ingestion",
      value: ingestionStatusLabels[filters.ingestionStatus],
    });
  }

  if (owner) {
    activeFilters.push({
      key: "owner",
      label: "Owner",
      value: filters.owner.trim(),
    });
  }

  return activeFilters;
}

export function getSourceLedgerResultSummary(
  totalVisible: number,
  filteredCount: number,
  hasActiveFilters: boolean,
) {
  if (!hasActiveFilters) {
    return `${formatCount(totalVisible, "source record")} available.`;
  }

  return `${filteredCount} of ${totalVisible} source records match current filters.`;
}

export function getSourceLedgerNextAction(
  source: Pick<
    VisibleSourceLedgerRecord,
    | "accessState"
    | "freshnessState"
    | "ingestionStatus"
    | "isRedacted"
    | "sourceLinkHealth"
  >,
  isAdmin = false,
) {
  if (source.accessState === "restricted" || source.isRedacted) {
    return isAdmin
      ? "Review access permissions before sharing source details."
      : "Access is restricted. Ask an admin if you need this source.";
  }

  if (source.ingestionStatus === "failed") {
    return isAdmin
      ? "Retry ingestion or check connector and source access."
      : "Ask an admin to review the failed ingestion.";
  }

  if (source.ingestionStatus === "incomplete") {
    return isAdmin
      ? "Review missing source information before relying on this source."
      : "Ask an admin to complete the missing source information.";
  }

  if (source.freshnessState === "stale" || source.ingestionStatus === "stale") {
    return isAdmin
      ? "Refresh this source or verify the latest source freshness."
      : "Ask an admin to refresh this stale source.";
  }

  if (
    source.sourceLinkHealth === "missing" ||
    source.sourceLinkHealth === "unverified"
  ) {
    return isAdmin
      ? "Confirm the source link before opening or citing this source."
      : "Ask an admin to confirm the source link.";
  }

  if (source.sourceLinkHealth === "restricted") {
    return isAdmin
      ? "Review source-link permissions before opening this source."
      : "Source-link access is restricted.";
  }

  return isAdmin
    ? "No immediate admin action needed."
    : "No immediate action needed.";
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

function sourceMatchesFilters(
  source: VisibleSourceLedgerRecord,
  filters: SourceLedgerFilters,
) {
  const owner = normalizeSearchValue(filters.owner);

  if (filters.sourceSystem && source.displaySourceSystem !== sourceSystemLabels[filters.sourceSystem]) {
    return false;
  }

  if (filters.sourceType && source.displaySourceType !== sourceTypeLabels[filters.sourceType]) {
    return false;
  }

  if (filters.approvalState && source.approvalState !== filters.approvalState) {
    return false;
  }

  if (filters.freshnessState && source.freshnessState !== filters.freshnessState) {
    return false;
  }

  if (filters.accessState && source.accessState !== filters.accessState) {
    return false;
  }

  if (filters.ingestionStatus && source.ingestionStatus !== filters.ingestionStatus) {
    return false;
  }

  if (owner && !normalizeSearchValue(source.displayOwner).includes(owner)) {
    return false;
  }

  const query = normalizeSearchValue(filters.query);

  return !query || getQueryMatchLabels(source, query).length > 0;
}

function getSourceMatchRationale(
  source: VisibleSourceLedgerRecord,
  filters: SourceLedgerFilters,
) {
  const filterMatchLabels = getActiveFilterMatchLabels(filters);
  const query = normalizeSearchValue(filters.query);
  const queryMatchLabels = query ? getQueryMatchLabels(source, query) : [];
  const labels =
    queryMatchLabels.length > 0
      ? [...queryMatchLabels.slice(0, 1), ...filterMatchLabels]
      : filterMatchLabels;

  if (labels.length === 0) {
    return "Visible because no filters are active.";
  }

  return `Matched ${joinMatchLabels(labels)}.`;
}

function getActiveFilterMatchLabels(filters: SourceLedgerFilters) {
  return [
    filters.sourceSystem ? "source system" : undefined,
    filters.sourceType ? "source type" : undefined,
    filters.approvalState ? "approval" : undefined,
    filters.freshnessState ? "freshness" : undefined,
    filters.accessState ? "access" : undefined,
    filters.ingestionStatus ? "ingestion" : undefined,
    normalizeSearchValue(filters.owner) ? "owner" : undefined,
  ].filter((label): label is string => Boolean(label));
}

function getQueryMatchLabels(source: VisibleSourceLedgerRecord, query: string) {
  const values: Array<{ label: string; value?: string }> = [
    { label: "source system", value: source.displaySourceSystem },
    { label: "source type", value: source.displaySourceType },
    { label: "approval", value: approvalStateLabels[source.approvalState] },
    { label: "freshness", value: freshnessStateLabels[source.freshnessState] },
    { label: "access", value: accessStateLabels[source.accessState] },
    { label: "ingestion", value: ingestionStatusLabels[source.ingestionStatus] },
    {
      label: "source-link health",
      value: sourceLinkHealthLabels[source.sourceLinkHealth],
    },
    { label: "title", value: source.displayName },
    { label: "owner", value: source.displayOwner },
  ];

  return values
    .filter(({ value }) => normalizeSearchValue(value).includes(query))
    .map(({ label }) => label);
}

function normalizeSearchValue(value?: string) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function joinMatchLabels(labels: string[]) {
  const uniqueLabels = [...new Set(labels)];

  if (uniqueLabels.length === 1) {
    return uniqueLabels[0];
  }

  if (uniqueLabels.length === 2) {
    return `${uniqueLabels[0]} and ${uniqueLabels[1]}`;
  }

  return `${uniqueLabels.slice(0, -1).join(", ")}, and ${uniqueLabels.at(-1)}`;
}

function formatCount(count: number, singularNoun: string) {
  return `${count} ${singularNoun}${count === 1 ? "" : "s"}`;
}

function getVisibleIngestionHistorySummary(record: SourceLedgerRecord) {
  const status = ingestionStatusLabels[record.ingestionStatus].toLowerCase();

  if (record.lastRefreshedAt) {
    return `Latest ingestion status is ${status}; last refreshed ${record.lastRefreshedAt}.`;
  }

  return `Latest ingestion status is ${status}; registered ${record.registeredAt}.`;
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
