import {
  runPrototypeLaunchArtifactIngestion,
  type LaunchArtifactIngestionResult,
  type NormalizedPlaybookStandardTask,
  type NormalizedPlaybookTemplateRecord,
} from "./launch-artifact-ingestion";
import {
  accessStateLabels,
  approvalStateLabels,
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
  freshnessStateLabels,
  ingestionStatusLabels,
  isRestrictedSource,
  sourceSystemLabels,
  sourceTypeLabels,
  type SourceAccessState,
  type SourceApprovalState,
  type SourceFreshnessState,
  type SourceIngestionStatus,
  type SourceLedgerRecord,
} from "./source-ledger";
import type { WorkspaceRole, WorkspaceSession } from "./workspace";

export type LaunchTaskStatus = "not_started" | "in_progress" | "blocked" | "complete";

export type LaunchPlanSetupInput = {
  launchId: string;
  launchName: string;
  launchTier: string;
  projectManager: string;
  selectedTemplateOptionId: string;
  targetKickoffDate: string;
};

export type LaunchPlanValidationError = {
  field: keyof LaunchPlanSetupInput | "source";
  message: string;
};

export type LaunchPlanSourceProvenance = {
  accessLabel: string;
  accessState: SourceAccessState;
  approvalLabel: string;
  approvalState: SourceApprovalState;
  freshnessLabel: string;
  freshnessState: SourceFreshnessState;
  ingestionLabel: string;
  ingestionStatus: SourceIngestionStatus;
  isRedacted: boolean;
  sourceId?: string;
  sourceName: string;
  sourceSystemLabel: string;
  sourceTypeLabel: string;
  sourceUrl?: string;
};

export type VisiblePlaybookTemplateOption = {
  isAvailable: boolean;
  optionId: string;
  sourceProvenance: LaunchPlanSourceProvenance;
  supportedLaunchTiers: string[];
  templateId?: string;
  templateName: string;
  unavailableReason?: string;
};

export type GeneratedLaunchTask = {
  criticalPath: boolean;
  dependencyTaskIds: string[];
  dueDateLogic?: string;
  handoffGate?: string;
  launchId: string;
  ownerRole: string;
  phase: string;
  sourceProvenance: LaunchPlanSourceProvenance;
  status: LaunchTaskStatus;
  taskId: string;
  taskName: string;
};

export type LaunchPlanGeneratedAuditEvent = {
  actorId: string;
  correlationId: string;
  eventId: string;
  eventType: "launch_plan.generated";
  launchId: string;
  metadata: {
    generatedTaskCount: number;
    launchId: string;
    playbookSourceId: string;
    selectedLaunchTier: string;
    templateId: string;
  };
  occurredAt: string;
  sourceSystem: "playbook";
};

export type LaunchPlanGenerationInput = {
  actorId: string;
  correlationId?: string;
  occurredAt?: string;
  playbookIngestionRunner?: PlaybookIngestionRunner;
  role?: WorkspaceRole;
  setup: LaunchPlanSetupInput;
  sources?: SourceLedgerRecord[];
};

export type LaunchPlanGenerationResult =
  | {
      auditEvent: LaunchPlanGeneratedAuditEvent;
      availableTemplates: VisiblePlaybookTemplateOption[];
      selectedTemplate: VisiblePlaybookTemplateOption;
      status: "generated";
      tasks: GeneratedLaunchTask[];
      validationErrors: [];
    }
  | {
      auditEvent?: undefined;
      availableTemplates: VisiblePlaybookTemplateOption[];
      selectedTemplate?: VisiblePlaybookTemplateOption;
      status: "invalid";
      tasks: [];
      validationErrors: LaunchPlanValidationError[];
    };

type TemplateOptionWithRecord = VisiblePlaybookTemplateOption & {
  source?: SourceLedgerRecord;
  template?: NormalizedPlaybookTemplateRecord;
  templateIdentityKey?: string;
};

type PlaybookIngestionRunner = (input: {
  source: SourceLedgerRecord;
}) => LaunchArtifactIngestionResult;

type GetVisiblePlaybookTemplateOptionsInput = {
  playbookIngestionRunner?: PlaybookIngestionRunner;
  role?: WorkspaceRole;
  sources?: SourceLedgerRecord[];
};

