import { describe, expect, it } from "vitest";

import {
  buildLaunchArtifactIngestionResult,
  type LaunchArtifactAdapterRecord,
} from "./launch-artifact-ingestion";
import {
  buildSourceRegistrationRecord,
  type SourceLedgerRecord,
} from "./source-ledger";
import {
  createPrototypeLaunchPlanSources,
  generateLaunchPlanFromPlaybook,
  getVisiblePlaybookTemplateOptions,
  validateLaunchPlanSetup,
  type LaunchPlanSetupInput,
} from "./launch-plan";

function getValidSetup(): LaunchPlanSetupInput {
  return {
    launchId: "launch-cardiomax-2026",
    launchName: "CARDIOMAX Launch",
    launchTier: "Tier 2",
    projectManager: "CeCe Rivera",
    selectedTemplateOptionId: getApprovedTemplateOptionId(),
    targetKickoffDate: "2026-06-15",
  };
}

function getApprovedTemplateOptionId() {
  const approvedTemplate = getVisiblePlaybookTemplateOptions({
    sources: createPrototypeLaunchPlanSources(),
  }).find((option) => option.isAvailable);

  if (!approvedTemplate) {
    throw new Error("Expected approved Playbook template option");
  }

  return approvedTemplate.optionId;
}

function createPlaybookSource(sourceId = "src-review-playbook") {
  return buildSourceRegistrationRecord(
    {
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "watch",
      ingestionStatus: "ready",
      objectId: `${sourceId}-object`,
      owningTeam: "Launch Excellence",
      sourceName: "Review Launch Playbook",
      sourceSystem: "playbook",
      sourceType: "playbook",
      sourceUrl: `/sources#${sourceId}`,
    },
    {
      registeredAt: "2026-05-23T10:00:00.000Z",
      sourceId,
    },
  );
}

function createPlaybookRecord(
  source: SourceLedgerRecord,
  playbookTemplates: LaunchArtifactAdapterRecord["playbookTemplates"],
): LaunchArtifactAdapterRecord {
  return {
    accessState: "authorized",
    artifactKind: "playbook_template",
    lastModifiedAt: "2026-05-23T10:05:00.000Z",
    launchId: "launch-cardiomax-2026",
    objectId: source.objectId,
    owningTeam: source.owningTeam,
    playbookTemplates,
    sourceUrl: source.sourceUrl,
  };
}

function createTemplate(overrides: Record<string, unknown> = {}) {
  return {
    handoffGates: ["Sales to Deployment readiness"],
    phases: ["Mobilize", "Launch"],
    standardTasks: [
      {
        dependencyIds: [],
        dueDateLogic: "Kickoff date minus 30 days",
        handoffGate: "Sales to Deployment readiness",
        ownerRole: "Launch PM",
        phase: "Mobilize",
        taskId: "pb-task-1",
        taskName: "Confirm launch tier and scope",
      },
      {
        dependencyIds: ["pb-task-1"],
        dueDateLogic: "Kickoff date minus 14 days",
        ownerRole: "Deployment Lead",
        phase: "Launch",
        taskId: "pb-task-2",
        taskName: "Complete deployment handoff review",
      },
    ],
    supportedLaunchTiers: ["Tier 2"],
    templateId: "tier-2-playbook",
    templateName: "Tier 2 Launch Playbook",
    ...overrides,
  };
}

