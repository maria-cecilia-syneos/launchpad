import { describe, expect, it } from "vitest";

import {
  buildLaunchArtifactIngestionResult,
  canIngestLaunchArtifactSource,
  getLaunchArtifactIngestionResultMessage,
  runPrototypeLaunchArtifactIngestion,
  type LaunchArtifactAdapterRecord,
  type PlaybookTemplateAdapterRecord,
} from "./launch-artifact-ingestion";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
} from "./source-ledger";

const playbookSource = buildSourceRegistrationRecord(
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
    registeredAt: "2026-05-21T15:00:00.000Z",
    sourceId: "src-cardiomax-tier-2-playbook",
  },
);

const assetSource = buildSourceRegistrationRecord(
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
    registeredAt: "2026-05-21T15:10:00.000Z",
    sourceId: "src-cardiomax-approved-assets",
  },
);

const handoffSource = buildSourceRegistrationRecord(
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
    registeredAt: "2026-05-21T15:20:00.000Z",
    sourceId: "src-cardiomax-deployment-handoff",
  },
);

const taskSource = buildSourceRegistrationRecord(
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    ingestionStatus: "ready",
    objectId: "tasks-cardiomax-launch",
    owningTeam: "Project Management",
    sourceName: "CARDIOMAX Launch Task List",
    sourceSystem: "task",
    sourceType: "launch_task",
    sourceUrl: "/sources#cardiomax-launch-tasks",
  },
  {
    registeredAt: "2026-05-21T15:30:00.000Z",
    sourceId: "src-cardiomax-launch-tasks",
  },
);

const playbookRecord: LaunchArtifactAdapterRecord = {
  accessState: "authorized",
  artifactKind: "playbook_template",
  lastModifiedAt: "2026-05-21T15:35:00.000Z",
  launchId: "launch-cardiomax-2026",
  objectId: "playbook-cardiomax-tier-2",
  owningTeam: "Launch Excellence",
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
  sourceUrl: "/sources#cardiomax-tier-2-playbook",
};
const [basePlaybookTemplate] =
  playbookRecord.playbookTemplates as PlaybookTemplateAdapterRecord[];