type PrototypeStarterDataInput = {
  role?: WorkspaceRole;
  session: WorkspaceSession;
  sources?: SourceLedgerRecord[];
};

const allowedSourceIngestionStates: SourceIngestionStatus[] = [
  "complete",
  "ready",
];

const defaultTargetKickoffDate = "2026-06-15";

export const launchTaskStatusLabels: Record<LaunchTaskStatus, string> = {
  blocked: "Blocked",
  complete: "Complete",
  in_progress: "In progress",
  not_started: "Not started",
};

export function createPrototypeLaunchPlanSources(): SourceLedgerRecord[] {
  return [
    ...createPrototypeSourceRecords(),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "draft",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: "playbook-cardiomax-tier-1-draft",
        owningTeam: "Launch Excellence",
        sourceName: "CARDIOMAX Tier 1 Draft Playbook",
        sourceSystem: "playbook",
        sourceType: "playbook",
        sourceUrl: "/sources#cardiomax-tier-1-draft-playbook",
      },
      {
        registeredAt: "2026-05-21T12:30:00.000Z",
        sourceId: "src-cardiomax-tier-1-draft-playbook",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "stale",
        ingestionStatus: "stale",
        objectId: "playbook-cardiomax-tier-3-stale",
        owningTeam: "Launch Excellence",
        sourceName: "CARDIOMAX Tier 3 Stale Playbook",
        sourceSystem: "playbook",
        sourceType: "playbook",
        sourceUrl: "/sources#cardiomax-tier-3-stale-playbook",
      },
      {
        registeredAt: "2026-05-21T12:32:00.000Z",
        sourceId: "src-cardiomax-tier-3-stale-playbook",
      },
    ),
    buildSourceRegistrationRecord(
      {
        accessState: "restricted",
        approvalState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
        objectId: "playbook-restricted-tier-4",
        owningTeam: "Commercial Strategy",
        sourceName: "Restricted Tier 4 Launch Playbook",
        sourceSystem: "playbook",
        sourceType: "playbook",
      },
      {
        registeredAt: "2026-05-21T12:34:00.000Z",
        sourceId: "src-restricted-tier-4-playbook",
      },
    ),
  ];
}

export function getVisiblePlaybookTemplateOptions({
  playbookIngestionRunner = runPrototypeLaunchArtifactIngestion,
  role = "project-manager",
  sources = createPrototypeLaunchPlanSources(),
}: GetVisiblePlaybookTemplateOptionsInput = {}): VisiblePlaybookTemplateOption[] {
  return getTemplateOptionsWithRecords({
    playbookIngestionRunner,
    role,
    sources,
  }).map(toVisibleTemplateOption);
}

export function getPrototypeLaunchPlanStarterData({
  role,
  session,
  sources,
}: PrototypeStarterDataInput) {
  const templateOptions = getVisiblePlaybookTemplateOptions({
    role: role ?? session.user.role,
    sources,
  });
  const firstAvailableTemplate = templateOptions.find(
    (option) => option.isAvailable,
  );
  const launchTierOptions = getLaunchTierOptions(templateOptions);

  return {
    defaultSetup: {
      launchId: session.launch.id,
      launchName: session.launch.name,
      launchTier:
        firstAvailableTemplate?.supportedLaunchTiers[0] ??
        launchTierOptions[0] ??
        "",
      projectManager: session.user.name,
      selectedTemplateOptionId: firstAvailableTemplate?.optionId ?? "",
      targetKickoffDate: defaultTargetKickoffDate,
    } satisfies LaunchPlanSetupInput,
    launchTierOptions,
    templateOptions,
  };
}