describe("launch plan domain", () => {
  it("surfaces available and unavailable Playbook templates with source states", () => {
    const options = getVisiblePlaybookTemplateOptions({
      role: "project-manager",
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isAvailable: true,
          optionId: expect.stringContaining(
            "src-cardiomax-tier-2-playbook:tier-2-playbook",
          ),
          supportedLaunchTiers: ["Tier 2", "Tier 3"],
          templateName: "Tier 2 Launch Playbook",
          sourceProvenance: expect.objectContaining({
            approvalLabel: "Approved",
            freshnessLabel: "Watch",
            ingestionLabel: "Ready",
            sourceId: "src-cardiomax-tier-2-playbook",
            sourceName: "CARDIOMAX Tier 2 Launch Playbook",
          }),
        }),
        expect.objectContaining({
          isAvailable: false,
          templateName: "CARDIOMAX Tier 1 Draft Playbook",
          unavailableReason: "Template approval is Draft.",
        }),
        expect.objectContaining({
          isAvailable: false,
          templateName: "CARDIOMAX Tier 3 Stale Playbook",
          unavailableReason: "Template freshness is Stale.",
        }),
        expect.objectContaining({
          isAvailable: false,
          templateName: "Restricted Playbook template",
          unavailableReason: "Template is restricted for this role.",
        }),
      ]),
    );
  });

  it("redacts restricted Playbook details for non-admin roles", () => {
    const options = getVisiblePlaybookTemplateOptions({
      role: "project-manager",
      sources: createPrototypeLaunchPlanSources(),
    });
    const restrictedOption = options.find((option) =>
      option.optionId.startsWith("restricted-playbook-template"),
    );

    expect(restrictedOption).toMatchObject({
      sourceProvenance: {
        accessLabel: "Restricted",
        accessState: "restricted",
        approvalLabel: "Restricted",
        approvalState: "restricted",
        freshnessLabel: "Restricted",
        freshnessState: "restricted",
        ingestionLabel: "Restricted",
        ingestionStatus: "restricted",
        isRedacted: true,
        sourceName: "Restricted source",
        sourceSystemLabel: "Restricted",
        sourceTypeLabel: "Restricted",
      },
      templateName: "Restricted Playbook template",
    });
    expect(JSON.stringify(restrictedOption)).not.toContain(
      "Restricted Tier 4 Launch Playbook",
    );
    expect(JSON.stringify(restrictedOption)).not.toContain(
      "src-restricted-tier-4-playbook",
    );
    expect(JSON.stringify(restrictedOption)).not.toContain(
      "Commercial Strategy",
    );
  });

  it("returns validation errors without creating tasks when setup is missing", () => {
    const options = getVisiblePlaybookTemplateOptions({
      sources: createPrototypeLaunchPlanSources(),
    });
    const validation = validateLaunchPlanSetup(
      {
        ...getValidSetup(),
        launchId: "",
        projectManager: "",
        targetKickoffDate: "June 15",
      },
      options,
    );
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      setup: {
        ...getValidSetup(),
        launchId: "",
        projectManager: "",
        targetKickoffDate: "June 15",
      },
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(validation.validationErrors.map((error) => error.message)).toEqual([
      "Launch ID is required.",
      "Target kickoff date must use YYYY-MM-DD.",
      "Project manager is required.",
    ]);
    expect(result.auditEvent).toBeUndefined();
    expect(result).toMatchObject({
      status: "invalid",
      tasks: [],
    });
  });

  it("fails closed when the selected tier is unsupported", () => {
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      setup: {
        ...getValidSetup(),
        launchTier: "Tier 1",
      },
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(result.auditEvent).toBeUndefined();
    expect(result).toMatchObject({
      status: "invalid",
      tasks: [],
      validationErrors: [
        {
          field: "launchTier",
          message:
            "Tier 1 is not supported by the selected Playbook template.",
        },
      ],
    });
  });

  it("generates deterministic launch tasks with Playbook provenance and audit metadata", () => {
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      correlationId: "corr-launch-plan-1",
      occurredAt: "2026-05-23T10:00:00.000Z",
      setup: getValidSetup(),
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(result.status).toBe("generated");

    if (result.status !== "generated") {
      throw new Error("Expected launch plan generation to succeed");
    }

    expect(result.tasks).toEqual([
      expect.objectContaining({
        criticalPath: true,
        dependencyTaskIds: [],
        handoffGate: "Sales to Deployment readiness",
        launchId: "launch-cardiomax-2026",
        ownerRole: "Launch PM",
        phase: "Mobilize",
        dueDateLogic: "Kickoff date minus 30 days",
        sourceProvenance: expect.objectContaining({
          approvalLabel: "Approved",
          freshnessLabel: "Watch",
          ingestionLabel: "Ready",
          sourceId: "src-cardiomax-tier-2-playbook",
        }),
        status: "not_started",
        taskId: "task-launch-cardiomax-2026-pb-task-1",
        taskName: "Confirm launch tier and scope",
      }),
      expect.objectContaining({
        dependencyTaskIds: ["task-launch-cardiomax-2026-pb-task-1"],
        dueDateLogic: "Kickoff date minus 14 days",
        ownerRole: "Deployment Lead",
        phase: "Launch",
        taskId: "task-launch-cardiomax-2026-pb-task-2",
        taskName: "Complete deployment handoff review",
      }),
    ]);
    expect(result.auditEvent).toMatchObject({
      actorId: "CeCe Rivera",
      correlationId: "corr-launch-plan-1",
      eventType: "launch_plan.generated",
      launchId: "launch-cardiomax-2026",
      metadata: {
        generatedTaskCount: 2,
        launchId: "launch-cardiomax-2026",
        playbookSourceId: "src-cardiomax-tier-2-playbook",
        selectedLaunchTier: "Tier 2",
        templateId: "tier-2-playbook",
      },
      occurredAt: "2026-05-23T10:00:00.000Z",
      sourceSystem: "playbook",
    });
    expect(JSON.stringify(result.auditEvent)).not.toContain(
      "credentialToken",
    );
    expect(JSON.stringify(result.auditEvent)).not.toContain(
      "rawConnectorPayload",
    );
  });

  it("trims setup values before validating selected template and launch tier", () => {
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      setup: {
        ...getValidSetup(),
        launchTier: " Tier 2 ",
        selectedTemplateOptionId: ` ${getApprovedTemplateOptionId()} `,
      },
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(result.status).toBe("generated");
  });

  it("does not make incomplete Playbook ingestion results selectable", () => {
    const source = createPlaybookSource("src-incomplete-playbook");
    const playbookIngestionRunner = () =>
      buildLaunchArtifactIngestionResult({
        record: createPlaybookRecord(source, [createTemplate(), null]),
        source,
      });
    const options = getVisiblePlaybookTemplateOptions({
      playbookIngestionRunner,
      sources: [source],
    });
    const incompleteOption = options[0];

    expect(incompleteOption).toMatchObject({
      isAvailable: false,
      templateName: "Tier 2 Launch Playbook",
      unavailableReason:
        "Structured launch artifact ingestion partially completed. Some artifact information is missing.",
    });

    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      playbookIngestionRunner,
      setup: {
        ...getValidSetup(),
        selectedTemplateOptionId: incompleteOption.optionId,
      },
      sources: [source],
    });

    expect(result.auditEvent).toBeUndefined();
    expect(result).toMatchObject({
      status: "invalid",
      tasks: [],
      validationErrors: [
        {
          field: "selectedTemplateOptionId",
          message:
            "Structured launch artifact ingestion partially completed. Some artifact information is missing.",
        },
      ],
    });
  });

  it("fails closed when Playbook task dependencies reference missing tasks", () => {
    const source = createPlaybookSource("src-missing-dependency-playbook");
    const playbookIngestionRunner = () =>
      buildLaunchArtifactIngestionResult({
        record: createPlaybookRecord(source, [
          createTemplate({
            standardTasks: [
              {
                dependencyIds: ["pb-task-missing"],
                ownerRole: "Launch PM",
                phase: "Mobilize",
                taskId: "pb-task-1",
                taskName: "Confirm launch tier and scope",
              },
            ],
          }),
        ]),
        source,
      });
    const [option] = getVisiblePlaybookTemplateOptions({
      playbookIngestionRunner,
      sources: [source],
    });
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      playbookIngestionRunner,
      setup: {
        ...getValidSetup(),
        selectedTemplateOptionId: option.optionId,
      },
      sources: [source],
    });

    expect(result.auditEvent).toBeUndefined();
    expect(result).toMatchObject({
      status: "invalid",
      tasks: [],
      validationErrors: [
        {
          field: "source",
          message:
            "Playbook task dependencies reference missing task IDs: pb-task-missing.",
        },
      ],
    });
  });

  it("fails closed when generated task IDs would collide", () => {
    const source = createPlaybookSource("src-colliding-task-playbook");
    const playbookIngestionRunner = () =>
      buildLaunchArtifactIngestionResult({
        record: createPlaybookRecord(source, [
          createTemplate({
            standardTasks: [
              {
                dependencyIds: [],
                ownerRole: "Launch PM",
                phase: "Mobilize",
                taskId: "pb/task",
                taskName: "Confirm slash task",
              },
              {
                dependencyIds: [],
                ownerRole: "Deployment Lead",
                phase: "Launch",
                taskId: "pb task",
                taskName: "Confirm space task",
              },
            ],
          }),
        ]),
        source,
      });
    const [option] = getVisiblePlaybookTemplateOptions({
      playbookIngestionRunner,
      sources: [source],
    });
    const result = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      playbookIngestionRunner,
      setup: {
        ...getValidSetup(),
        selectedTemplateOptionId: option.optionId,
      },
      sources: [source],
    });

    expect(result.auditEvent).toBeUndefined();
    expect(result).toMatchObject({
      status: "invalid",
      tasks: [],
      validationErrors: [
        {
          field: "source",
          message:
            "Generated launch task IDs must be unique before launch plan generation: task-launch-cardiomax-2026-pb-task.",
        },
      ],
    });
  });

  it("marks duplicate Playbook template identifiers unavailable with unique option IDs", () => {
    const source = createPlaybookSource("src-duplicate-template-playbook");
    const playbookIngestionRunner = () =>
      buildLaunchArtifactIngestionResult({
        record: createPlaybookRecord(source, [
          createTemplate(),
          createTemplate({
            templateName: "Tier 2 Launch Playbook Variant",
          }),
        ]),
        source,
      });
    const options = getVisiblePlaybookTemplateOptions({
      playbookIngestionRunner,
      sources: [source],
    });

    expect(options).toHaveLength(2);
    expect(options.every((option) => !option.isAvailable)).toBe(true);
    expect(new Set(options.map((option) => option.optionId)).size).toBe(2);
    expect(options.map((option) => option.unavailableReason)).toEqual([
      "Duplicate Playbook template identifier must be resolved before generation.",
      "Duplicate Playbook template identifier must be resolved before generation.",
    ]);
  });

  it("keeps launch plan audit event IDs unique when correlation IDs are reused", () => {
    const firstResult = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      correlationId: "corr-reused-launch-plan",
      setup: getValidSetup(),
      sources: createPrototypeLaunchPlanSources(),
    });
    const secondResult = generateLaunchPlanFromPlaybook({
      actorId: "CeCe Rivera",
      correlationId: "corr-reused-launch-plan",
      setup: getValidSetup(),
      sources: createPrototypeLaunchPlanSources(),
    });

    expect(firstResult.status).toBe("generated");
    expect(secondResult.status).toBe("generated");

    if (firstResult.status !== "generated" || secondResult.status !== "generated") {
      throw new Error("Expected launch plan generation to succeed");
    }

    expect(firstResult.auditEvent.eventId).not.toBe(
      secondResult.auditEvent.eventId,
    );
  });
});
