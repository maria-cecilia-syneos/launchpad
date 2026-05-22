import { describe, expect, it } from "vitest";

import {
  buildSourceRegistrationAuditEvent,
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
  defaultSourceLedgerFilters,
  filterVisibleSourceRecords,
  filterSourceLedgerResults,
  getActiveSourceLedgerFilters,
  getSourceLedgerNextAction,
  getSourceLedgerResultSummary,
  hasActiveSourceLedgerFilters,
  validateSourceRegistration,
  type SourceLedgerFilters,
  type SourceRegistrationInput,
} from "./source-ledger";

const validInput: SourceRegistrationInput = {
  accessState: "authorized",
  approvalState: "approved",
  freshnessState: "fresh",
  ingestionStatus: "ready",
  objectId: "sharepoint-site-cardiomax",
  owningTeam: "Launch Operations",
  sourceName: "CARDIOMAX Launch Plan",
  sourceSystem: "sharepoint",
  sourceType: "sharepoint_site",
  sourceUrl: "/sources#cardiomax-launch-plan",
};

describe("source ledger domain helpers", () => {
  it("normalizes source registration metadata without storing raw connector payloads", () => {
    const record = buildSourceRegistrationRecord(({
      ...validInput,
      connectorPayload: {
        rawGraphResponse: "do-not-store",
        secretField: "sensitive",
      },
    }) as SourceRegistrationInput);

    expect(record).toMatchObject({
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "fresh",
      ingestionStatus: "ready",
      objectId: "sharepoint-site-cardiomax",
      owningTeam: "Launch Operations",
      sourceName: "CARDIOMAX Launch Plan",
      sourceSystem: "sharepoint",
      sourceType: "sharepoint_site",
      sourceUrl: "/sources#cardiomax-launch-plan",
    });
    expect(JSON.stringify(record)).not.toContain("rawGraphResponse");
    expect(JSON.stringify(record)).not.toContain("secretField");
  });

  it("redacts restricted source details for non-admin roles", () => {
    const restrictedRecord = createPrototypeSourceRecords().find(
      (record) => record.accessState === "restricted",
    );

    expect(restrictedRecord).toBeDefined();

    const nonAdminVisible = filterVisibleSourceRecords(
      [restrictedRecord!],
      "project-manager",
    );
    const adminVisible = filterVisibleSourceRecords(
      [restrictedRecord!],
      "admin",
    );

    expect(nonAdminVisible[0]).toMatchObject({
      displayName: "Restricted source",
      displayOwner: "Restricted",
      displaySourceSystem: "Restricted",
      displaySourceType: "Restricted",
      sourceKey: "restricted-source-0",
      isRedacted: true,
      statusMessage: "Restricted source details are hidden.",
    });
    expect(nonAdminVisible[0]).not.toHaveProperty("sourceId");
    expect(nonAdminVisible[0]).not.toHaveProperty("objectId");
    expect(nonAdminVisible[0]).not.toHaveProperty("owningTeam");
    expect(nonAdminVisible[0]).not.toHaveProperty("sourceName");
    expect(nonAdminVisible[0]).not.toHaveProperty("sourceSystem");
    expect(nonAdminVisible[0]).not.toHaveProperty("sourceType");
    expect(JSON.stringify(nonAdminVisible[0])).not.toContain(restrictedRecord!.sourceId);
    expect(JSON.stringify(nonAdminVisible[0])).not.toContain(restrictedRecord!.sourceName);
    expect(JSON.stringify(nonAdminVisible[0])).not.toContain(restrictedRecord!.owningTeam);
    expect(adminVisible[0]).toMatchObject({
      displayName: restrictedRecord!.sourceName,
      displayOwner: restrictedRecord!.owningTeam,
      displaySourceSystem: "SharePoint",
      isRedacted: false,
    });
  });

  it("rejects missing required registration metadata", () => {
    expect(
      validateSourceRegistration({
        ...validInput,
        owningTeam: "",
        sourceName: "",
      }),
    ).toEqual([
      "Source name is required.",
      "Owning team is required.",
    ]);
  });

  it("rejects unsafe links, missing locations, and mismatched source types", () => {
    expect(
      validateSourceRegistration({
        ...validInput,
        objectId: "",
        sourceSystem: "teams",
        sourceType: "salesforce_record",
        sourceUrl: "javascript:alert(1)",
      }),
    ).toEqual([
      "Source link must use a safe internal path or HTTPS URL.",
      "Source link or object ID is required.",
      "Source type must match the selected source system.",
    ]);

    expect(
      validateSourceRegistration({
        ...validInput,
        objectId: "",
        sourceUrl: "https://token@example.com/source?access_token=secret",
      }),
    ).toEqual([
      "Source link must use a safe internal path or HTTPS URL.",
      "Source link or object ID is required.",
    ]);
  });

  it("creates audit-safe source registration events", () => {
    const record = buildSourceRegistrationRecord(validInput, {
      registeredAt: "2026-05-21T12:00:00.000Z",
      sourceId: "src-cardiomax-launch-plan",
    });
    const event = buildSourceRegistrationAuditEvent({
      action: "created",
      actorId: "Admin Reviewer",
      correlationId: "corr-source-1",
      occurredAt: "2026-05-21T12:01:00.000Z",
      record,
    });

    expect(event).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-source-1",
      eventType: "source.created",
      metadata: {
        action: "created",
        sourceId: "src-cardiomax-launch-plan",
        sourceSystem: "sharepoint",
      },
      occurredAt: "2026-05-21T12:01:00.000Z",
      sourceSystem: "sharepoint",
    });
    expect(JSON.stringify(event)).not.toContain("CARDIOMAX Launch Plan");
  });

  it("keeps audit event ids unique when correlation ids are reused", () => {
    const firstRecord = buildSourceRegistrationRecord(validInput, {
      sourceId: "src-cardiomax-launch-plan",
    });
    const secondRecord = buildSourceRegistrationRecord(
      {
        ...validInput,
        objectId: "sharepoint-site-cardiomax-two",
        sourceName: "CARDIOMAX Launch Plan Two",
      },
      {
        sourceId: "src-cardiomax-launch-plan-two",
      },
    );
    const firstEvent = buildSourceRegistrationAuditEvent({
      action: "created",
      actorId: "Admin Reviewer",
      correlationId: "corr-source-batch",
      record: firstRecord,
    });
    const secondEvent = buildSourceRegistrationAuditEvent({
      action: "created",
      actorId: "Admin Reviewer",
      correlationId: "corr-source-batch",
      record: secondRecord,
    });

    expect(firstEvent.eventId).not.toBe(secondEvent.eventId);
  });

  it("filters visible source records by text, metadata filters, and owner", () => {
    const visibleSources = filterVisibleSourceRecords(
      createPrototypeSourceRecords(),
      "admin",
    );

    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        query: "salesforce",
      }),
    ).toEqual([
      expect.objectContaining({
        displayName: "CARDIOMAX Salesforce Launch Context",
        matchRationale: "Matched source system.",
      }),
    ]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        approvalState: "approved",
        sourceSystem: "asset",
      }),
    ).toEqual([
      expect.objectContaining({
        displayName: "CARDIOMAX Approved Asset Library",
        matchRationale: "Matched source system and approval.",
      }),
    ]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        sourceType: "handoff_artifact",
      }).map((source) => source.displayName),
    ).toEqual(["CARDIOMAX Deployment Handoff"]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        freshnessState: "stale",
      }).map((source) => source.displayName),
    ).toEqual(["CARDIOMAX Smartsheet Status"]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        ingestionStatus: "complete",
      }).map((source) => source.displayName),
    ).toEqual(["CARDIOMAX Launch Plan"]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        accessState: "restricted",
      }).map((source) => source.displayName),
    ).toEqual(["Restricted commercial launch plan"]);
    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        owner: "deployment",
      }).map((source) => source.displayName),
    ).toEqual(["CARDIOMAX Deployment Handoff"]);
  });

  it("keeps search and filters redaction-safe for non-admin users", () => {
    const visibleSources = filterVisibleSourceRecords(
      createPrototypeSourceRecords(),
      "project-manager",
    );

    expect(
      filterSourceLedgerResults(visibleSources, {
        ...defaultSourceLedgerFilters,
        query: "commercial",
      }),
    ).toEqual([]);

    const restrictedResults = filterSourceLedgerResults(visibleSources, {
      ...defaultSourceLedgerFilters,
      accessState: "restricted",
    });

    expect(restrictedResults).toEqual([
      expect.objectContaining({
        displayName: "Restricted source",
        displayOwner: "Restricted",
        matchRationale: "Matched access.",
      }),
    ]);
    expect(JSON.stringify(restrictedResults)).not.toContain(
      "Restricted commercial launch plan",
    );
    expect(JSON.stringify(restrictedResults)).not.toContain(
      "Commercial Strategy",
    );
  });

  it("summarizes active filters and next useful actions", () => {
    const filters: SourceLedgerFilters = {
      ...defaultSourceLedgerFilters,
      freshnessState: "stale",
      query: "status",
      sourceSystem: "smartsheet",
    };
    const visibleSources = filterVisibleSourceRecords(
      createPrototypeSourceRecords(),
      "admin",
    );
    const staleSource = visibleSources.find(
      (source) => source.freshnessState === "stale",
    )!;
    const failedSource = {
      ...staleSource,
      freshnessState: "stale" as const,
      ingestionStatus: "failed" as const,
    };

    expect(hasActiveSourceLedgerFilters(defaultSourceLedgerFilters)).toBe(false);
    expect(hasActiveSourceLedgerFilters(filters)).toBe(true);
    expect(getActiveSourceLedgerFilters(filters)).toEqual([
      { key: "query", label: "Search", value: "status" },
      { key: "sourceSystem", label: "Source system", value: "Smartsheet" },
      { key: "freshnessState", label: "Freshness", value: "Stale" },
    ]);
    expect(getSourceLedgerResultSummary(8, 1, true)).toBe(
      "1 of 8 source records match current filters.",
    );
    expect(getSourceLedgerNextAction(staleSource, true)).toBe(
      "Refresh this source or verify the latest source freshness.",
    );
    expect(getSourceLedgerNextAction(failedSource, true)).toBe(
      "Retry ingestion or check connector and source access.",
    );
  });
});