export function validateLaunchPlanSetup(
  setup: LaunchPlanSetupInput,
  availableTemplates: VisiblePlaybookTemplateOption[],
): {
  selectedTemplate?: VisiblePlaybookTemplateOption;
  validationErrors: LaunchPlanValidationError[];
} {
  const validationErrors: LaunchPlanValidationError[] = [];
  const normalizedSetup = normalizeLaunchPlanSetup(setup);

  if (!normalizedSetup.launchId) {
    validationErrors.push({
      field: "launchId",
      message: "Launch ID is required.",
    });
  }

  if (!normalizedSetup.launchName) {
    validationErrors.push({
      field: "launchName",
      message: "Launch name is required.",
    });
  }

  if (!normalizedSetup.launchTier) {
    validationErrors.push({
      field: "launchTier",
      message: "Launch tier is required.",
    });
  }

  if (!normalizedSetup.targetKickoffDate) {
    validationErrors.push({
      field: "targetKickoffDate",
      message: "Target kickoff date is required.",
    });
  } else if (!isValidDateOnly(normalizedSetup.targetKickoffDate)) {
    validationErrors.push({
      field: "targetKickoffDate",
      message: "Target kickoff date must use YYYY-MM-DD.",
    });
  }

  if (!normalizedSetup.projectManager) {
    validationErrors.push({
      field: "projectManager",
      message: "Project manager is required.",
    });
  }

  if (!normalizedSetup.selectedTemplateOptionId) {
    validationErrors.push({
      field: "selectedTemplateOptionId",
      message: "Approved Playbook template is required.",
    });
  }

  const selectedTemplate = availableTemplates.find(
    (option) => option.optionId === normalizedSetup.selectedTemplateOptionId,
  );

  if (normalizedSetup.selectedTemplateOptionId && !selectedTemplate) {
    validationErrors.push({
      field: "selectedTemplateOptionId",
      message: "Selected Playbook template was not found.",
    });
  } else if (selectedTemplate && !selectedTemplate.isAvailable) {
    validationErrors.push({
      field: "selectedTemplateOptionId",
      message:
        selectedTemplate.unavailableReason ??
        "Selected Playbook template is unavailable.",
    });
  }

  if (
    selectedTemplate?.isAvailable &&
    normalizedSetup.launchTier &&
    !selectedTemplate.supportedLaunchTiers.includes(normalizedSetup.launchTier)
  ) {
    validationErrors.push({
      field: "launchTier",
      message: `${normalizedSetup.launchTier} is not supported by the selected Playbook template.`,
    });
  }

  return {
    selectedTemplate,
    validationErrors,
  };
}

export function generateLaunchPlanFromPlaybook({
  actorId,
  correlationId,
  occurredAt,
  playbookIngestionRunner = runPrototypeLaunchArtifactIngestion,
  role = "project-manager",
  setup,
  sources = createPrototypeLaunchPlanSources(),
}: LaunchPlanGenerationInput): LaunchPlanGenerationResult {
  const normalizedSetup = normalizeLaunchPlanSetup(setup);
  const templateOptions = getTemplateOptionsWithRecords({
    playbookIngestionRunner,
    role,
    sources,
  });
  const visibleTemplates = templateOptions.map(toVisibleTemplateOption);
  const { selectedTemplate, validationErrors } = validateLaunchPlanSetup(
    normalizedSetup,
    visibleTemplates,
  );
  const selectedTemplateRecord = templateOptions.find(
    (option) => option.optionId === selectedTemplate?.optionId,
  );

  if (
    validationErrors.length > 0 ||
    !selectedTemplateRecord?.template ||
    !selectedTemplateRecord.source ||
    !selectedTemplateRecord.sourceProvenance.sourceId ||
    !selectedTemplateRecord.templateId
  ) {
    return {
      availableTemplates: visibleTemplates,
      selectedTemplate,
      status: "invalid",
      tasks: [],
      validationErrors:
        validationErrors.length > 0
          ? validationErrors
          : [
              {
                field: "source",
                message:
                  "Selected Playbook template does not contain normalized launch tasks.",
              },
            ],
    };
  }

  const templateTaskValidationErrors = getTemplateTaskValidationErrors(
    selectedTemplateRecord.template,
    normalizedSetup.launchId,
  );

  if (templateTaskValidationErrors.length > 0) {
    return {
      availableTemplates: visibleTemplates,
      selectedTemplate,
      status: "invalid",
      tasks: [],
      validationErrors: templateTaskValidationErrors,
    };
  }

  const tasks = buildGeneratedLaunchTasks({
    launchId: normalizedSetup.launchId,
    provenance: selectedTemplateRecord.sourceProvenance,
    template: selectedTemplateRecord.template,
  });
  const generatedAt = occurredAt ?? createTimestamp();
  const generationCorrelationId =
    correlationId ??
    createUniqueId(
      "corr",
      `launch-plan-${normalizedSetup.launchId}-${normalizedSetup.launchTier}`,
    );
  const auditEvent: LaunchPlanGeneratedAuditEvent = {
    actorId,
    correlationId: generationCorrelationId,
    eventId: createUniqueId(
      "evt",
      `${generationCorrelationId}-${normalizedSetup.launchId}-launch-plan-generated`,
    ),
    eventType: "launch_plan.generated",
    launchId: normalizedSetup.launchId,
    metadata: {
      generatedTaskCount: tasks.length,
      launchId: normalizedSetup.launchId,
      playbookSourceId: selectedTemplateRecord.sourceProvenance.sourceId,
      selectedLaunchTier: normalizedSetup.launchTier,
      templateId: selectedTemplateRecord.templateId,
    },
    occurredAt: generatedAt,
    sourceSystem: "playbook",
  };

  return {
    auditEvent,
    availableTemplates: visibleTemplates,
    selectedTemplate: selectedTemplateRecord,
    status: "generated",
    tasks,
    validationErrors: [],
  };
}