describe("launch artifact ingestion domain helpers", () => {
  it("allows only approved, authorized structured launch artifact sources", () => {
    const prototypeSources = createPrototypeSourceRecords();
    const sharePointSource = prototypeSources.find(
      (source) => source.sourceSystem === "sharepoint",
    );
    const restrictedSource = prototypeSources.find(
      (source) => source.accessState === "restricted",
    );

    expect(canIngestLaunchArtifactSource(playbookSource)).toBe(true);
    expect(canIngestLaunchArtifactSource(assetSource)).toBe(true);
    expect(canIngestLaunchArtifactSource(taskSource)).toBe(true);
    expect(canIngestLaunchArtifactSource(handoffSource)).toBe(true);
    expect(canIngestLaunchArtifactSource(sharePointSource!)).toBe(false);
    expect(canIngestLaunchArtifactSource(restrictedSource!)).toBe(false);
    expect(
      canIngestLaunchArtifactSource({
        ...playbookSource,
        objectId: undefined,
        sourceUrl: undefined,
      }),
    ).toBe(false);
  });

  it("normalizes Playbook templates for later task generation with source provenance", () => {
    const result = buildLaunchArtifactIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-playbook-sync-1",
      occurredAt: "2026-05-21T15:40:00.000Z",
      record: {
        ...playbookRecord,
        credentialToken: "never-render",
        rawConnectorPayload: {
          hidden: "raw playbook payload",
        },
      } as LaunchArtifactAdapterRecord,
      source: playbookSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      freshnessState: "fresh",
      ingestionStatus: "complete",
      lastRefreshedAt: "2026-05-21T15:35:00.000Z",
      objectId: "playbook-cardiomax-tier-2",
      sourceId: "src-cardiomax-tier-2-playbook",
      sourceLinkHealth: "healthy",
      sourceSystem: "playbook",
    });
    expect(result.playbookTemplates).toHaveLength(1);
    expect(result.playbookTemplates[0]).toMatchObject({
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "fresh",
      handoffGates: ["Sales to Deployment readiness"],
      ingestionStatus: "complete",
      launchId: "launch-cardiomax-2026",
      owningTeam: "Launch Excellence",
      sourceId: "src-cardiomax-tier-2-playbook",
      sourceLocationKey: "playbook-cardiomax-tier-2",
      sourceObjectId: "playbook-cardiomax-tier-2",
      sourceSystem: "playbook",
      supportedLaunchTiers: ["Tier 2", "Tier 3"],
      templateName: "Tier 2 Launch Playbook",
    });
    expect(result.playbookTemplates[0].standardTasks).toEqual([
      expect.objectContaining({
        dependencyIds: [],
        ownerRole: "Launch PM",
        phase: "Mobilize",
        taskName: "Confirm launch tier and scope",
      }),
      expect.objectContaining({
        dependencyIds: ["pb-task-1"],
        ownerRole: "Deployment Lead",
        phase: "Launch",
        taskName: "Complete deployment handoff review",
      }),
    ]);
    expect(result.auditEvent).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-playbook-sync-1",
      eventType: "source.sync_completed",
      metadata: {
        launchId: "launch-cardiomax-2026",
        recordCounts: {
          approvedAssets: 0,
          assets: 0,
          handoffArtifacts: 0,
          launchTasks: 0,
          playbookTemplates: 1,
        },
        sourceId: "src-cardiomax-tier-2-playbook",
        sourceSystem: "playbook",
        syncStatus: "completed",
      },
      occurredAt: "2026-05-21T15:40:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("credentialToken");
    expect(JSON.stringify(result)).not.toContain("rawConnectorPayload");
    expect(JSON.stringify(result)).not.toContain("raw playbook payload");
  });

  it("normalizes launch task lists with dependency, handoff, and critical-path context", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        accessState: "authorized",
        artifactKind: "launch_task_list",
        lastModifiedAt: "2026-05-21T15:45:00.000Z",
        launchId: "launch-cardiomax-2026",
        launchTasks: [
          {
            blockerState: "none",
            criticalPath: true,
            dependencyIds: ["task-kickoff"],
            dueDateLabel: "T-30",
            handoffRelevance: "deployment",
            ownerRole: "Project Manager",
            phase: "Launch",
            taskId: "task-readiness-review",
            taskName: "Run readiness review",
          },
        ],
        objectId: "tasks-cardiomax-launch",
        owningTeam: "Project Management",
        sourceUrl: "/sources#cardiomax-launch-tasks",
      },
      source: taskSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.launchTasks).toEqual([
      expect.objectContaining({
        blockerState: "none",
        criticalPath: true,
        dependencyIds: ["task-kickoff"],
        dueDateLabel: "T-30",
        handoffRelevance: "deployment",
        ownerRole: "Project Manager",
        phase: "Launch",
        taskName: "Run readiness review",
      }),
    ]);
  });

  it("distinguishes approved, draft, and unapproved assets", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        accessState: "authorized",
        artifactKind: "approved_asset_collection",
        assets: [
          {
            approvalState: "approved",
            assetId: "asset-approved-messaging",
            assetTitle: "Approved messaging guide",
            assetType: "Messaging guide",
            owner: "Learning Solutions",
            sourceUrl: "/sources#approved-messaging-guide",
          },
          {
            approvalState: "draft",
            assetId: "asset-draft-training",
            assetTitle: "Draft training aid",
            assetType: "Training aid",
          },
          {
            approvalState: "unapproved",
            assetId: "asset-unapproved-claim",
            assetTitle: "Unapproved claim sheet",
            assetType: "Claim sheet",
          },
        ],
        lastModifiedAt: "2026-05-21T15:50:00.000Z",
        launchId: "launch-cardiomax-2026",
        objectId: "assets-cardiomax-approved",
        owningTeam: "Learning Solutions",
      },
      source: assetSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.assets).toHaveLength(3);
    expect(result.assets.map((asset) => asset.assetApprovalState)).toEqual([
      "approved",
      "draft",
      "unapproved",
    ]);
    expect(result.auditEvent.metadata.recordCounts.approvedAssets).toBe(1);
    expect(getLaunchArtifactIngestionResultMessage(result)).toBe(
      "1 approved asset prepared for retrieval. 2 non-approved asset records retained as governed metadata.",
    );
  });

  it("surfaces incomplete handoff artifacts as missing information", () => {
    const result = buildLaunchArtifactIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        accessState: "authorized",
        artifactKind: "handoff_artifact",
        handoffArtifact: {
          assumptions: ["Deployment staffing is confirmed."],
          commitments: ["Sales will confirm client access window."],
          handoffId: "handoff-cardiomax-deployment",
          openQuestions: ["Who owns the readiness deck?"],
          owners: ["Deployment Lead"],
          risks: ["Client kickoff date may move."],
          scope: "",
        },
        lastModifiedAt: "2026-05-21T15:55:00.000Z",
        launchId: "launch-cardiomax-2026",
        objectId: "handoff-cardiomax-deployment",
      },
      source: handoffSource,
    });

    expect(result).toMatchObject({
      reasonState: "missing_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
      userSafeReason:
        "Structured launch artifact ingestion is incomplete. Required artifact information is missing.",
    });
    expect(result.handoffArtifacts[0]).toMatchObject({
      missingRequiredFields: ["scope"],
      openQuestions: ["Who owns the readiness deck?"],
      scope: "",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: expect.objectContaining({
        reasonState: "missing_information",
        syncStatus: "incomplete",
      }),
    });
  });

  it("returns access_restricted without confirming restricted artifact details", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        accessState: "restricted",
        playbookTemplates: [
          {
            ...basePlaybookTemplate,
            templateName: "Restricted oncology launch playbook",
          },
        ],
      },
      source: playbookSource,
    });

    expect(result).toMatchObject({
      assets: [],
      handoffArtifacts: [],
      launchTasks: [],
      playbookTemplates: [],
      reasonState: "access_restricted",
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
        sourceLinkHealth: "restricted",
      },
      userSafeReason:
        "Access restricted. Structured launch artifact details are not available for this user or role.",
    });
    expect(JSON.stringify(result)).not.toContain("oncology");
  });

  it("maps restricted registered sources to access_restricted before reading adapter details", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        playbookTemplates: [
          {
            ...basePlaybookTemplate,
            templateName: "Restricted oncology launch playbook",
          },
        ],
      },
      source: {
        ...playbookSource,
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
    });

    expect(result).toMatchObject({
      reasonState: "access_restricted",
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
    });
    expect(JSON.stringify(result)).not.toContain("oncology");
  });

  it("maps connector failures to a user-safe failed state", () => {
    const result = runPrototypeLaunchArtifactIngestion({
      actorId: "Admin Reviewer",
      source: {
        ...playbookSource,
        objectId: "connector-failure-playbook",
      },
    });

    expect(result).toMatchObject({
      reasonState: "connector_unavailable",
      syncStatus: "failed",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "failed",
      },
      userSafeReason:
        "Structured launch artifacts could not be retrieved. Check connector availability and source access.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: expect.objectContaining({
        reasonState: "connector_unavailable",
        syncStatus: "failed",
      }),
    });
  });

  it("marks partial structured data incomplete instead of silently dropping malformed records", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        accessState: "authorized",
        artifactKind: "approved_asset_collection",
        assets: [
          {
            approvalState: "approved",
            assetId: "asset-approved-messaging",
            assetTitle: "Approved messaging guide",
            assetType: "Messaging guide",
          },
          {
            approvalState: "approved",
            assetId: "asset-missing-type",
            assetTitle: "Asset missing type",
          },
        ],
        lastModifiedAt: "2026-05-21T16:20:00.000Z",
        launchId: "launch-cardiomax-2026",
        objectId: "assets-cardiomax-approved",
        owningTeam: "Learning Solutions",
      },
      source: assetSource,
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
    });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      assetTitle: "Approved messaging guide",
      freshnessState: "watch",
      ingestionStatus: "incomplete",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: expect.objectContaining({
        reasonState: "partial_information",
        recordCounts: expect.objectContaining({
          approvedAssets: 1,
          assets: 1,
        }),
      }),
    });
  });

  it("requires Playbook tiers, owner roles, and handoff gates before completing sync", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        playbookTemplates: [
          basePlaybookTemplate,
          {
            ...basePlaybookTemplate,
            handoffGates: [],
            standardTasks: [
              {
                phase: "Mobilize",
                taskId: "pb-task-missing-owner",
                taskName: "Confirm incomplete launch task",
              },
            ],
            supportedLaunchTiers: [],
            templateId: "incomplete-playbook",
            templateName: "Incomplete Playbook",
          },
        ],
      },
      source: playbookSource,
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
    });
    expect(result.playbookTemplates).toHaveLength(1);
    expect(result.playbookTemplates[0]).toMatchObject({
      freshnessState: "watch",
      ingestionStatus: "incomplete",
      templateName: "Tier 2 Launch Playbook",
    });
  });

  it("keeps duplicate Playbook template IDs from producing duplicate normalized IDs", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        playbookTemplates: [
          basePlaybookTemplate,
          {
            ...basePlaybookTemplate,
            templateName: "Tier 2 Launch Playbook Variant",
          },
        ],
      },
      source: playbookSource,
    });
    const recordIds = result.playbookTemplates.map(
      (template) => template.playbookRecordId,
    );

    expect(result.syncStatus).toBe("completed");
    expect(recordIds).toHaveLength(2);
    expect(new Set(recordIds).size).toBe(2);
  });

  it("rejects adapter records that lack matching source identity", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        objectId: undefined,
        sourceUrl: undefined,
      },
      source: playbookSource,
    });

    expect(result).toMatchObject({
      playbookTemplates: [],
      reasonState: "missing_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
    });
  });

  it("rejects invalid freshness timestamps before successful normalization", () => {
    const result = buildLaunchArtifactIngestionResult({
      occurredAt: "2026-05-21T16:30:00.000Z",
      record: {
        ...playbookRecord,
        lastModifiedAt: "not-a-date",
      },
      source: playbookSource,
    });

    expect(result).toMatchObject({
      playbookTemplates: [],
      reasonState: "missing_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
        lastRefreshedAt: "2026-05-21T16:30:00.000Z",
      },
    });
  });

  it("does not persist unsafe source URLs or malformed artifact arrays", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: {
        ...playbookRecord,
        playbookTemplates: [
          {
            ...basePlaybookTemplate,
            sourceUrl: "https://token@example.com/playbook?access_token=secret",
          },
          null,
        ],
        sourceUrl: "https://token@example.com/source?access_token=secret",
      } as unknown as LaunchArtifactAdapterRecord,
      source: {
        ...playbookSource,
        sourceUrl: "https://token@example.com/source?access_token=secret",
      },
    });

    expect(result).toMatchObject({
      reasonState: "partial_information",
      syncStatus: "incomplete",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
    });
    expect(result.playbookTemplates).toHaveLength(1);
    expect(result.playbookTemplates[0].sourceUrl).toBeUndefined();
    expect(result.updatedSource.sourceUrl).toBeUndefined();
    expect(result.updatedSource.sourceLinkHealth).toBe("missing");
    expect(JSON.stringify(result)).not.toContain("access_token");
    expect(JSON.stringify(result)).not.toContain("token@example.com");
  });

  it("formats user-safe structured artifact sync summaries", () => {
    const result = buildLaunchArtifactIngestionResult({
      record: playbookRecord,
      source: playbookSource,
    });

    expect(getLaunchArtifactIngestionResultMessage(result)).toBe(
      "1 Playbook template prepared for retrieval.",
    );
  });
});
