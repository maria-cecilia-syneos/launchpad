import { describe, expect, it } from "vitest";

import {
  buildGovernedCollaborationIngestionResult,
  canIngestGovernedCollaborationSource,
  getCollaborationIngestionResultMessage,
  runPrototypeCollaborationIngestion,
  type CollaborationAdapterRecord,
} from "./collaboration-ingestion";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
} from "./source-ledger";

const teamsSource = buildSourceRegistrationRecord(
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
    registeredAt: "2026-05-21T13:20:00.000Z",
    sourceId: "src-cardiomax-teams-decisions",
  },
);

const emailSource = buildSourceRegistrationRecord(
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    ingestionStatus: "ready",
    objectId: "email-cardiomax-launch-thread",
    owningTeam: "Launch Operations",
    sourceName: "CARDIOMAX launch readiness thread",
    sourceSystem: "email",
    sourceType: "email_mailbox",
  },
  {
    registeredAt: "2026-05-21T13:30:00.000Z",
    sourceId: "src-cardiomax-email-readiness",
  },
);

const teamsAdapterRecord: CollaborationAdapterRecord = {
  accessState: "authorized",
  contextKind: "teams_thread",
  governanceState: "allowed",
  lastActivityAt: "2026-05-21T13:45:00.000Z",
  objectId: "graph-teams-cardiomax-decisions",
  ownerOrSender: "Launch Operations",
  retentionState: "retained",
  sourceUrl: "https://teams.microsoft.com/l/channel/cardiomax-decisions",
  summaries: [
    {
      category: "decision",
      isLaunchRelevant: true,
      summary:
        "Launch readiness checkpoint moved to Friday after medical review confirmed label timing.",
    },
    {
      category: "commitment",
      isLaunchRelevant: true,
      summary:
        "Deployment Solutions committed to confirm field enablement owners before the kickoff review.",
    },
    {
      category: "noise",
      isLaunchRelevant: false,
      summary: "Lunch preference thread should not be retrievable.",
    },
  ],
  threadLabel: "CARDIOMAX Teams Decisions",
};

describe("collaboration ingestion domain helpers", () => {
  it("allows only approved, authorized Teams and email sources", () => {
    const prototypeSources = createPrototypeSourceRecords();
    const sharePointSource = prototypeSources.find(
      (source) => source.sourceSystem === "sharepoint",
    );
    const restrictedSource = prototypeSources.find(
      (source) => source.accessState === "restricted",
    );

    expect(canIngestGovernedCollaborationSource(teamsSource)).toBe(true);
    expect(canIngestGovernedCollaborationSource(emailSource)).toBe(true);
    expect(canIngestGovernedCollaborationSource(sharePointSource!)).toBe(false);
    expect(canIngestGovernedCollaborationSource(restrictedSource!)).toBe(false);
  });

  it("normalizes governed Teams context without raw Graph payloads or tokens", () => {
    const result = buildGovernedCollaborationIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-collab-sync-1",
      record: {
        ...teamsAdapterRecord,
        credentialToken: "never-render",
        rawGraphPayload: {
          bodyPreview: "raw message body",
          conversationId: "raw-conversation",
        },
      } as CollaborationAdapterRecord,
      occurredAt: "2026-05-21T13:50:00.000Z",
      source: teamsSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "fresh",
      ingestionStatus: "complete",
      lastRefreshedAt: "2026-05-21T13:45:00.000Z",
      objectId: "graph-teams-cardiomax-decisions",
      owningTeam: "Launch Operations",
      sourceId: "src-cardiomax-teams-decisions",
      sourceName: "CARDIOMAX Teams Decisions",
      sourceSystem: "teams",
    });
    expect(result.contextRecords).toHaveLength(2);
    expect(result.contextRecords[0]).toMatchObject({
      category: "decision",
      sourceId: "src-cardiomax-teams-decisions",
      sourceLocationKey: "teams-cardiomax-decisions",
      sourceSystem: "teams",
      summary:
        "Launch readiness checkpoint moved to Friday after medical review confirmed label timing.",
      threadLabel: "CARDIOMAX Teams Decisions",
    });
    expect(result.auditEvent).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-collab-sync-1",
      eventType: "source.sync_completed",
      metadata: {
        contextRecordCount: 2,
        freshnessState: "fresh",
        ingestionStatus: "complete",
        sourceId: "src-cardiomax-teams-decisions",
        sourceSystem: "teams",
        syncStatus: "completed",
      },
      occurredAt: "2026-05-21T13:50:00.000Z",
      sourceSystem: "teams",
    });
    expect(JSON.stringify(result)).not.toContain("credentialToken");
    expect(JSON.stringify(result)).not.toContain("rawGraphPayload");
    expect(JSON.stringify(result)).not.toContain("raw message body");
    expect(JSON.stringify(result)).not.toContain("Lunch preference");
  });

  it("returns access_restricted without confirming restricted details", () => {
    const result = buildGovernedCollaborationIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...teamsAdapterRecord,
        accessState: "restricted",
        threadLabel: "Restricted legal escalation thread",
      },
      source: teamsSource,
    });

    expect(result).toMatchObject({
      contextRecords: [],
      reasonState: "access_restricted",
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
      userSafeReason:
        "Access restricted. Collaboration details are not available for this user or role.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_skipped",
      metadata: {
        reasonState: "access_restricted",
        syncStatus: "skipped",
      },
    });
    expect(JSON.stringify(result)).not.toContain("legal escalation");
  });

  it("skips sync when retention or governance policy blocks retrieval", () => {
    const result = buildGovernedCollaborationIngestionResult({
      record: {
        ...teamsAdapterRecord,
        governanceState: "blocked",
        retentionState: "expired",
      },
      source: teamsSource,
      systemActor: "source-sync-service",
    });

    expect(result).toMatchObject({
      contextRecords: [],
      reasonState: "governance_skipped",
      syncStatus: "skipped",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
      userSafeReason:
        "Collaboration sync was skipped by governance or retention policy.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_skipped",
      metadata: {
        reasonState: "governance_skipped",
        sourceSystem: "teams",
        syncStatus: "skipped",
      },
      systemActor: "source-sync-service",
    });
  });

  it("maps connector failures to a user-safe failed state", () => {
    const result = runPrototypeCollaborationIngestion({
      actorId: "Admin Reviewer",
      source: {
        ...emailSource,
        objectId: "connector-failure-email-launch-thread",
      },
    });

    expect(result).toMatchObject({
      contextRecords: [],
      reasonState: "connector_unavailable",
      syncStatus: "failed",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "failed",
      },
      userSafeReason:
        "Collaboration content could not be retrieved. Check connector availability and source access.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: {
        reasonState: "connector_unavailable",
        syncStatus: "failed",
      },
    });
  });

  it("formats user-safe collaboration sync summaries", () => {
    const result = buildGovernedCollaborationIngestionResult({
      actorId: "Admin Reviewer",
      record: teamsAdapterRecord,
      source: teamsSource,
    });

    expect(getCollaborationIngestionResultMessage(result)).toBe(
      "2 governed collaboration summaries prepared for retrieval.",
    );
  });
});