function getTemplateOptionsWithRecords({
  playbookIngestionRunner = runPrototypeLaunchArtifactIngestion,
  role = "project-manager",
  sources = createPrototypeLaunchPlanSources(),
}: GetVisiblePlaybookTemplateOptionsInput = {}): TemplateOptionWithRecord[] {
  const templateOptions = sources
    .filter((source) => source.sourceSystem === "playbook")
    .flatMap((source, index) =>
      buildTemplateOptionsForSource({
        index,
        playbookIngestionRunner,
        role,
        source,
      }),
    );

  return markDuplicateTemplateIdentitiesUnavailable(templateOptions);
}

function buildTemplateOptionsForSource({
  index,
  playbookIngestionRunner,
  role,
  source,
}: {
  index: number;
  playbookIngestionRunner: PlaybookIngestionRunner;
  role: WorkspaceRole;
  source: SourceLedgerRecord;
}): TemplateOptionWithRecord[] {
  const unavailableReason = getSourceUnavailableReason(source);

  if (unavailableReason) {
    return [
      {
        isAvailable: false,
        optionId: getUnavailableOptionId(source, role, index),
        source,
        sourceProvenance: buildSourceProvenance(source, role),
        supportedLaunchTiers: [],
        templateName: getVisibleTemplateName(source, role),
        unavailableReason,
      },
    ];
  }

  const ingestionResult = playbookIngestionRunner({ source });

  if (ingestionResult.playbookTemplates.length === 0) {
    return [
      {
        isAvailable: false,
        optionId: `${source.sourceId}:unavailable`,
        source,
        sourceProvenance: buildSourceProvenance(source, role),
        supportedLaunchTiers: [],
        templateName: getVisibleTemplateName(source, role),
        unavailableReason:
          ingestionResult.userSafeReason ??
          "No normalized Playbook template is available from this source.",
      },
    ];
  }

  if (ingestionResult.syncStatus !== "completed") {
    return ingestionResult.playbookTemplates.map((template) => ({
      isAvailable: false,
      optionId: createTemplateOptionId(source, template),
      source,
      sourceProvenance: buildSourceProvenance(
        ingestionResult.updatedSource,
        role,
      ),
      supportedLaunchTiers: template.supportedLaunchTiers,
      templateId: template.templateId,
      templateIdentityKey: createTemplateIdentityKey(source, template),
      templateName: template.templateName,
      unavailableReason:
        ingestionResult.userSafeReason ??
        `Template ingestion is ${ingestionStatusLabels[template.ingestionStatus]}.`,
    }));
  }

  return ingestionResult.playbookTemplates.map((template) => ({
    isAvailable: true,
    optionId: createTemplateOptionId(source, template),
    source,
    sourceProvenance: buildSourceProvenance(source, role),
    supportedLaunchTiers: template.supportedLaunchTiers,
    template,
    templateId: template.templateId,
    templateIdentityKey: createTemplateIdentityKey(source, template),
    templateName: template.templateName,
  }));
}

