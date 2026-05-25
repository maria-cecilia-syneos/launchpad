import { describe, expect, it } from "vitest";

import {
  buildSmartsheetStatusAnswer,
  buildSmartsheetStatusIngestionResult,
  canIngestSmartsheetStatusSource,
  createPrototypeSmartsheetStatusTasks,
  defaultSmartsheetStatusFieldMapping,
  getSmartsheetStatusIngestionResultMessage,
  runPrototypeSmartsheetStatusIngestion,
  type SmartsheetStatusFieldMapping,
} from "./smartsheet-status";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
} from "./source-ledger";

const smartsheetSource = buildSourceRegistrationRecord(
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
);

describe("Smartsheet status ingestion domain helpers", () => {
  it("allows only approved, authorized Smartsheet sheet sources", () => {
    const staleSmartsheetSource = createPrototypeSourceRecords().find(
      (source) => source.sourceId === "src-cardiomax-smartsheet-status",
    );
    const sharePointSource = createPrototypeSourceRecords().find(
      (source) => source.sourceSystem === "sharepoint",
    );

    expect(canIngestSmartsheetStatusSource(smartsheetSource)).toBe(true);
    expect(canIngestSmartsheetStatusSource(staleSmartsheetSource!)).toBe(false);
    expect(canIngestSmartsheetStatusSource(sharePointSource!)).toBe(false);
    expect(
      canIngestSmartsheetStatusSource({
        ...smartsheetSource,
        accessState: "restricted",
      }),
    ).toBe(false);
  });

  it("normalizes configured Smartsheet rows into launch tasks and audit-safe status records", () => {
    const fieldMapping: SmartsheetStatusFieldMapping = {
      ...defaultSmartsheetStatusFieldMapping,
      blocker: "Risk",
      dependencyIds: "Predecessors",
      dueDate: "Target",
      owner: "DRI",
      status: "State",
      taskName: "Workstream",
    };
    const result = buildSmartsheetStatusIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-smartsheet-sync-1",
      fieldMapping,
      occurredAt: "2026-05-22T16:00:00.000Z",
      record: {
        accessState: "authorized",
        lastModifiedAt: "2026-05-22T15:45:00.000Z",
        objectId: "smartsheet-cardiomax-approved-status",
        owningTeam: "Project Management",
        rows: [
          {
            DRI: "Deployment Lead",
            Freshness: "Fresh",
            "Launch ID": "cardiomax",
            Milestone: "Deployment readiness",
            Phase: "Launch",
            Predecessors: ["smartsheet-task-scope"],
            "Row ID": "row-2001",
            Risk: "Client kickoff window not confirmed",
            "Source Link": "/sources#cardiomax-approved-smartsheet-status",
            State: "Blocked",
            "Task ID": "smartsheet-task-readiness-review",
            Target: "2026-06-08",
            Workstream: "Resolve deployment readiness blockers",
            credentialToken: "never-render",
            rawSmartsheetPayload: { hidden: "raw sheet payload" },
          },
        ],
        sheetName: "CARDIOMAX deployment status",
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      source: smartsheetSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      freshnessState: "fresh",
      ingestionStatus: "complete",
      lastRefreshedAt: "2026-05-22T15:45:00.000Z",
      sourceId: "src-cardiomax-smartsheet-approved-status",
      sourceSystem: "smartsheet",
    });
    expect(result.statusRecords).toEqual([
      expect.objectContaining({
        blockerState: "Client kickoff window not confirmed",
        dependencyIds: ["smartsheet-task-scope"],
        dueDateLabel: "2026-06-08",
        launchId: "cardiomax",
        ownerName: "Deployment Lead",
        phase: "Launch",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
        statusLabel: "Blocked",
        taskStatus: "blocked",
      }),
    ]);
    expect(result.launchTasks).toEqual([
      expect.objectContaining({
        blockerState: "Client kickoff window not confirmed",
        dueDateLabel: "2026-06-08",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
        taskStatus: "blocked",
      }),
    ]);
    expect(result.auditEvent).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-smartsheet-sync-1",
      eventType: "source.sync_completed",
      metadata: {
        freshnessState: "fresh",
        ingestionStatus: "complete",
        launchId: "cardiomax",
        recordCounts: {
          incompleteRows: 0,
          launchTasks: 1,
          rows: 1,
          staleRows: 0,
        },
        sourceId: "src-cardiomax-smartsheet-approved-status",
        sourceSystem: "smartsheet",
        syncStatus: "completed",
      },
      occurredAt: "2026-05-22T16:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("credentialToken");
    expect(JSON.stringify(result)).not.toContain("rawSmartsheetPayload");
    expect(JSON.stringify(result)).not.toContain("raw sheet payload");
  });

  it("keeps incomplete rows visible with missing-information status", () => {
    const result = buildSmartsheetStatusIngestionResult({
      record: {
        accessState: "authorized",
        lastModifiedAt: "2026-05-22T15:45:00.000Z",
        objectId: "smartsheet-cardiomax-approved-status",
        rows: [
          {
            Freshness: "Fresh",
            "Launch ID": "cardiomax",
            "Row ID": "row-3001",
            "Task ID": "smartsheet-task-missing-owner",
            Task: "Confirm regional deployment owner",
          },
        ],
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      source: smartsheetSource,
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
      userSafeReason:
        "Smartsheet project status ingestion partially completed. Some status fields are missing or unmapped.",
    });
    expect(result.statusRecords[0]).toMatchObject({
      freshnessState: "watch",
      ingestionStatus: "incomplete",
      missingRequiredFields: ["owner", "dueDate", "status"],
      taskName: "Confirm regional deployment owner",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: expect.objectContaining({
        reasonState: "partial_information",
        recordCounts: expect.objectContaining({
          incompleteRows: 1,
          rows: 1,
        }),
      }),
    });
  });

  it("preserves rows with missing task identity as incomplete records", () => {
    const result = buildSmartsheetStatusIngestionResult({
      record: {
        accessState: "authorized",
        lastModifiedAt: "2026-05-22T15:45:00.000Z",
        objectId: "smartsheet-cardiomax-approved-status",
        rows: [
          {
            Freshness: "Fresh",
            Owner: "Deployment Lead",
            "Due Date": "2026-06-06",
            "Row ID": "row-4001",
            Status: "Watch",
          },
        ],
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      source: smartsheetSource,
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
    });
    expect(result.statusRecords).toEqual([
      expect.objectContaining({
        missingRequiredFields: ["taskId", "taskName"],
        taskId: "smartsheet-row-row-4001",
        taskName: "Missing task name",
      }),
    ]);
    expect(result.launchTasks).toEqual([
      expect.objectContaining({
        taskId: "smartsheet-row-row-4001",
        taskName: "Missing task name",
      }),
    ]);
  });

  it("preserves stale source freshness when row freshness is missing or partial", () => {
    const result = buildSmartsheetStatusIngestionResult({
      record: {
        accessState: "authorized",
        lastModifiedAt: "2026-05-22T15:45:00.000Z",
        objectId: "smartsheet-cardiomax-approved-status",
        rows: [
          {
            Owner: "Deployment Lead",
            "Due Date": "2026-06-06",
            "Row ID": "row-4002",
            Status: "Watch",
            "Task ID": "smartsheet-task-stale-fallback",
            Task: "Confirm stale fallback",
          },
          {
            Freshness: "Stale",
            "Row ID": "row-4003",
            Status: "Watch",
            "Task ID": "smartsheet-task-stale-partial",
            Task: "Confirm stale partial",
          },
        ],
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      source: {
        ...smartsheetSource,
        freshnessState: "stale",
      },
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "incomplete",
      },
    });
    expect(result.statusRecords.map((record) => record.freshnessState)).toEqual([
      "stale",
      "stale",
    ]);
  });

  it("surfaces stale Smartsheet rows without treating the connector as failed", () => {
    const result = runPrototypeSmartsheetStatusIngestion({
      source: smartsheetSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      freshnessState: "stale",
      ingestionStatus: "complete",
    });
    expect(result.statusRecords.map((record) => record.freshnessState)).toEqual([
      "fresh",
      "watch",
      "stale",
    ]);
    expect(getSmartsheetStatusIngestionResultMessage(result)).toBe(
      "3 Smartsheet project status records prepared for retrieval. 1 record marked source-stale.",
    );
  });

  it("returns user-safe restricted and connector failure outcomes", () => {
    const restrictedResult = buildSmartsheetStatusIngestionResult({
      record: {
        accessState: "restricted",
        lastModifiedAt: "2026-05-22T15:45:00.000Z",
        objectId: "smartsheet-cardiomax-approved-status",
        rows: [
          {
            "Task ID": "restricted-task",
            Task: "Restricted oncology deployment task",
          },
        ],
      },
      source: smartsheetSource,
    });
    const connectorFailureResult = runPrototypeSmartsheetStatusIngestion({
      source: {
        ...smartsheetSource,
        objectId: "connector-failure-smartsheet-status",
      },
    });

    expect(restrictedResult).toMatchObject({
      reasonState: "access_restricted",
      statusRecords: [],
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
    });
    expect(JSON.stringify(restrictedResult)).not.toContain("oncology");
    expect(connectorFailureResult).toMatchObject({
      reasonState: "connector_unavailable",
      syncStatus: "failed",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "failed",
      },
    });
  });

  it("keeps prototype row source links aligned to the selected source", () => {
    const result = runPrototypeSmartsheetStatusIngestion({
      source: {
        ...smartsheetSource,
        objectId: "smartsheet-regional-approved-status",
        sourceId: "src-regional-smartsheet-status",
        sourceName: "Regional Approved Smartsheet Status",
        sourceUrl: "/sources#regional-smartsheet-status",
      },
    });

    expect(result.statusRecords.map((record) => record.sourceUrl)).toEqual([
      "/sources#regional-smartsheet-status",
      "/sources#regional-smartsheet-status",
      "/sources#regional-smartsheet-status",
    ]);
  });

  it("builds source-backed status answers from authorized normalized rows", () => {
    const result = runPrototypeSmartsheetStatusIngestion({
      source: smartsheetSource,
    });
    const answer = buildSmartsheetStatusAnswer({
      launchId: "cardiomax",
      records: result.statusRecords,
      role: "project-manager",
    });

    expect(answer).toMatchObject({
      freshnessLabel: "Stale",
      sourceBacked: true,
      status: "answered",
    });
    expect(answer.answerText).toContain("1 blocked task");
    expect(answer.answerText).toContain(
      "Highest-priority blocker: Resolve deployment readiness blockers.",
    );
    expect(answer.answerText).toContain("Freshness: Stale.");
    expect(answer.citations).toHaveLength(3);
    expect(createPrototypeSmartsheetStatusTasks()).toHaveLength(3);
  });

  it("scopes answer access checks to the requested launch", () => {
    const result = runPrototypeSmartsheetStatusIngestion({
      source: smartsheetSource,
    });
    const [baseRecord] = result.statusRecords;
    const restrictedLaunchRecord = {
      ...baseRecord,
      accessState: "restricted" as const,
      freshnessState: "restricted" as const,
      ingestionStatus: "restricted" as const,
      launchId: "restricted-launch",
      sourceId: "src-restricted-smartsheet-status",
    };
    const authorizedLaunchRecord = {
      ...baseRecord,
      launchId: "authorized-launch",
      sourceId: "src-authorized-smartsheet-status",
    };

    expect(
      buildSmartsheetStatusAnswer({
        launchId: "restricted-launch",
        records: [restrictedLaunchRecord, authorizedLaunchRecord],
        role: "project-manager",
      }),
    ).toMatchObject({
      sourceBacked: false,
      status: "access_restricted",
    });
    expect(
      buildSmartsheetStatusAnswer({
        launchId: "authorized-launch",
        records: [restrictedLaunchRecord, authorizedLaunchRecord],
        role: "project-manager",
      }),
    ).toMatchObject({
      sourceBacked: true,
      status: "answered",
    });
  });
});