function getSourceUnavailableReason(source: SourceLedgerRecord) {
  if (isRestrictedSource(source)) {
    return "Template is restricted for this role.";
  }

  if (source.accessState !== "authorized") {
    return `Template access is ${accessStateLabels[source.accessState]}.`;
  }

  if (source.approvalState !== "approved") {
    return `Template approval is ${approvalStateLabels[source.approvalState]}.`;
  }

  if (
    source.freshnessState === "stale" ||
    source.freshnessState === "restricted"
  ) {
    return `Template freshness is ${freshnessStateLabels[source.freshnessState]}.`;
  }

  if (!allowedSourceIngestionStates.includes(source.ingestionStatus)) {
    return `Template ingestion is ${ingestionStatusLabels[source.ingestionStatus]}.`;
  }

  return undefined;
}

function buildSourceProvenance(
  source: SourceLedgerRecord,
  role: WorkspaceRole,
): LaunchPlanSourceProvenance {
  const shouldRedact = role !== "admin" && isRestrictedSource(source);

  if (shouldRedact) {
    return {
      accessLabel: accessStateLabels.restricted,
      accessState: "restricted",
      approvalLabel: approvalStateLabels.restricted,
      approvalState: "restricted",
      freshnessLabel: freshnessStateLabels.restricted,
      freshnessState: "restricted",
      ingestionLabel: ingestionStatusLabels.restricted,
      ingestionStatus: "restricted",
      isRedacted: true,
      sourceName: "Restricted source",
      sourceSystemLabel: "Restricted",
      sourceTypeLabel: "Restricted",
    };
  }

  return {
    accessLabel: accessStateLabels[source.accessState],
    accessState: source.accessState,
    approvalLabel: approvalStateLabels[source.approvalState],
    approvalState: source.approvalState,
    freshnessLabel: freshnessStateLabels[source.freshnessState],
    freshnessState: source.freshnessState,
    ingestionLabel: ingestionStatusLabels[source.ingestionStatus],
    ingestionStatus: source.ingestionStatus,
    isRedacted: false,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceSystemLabel: sourceSystemLabels[source.sourceSystem],
    sourceTypeLabel: sourceTypeLabels[source.sourceType],
    sourceUrl: source.sourceUrl,
  };
}

function toVisibleTemplateOption({
  isAvailable,
  optionId,
  sourceProvenance,
  supportedLaunchTiers,
  templateId,
  templateName,
  unavailableReason,
}: TemplateOptionWithRecord): VisiblePlaybookTemplateOption {
  return {
    isAvailable,
    optionId,
    sourceProvenance,
    supportedLaunchTiers,
    templateId,
    templateName,
    unavailableReason,
  };
}

function markDuplicateTemplateIdentitiesUnavailable(
  options: TemplateOptionWithRecord[],
): TemplateOptionWithRecord[] {
  const identityCounts = getValueCounts(
    options
      .map((option) => option.templateIdentityKey)
      .filter((key): key is string => Boolean(key)),
  );

  return options.map((option, index) => {
    if (
      !option.templateIdentityKey ||
      (identityCounts.get(option.templateIdentityKey) ?? 0) <= 1
    ) {
      return option;
    }

    return {
      ...option,
      isAvailable: false,
      optionId: `${option.optionId}:duplicate-${index}`,
      template: undefined,
      unavailableReason:
        "Duplicate Playbook template identifier must be resolved before generation.",
    };
  });
}

function createTemplateOptionId(
  source: SourceLedgerRecord,
  template: NormalizedPlaybookTemplateRecord,
) {
  return `${source.sourceId}:${template.templateId}:${template.playbookRecordId}`;
}

function createTemplateIdentityKey(
  source: SourceLedgerRecord,
  template: NormalizedPlaybookTemplateRecord,
) {
  return `${source.sourceId}:${template.templateId}`;
}

function getVisibleTemplateName(source: SourceLedgerRecord, role: WorkspaceRole) {
  return role !== "admin" && isRestrictedSource(source)
    ? "Restricted Playbook template"
    : source.sourceName;
}

function getUnavailableOptionId(
  source: SourceLedgerRecord,
  role: WorkspaceRole,
  index: number,
) {
  return role !== "admin" && isRestrictedSource(source)
    ? `restricted-playbook-template-${index}`
    : `${source.sourceId}:unavailable`;
}

function buildGeneratedLaunchTasks({
  launchId,
  provenance,
  template,
}: {
  launchId: string;
  provenance: LaunchPlanSourceProvenance;
  template: NormalizedPlaybookTemplateRecord;
}): GeneratedLaunchTask[] {
  const generatedIdByPlaybookTaskId = new Map(
    template.standardTasks.map((task) => [
      task.taskId,
      createGeneratedTaskId(launchId, task),
    ]),
  );

  return template.standardTasks.map((task, index) => ({
    criticalPath: index === 0 || Boolean(task.handoffGate),
    dependencyTaskIds: task.dependencyIds
      .map((dependencyId) => generatedIdByPlaybookTaskId.get(dependencyId))
      .filter((taskId): taskId is string => Boolean(taskId)),
    dueDateLogic: task.dueDateLogic,
    handoffGate: task.handoffGate,
    launchId,
    ownerRole: task.ownerRole ?? "Unassigned",
    phase: task.phase,
    sourceProvenance: provenance,
    status: "not_started",
    taskId: generatedIdByPlaybookTaskId.get(task.taskId)!,
    taskName: task.taskName,
  }));
}

function getTemplateTaskValidationErrors(
  template: NormalizedPlaybookTemplateRecord,
  launchId: string,
): LaunchPlanValidationError[] {
  const validationErrors: LaunchPlanValidationError[] = [];
  const playbookTaskIds = template.standardTasks.map((task) => task.taskId);
  const duplicatePlaybookTaskIds = getDuplicateValues(playbookTaskIds);
  const generatedTaskIds = template.standardTasks.map((task) =>
    createGeneratedTaskId(launchId, task),
  );
  const duplicateGeneratedTaskIds = getDuplicateValues(generatedTaskIds);
  const playbookTaskIdSet = new Set(playbookTaskIds);
  const missingDependencyIds = getUniqueValues(
    template.standardTasks.flatMap((task) =>
      task.dependencyIds.filter(
        (dependencyId) => !playbookTaskIdSet.has(dependencyId),
      ),
    ),
  );

  if (duplicatePlaybookTaskIds.length > 0) {
    validationErrors.push({
      field: "source",
      message: `Playbook task IDs must be unique before launch plan generation: ${duplicatePlaybookTaskIds.join(", ")}.`,
    });
  }

  if (duplicateGeneratedTaskIds.length > 0) {
    validationErrors.push({
      field: "source",
      message: `Generated launch task IDs must be unique before launch plan generation: ${duplicateGeneratedTaskIds.join(", ")}.`,
    });
  }

  if (missingDependencyIds.length > 0) {
    validationErrors.push({
      field: "source",
      message: `Playbook task dependencies reference missing task IDs: ${missingDependencyIds.join(", ")}.`,
    });
  }

  return validationErrors;
}

function createGeneratedTaskId(
  launchId: string,
  task: NormalizedPlaybookStandardTask,
) {
  return createSafeId("task", `${launchId}-${task.taskId}`);
}

function getLaunchTierOptions(
  templateOptions: VisiblePlaybookTemplateOption[],
) {
  return [
    ...new Set(
      templateOptions
        .filter((option) => option.isAvailable)
        .flatMap((option) => option.supportedLaunchTiers),
    ),
  ];
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function normalizeLaunchPlanSetup(
  setup: LaunchPlanSetupInput,
): LaunchPlanSetupInput {
  return {
    launchId: setup.launchId.trim(),
    launchName: setup.launchName.trim(),
    launchTier: setup.launchTier.trim(),
    projectManager: setup.projectManager.trim(),
    selectedTemplateOptionId: setup.selectedTemplateOptionId.trim(),
    targetKickoffDate: setup.targetKickoffDate.trim(),
  };
}

function getValueCounts(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function getDuplicateValues(values: string[]) {
  return [...getValueCounts(values).entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function getUniqueValues(values: string[]) {
  return [...new Set(values)];
}

function createTimestamp() {
  return new Date().toISOString();
}

function createSafeId(prefix: string, seed: string) {
  const normalized =
    seed
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "launch-plan";

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
