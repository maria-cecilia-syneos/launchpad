import type {
  SourceAccessState,
  SourceApprovalState,
  SourceFreshnessState,
} from "./source-ledger";

export type HandoffStatus = "requested" | "draft" | "ready_for_review";

export type HandoffHistoryState =
  | "current"
  | "stale"
  | "missing"
  | "superseded"
  | "conflicting";

export type HandoffAction =
  | "appended"
  | "created"
  | "ready_for_review"
  | "updated";

export type HandoffAuditEventType =
  | "handoff.ready_for_review"
  | "handoff.requested"
  | "handoff.updated";

export type HandoffSupportingSource = {
  accessState?: SourceAccessState;
  approvalState?: SourceApprovalState;
  freshnessState?: SourceFreshnessState;
  provenanceLabel: string;
  sourceId: string;
  title: string;
};

export type HandoffSectionKey =
  | "assumptions"
  | "commitments"
  | "openQuestions"
  | "owners"
  | "risks"
  | "scope";

export type HandoffSectionState = HandoffHistoryState;

export type HandoffContentSection = {
  state: HandoffSectionState;
  supportingSources: HandoffSupportingSource[];
  text: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type HandoffStructuredContent = Record<
  HandoffSectionKey,
  HandoffContentSection
>;

export type HandoffContentInput = Record<
  HandoffSectionKey,
  Pick<HandoffContentSection, "state" | "supportingSources" | "text">
>;

export type HandoffReadinessValidationError = {
  field: HandoffSectionKey;
  message: string;
};

export type HandoffRequestInput = {
  launchId: string;
  workstreamId: string;
  sendingTeam: string;
  receivingTeam: string;
  purpose: string;
  requestedTiming: string;
  supportingSources: HandoffSupportingSource[];
};

export type HandoffHistoryEntry = {
  actorId: string;
  historyId: string;
  occurredAt: string;
  provenanceLabel: string;
  purpose: string;
  receivingTeam: string;
  requestedTiming: string;
  sendingTeam: string;
  state: HandoffHistoryState;
  structuredContent?: HandoffStructuredContent;
  supportingSources: HandoffSupportingSource[];
};

export type HandoffArtifact = {
  createdAt: string;
  handoffId: string;
  history: HandoffHistoryEntry[];
  launchId: string;
  purpose: string;
  receivingTeam: string;
  requestedTiming: string;
  responsibleOwner: string;
  sendingTeam: string;
  status: HandoffStatus;
  structuredContent: HandoffStructuredContent;
  supportingSources: HandoffSupportingSource[];
  updatedAt: string;
  workstreamId: string;
};

export type HandoffValidationError = {
  field: keyof Pick<
    HandoffRequestInput,
    | "launchId"
    | "workstreamId"
    | "sendingTeam"
    | "receivingTeam"
    | "purpose"
    | "requestedTiming"
  >;
  message: string;
};

export type HandoffAuditEvent = {
  actorId: string;
  correlationId: string;
  eventId: string;
  eventType: HandoffAuditEventType;
  handoffId: string;
  launchId: string;
  metadata: {
    action: HandoffAction;
    receivingTeam: string;
    sendingTeam: string;
    workstreamId: string;
  };
  occurredAt: string;
};

export type HandoffRequestResult = {
  action: HandoffAction;
  artifact: HandoffArtifact;
  artifacts: HandoffArtifact[];
  auditEvent: HandoffAuditEvent;
};

export type HandoffContentResult = HandoffRequestResult;

type RequestReusableHandoffOptions = {
  actorId: string;
  correlationId?: string;
  occurredAt?: string;
};

export const handoffHistoryStateLabels: Record<HandoffHistoryState, string> = {
  conflicting: "Conflicting",
  current: "Current",
  missing: "Missing",
  stale: "Stale",
  superseded: "Superseded",
};

export const handoffStatusLabels: Record<HandoffStatus, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  requested: "Requested",
};

export const handoffSectionLabels: Record<HandoffSectionKey, string> = {
  assumptions: "Assumptions",
  commitments: "Commitments",
  openQuestions: "Open questions",
  owners: "Owners",
  risks: "Risks",
  scope: "Scope",
};

export const handoffSectionOrder: HandoffSectionKey[] = [
  "scope",
  "assumptions",
  "commitments",
  "risks",
  "owners",
  "openQuestions",
];

export const prototypeHandoffSupportingSources: HandoffSupportingSource[] = [
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "fresh",
    provenanceLabel: "Source Ledger",
    sourceId: "src-cardiomax-launch-plan",
    title: "CARDIOMAX Launch Plan",
  },
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    provenanceLabel: "Source Ledger",
    sourceId: "src-cardiomax-approved-assets",
    title: "CARDIOMAX Approved Asset Library",
  },
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    provenanceLabel: "Source Ledger",
    sourceId: "src-cardiomax-deployment-handoff",
    title: "CARDIOMAX Deployment Handoff",
  },
  {
    accessState: "authorized",
    approvalState: "stale",
    freshnessState: "stale",
    provenanceLabel: "Source Ledger",
    sourceId: "src-cardiomax-smartsheet-status",
    title: "CARDIOMAX Smartsheet Status",
  },
];

export function validateHandoffRequest(
  input: HandoffRequestInput,
): HandoffValidationError[] {
  const errors: HandoffValidationError[] = [];

  if (!normalizeValue(input.workstreamId)) {
    errors.push({
      field: "workstreamId",
      message: "Launch or workstream is required.",
    });
  }

  if (!normalizeValue(input.sendingTeam)) {
    errors.push({
      field: "sendingTeam",
      message: "Sending team is required.",
    });
  }

  if (!normalizeValue(input.receivingTeam)) {
    errors.push({
      field: "receivingTeam",
      message: "Receiving team is required.",
    });
  }

  if (!normalizeValue(input.purpose)) {
    errors.push({
      field: "purpose",
      message: "Handoff purpose is required.",
    });
  }

  if (!normalizeValue(input.requestedTiming)) {
    errors.push({
      field: "requestedTiming",
      message: "Requested timing is required.",
    });
  }

  return errors;
}

export function requestReusableHandoff(
  existingArtifacts: HandoffArtifact[],
  input: HandoffRequestInput,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffRequestResult {
  const errors = validateHandoffRequest(input);

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join(" "));
  }

  const matchIndex = existingArtifacts.findIndex((artifact) =>
    isReusableHandoffMatch(artifact, input),
  );

  if (matchIndex >= 0) {
    const existingArtifact = existingArtifacts[matchIndex];
    const entry = buildHistoryEntry(input, {
      actorId,
      handoffId: existingArtifact.handoffId,
      occurredAt,
      sequence: existingArtifact.history.length + 1,
    });
    const artifact: HandoffArtifact = {
      ...existingArtifact,
      history: [...existingArtifact.history, entry],
      purpose: input.purpose.trim(),
      receivingTeam: input.receivingTeam.trim(),
      requestedTiming: input.requestedTiming.trim(),
      responsibleOwner: input.receivingTeam.trim(),
      sendingTeam: input.sendingTeam.trim(),
      status: "requested",
      supportingSources: input.supportingSources,
      updatedAt: occurredAt,
    };
    const artifacts = existingArtifacts.map((candidate, index) =>
      index === matchIndex ? artifact : candidate,
    );

    return {
      action: "appended",
      artifact,
      artifacts,
      auditEvent: buildHandoffAuditEvent(artifact, {
        action: "appended",
        actorId,
        correlationId,
        occurredAt,
      }),
    };
  }

  const handoffId = createHandoffId(input);
  const entry = buildHistoryEntry(input, {
    actorId,
    handoffId,
    occurredAt,
    sequence: 1,
  });
  const artifact: HandoffArtifact = {
    createdAt: occurredAt,
    handoffId,
    history: [entry],
    launchId: input.launchId.trim(),
    purpose: input.purpose.trim(),
    receivingTeam: input.receivingTeam.trim(),
    requestedTiming: input.requestedTiming.trim(),
    responsibleOwner: input.receivingTeam.trim(),
    sendingTeam: input.sendingTeam.trim(),
    status: "requested",
    structuredContent: createEmptyStructuredContent(),
    supportingSources: input.supportingSources,
    updatedAt: occurredAt,
    workstreamId: input.workstreamId.trim(),
  };

  return {
    action: "created",
    artifact,
    artifacts: [...existingArtifacts, artifact],
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "created",
      actorId,
      correlationId,
      occurredAt,
    }),
  };
}

export function createPrototypeHandoffArtifacts(): HandoffArtifact[] {
  const handoffId = "handoff-cardiomax-deployment-readiness-deployment-solutions";

  return [
    {
      createdAt: "2026-05-20T15:00:00.000Z",
      handoffId,
      history: [
        buildPrototypeHistoryEntry(handoffId, 1, {
          occurredAt: "2026-05-20T15:00:00.000Z",
          purpose: "Initial deployment scope and client commitment context.",
          state: "stale",
          supportingSources: [prototypeHandoffSupportingSources[0]],
        }),
        buildPrototypeHistoryEntry(handoffId, 2, {
          occurredAt: "2026-05-20T16:00:00.000Z",
          purpose: "Open deployment owner confirmation is still missing.",
          state: "missing",
          supportingSources: [],
        }),
        buildPrototypeHistoryEntry(handoffId, 3, {
          occurredAt: "2026-05-21T09:00:00.000Z",
          purpose: "Earlier asset package was superseded by approved assets.",
          state: "superseded",
          supportingSources: [prototypeHandoffSupportingSources[1]],
        }),
        buildPrototypeHistoryEntry(handoffId, 4, {
          occurredAt: "2026-05-21T10:30:00.000Z",
          purpose: "Timeline assumption conflicts with latest Smartsheet status.",
          state: "conflicting",
          supportingSources: [prototypeHandoffSupportingSources[3]],
        }),
      ],
      launchId: "cardiomax",
      purpose: "Initial deployment scope and client commitment context.",
      receivingTeam: "Deployment Solutions",
      requestedTiming: "Before deployment kickoff",
      responsibleOwner: "Deployment Solutions",
      sendingTeam: "Launch Operations",
      status: "requested",
      structuredContent: createPrototypeStructuredContent(),
      supportingSources: [
        prototypeHandoffSupportingSources[0],
        prototypeHandoffSupportingSources[2],
      ],
      updatedAt: "2026-05-21T10:30:00.000Z",
      workstreamId: "deployment-readiness",
    },
  ];
}

export function getHandoffResponsibleOwner(artifact: HandoffArtifact) {
  return artifact.responsibleOwner || artifact.receivingTeam;
}

export function saveHandoffStructuredContent(
  existingArtifacts: HandoffArtifact[],
  handoffId: string,
  input: HandoffContentInput,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffContentResult {
  const matchIndex = existingArtifacts.findIndex(
    (artifact) => artifact.handoffId === handoffId,
  );

  if (matchIndex === -1) {
    throw new Error("Handoff artifact was not found.");
  }

  const existingArtifact = existingArtifacts[matchIndex];
  const structuredContent = buildStructuredContent(input, {
    actorId,
    occurredAt,
  });
  const priorContentEntry = hasStructuredContent(existingArtifact)
    ? [
        buildStructuredContentHistoryEntry(existingArtifact, input, {
          actorId,
          occurredAt,
        }),
      ]
    : [];
  const artifact: HandoffArtifact = {
    ...existingArtifact,
    history: [...existingArtifact.history, ...priorContentEntry],
    status: "draft",
    structuredContent,
    supportingSources: collectUniqueSources([
      ...existingArtifact.supportingSources,
      ...collectStructuredContentSources(structuredContent),
    ]),
    updatedAt: occurredAt,
  };
  const artifacts = existingArtifacts.map((candidate, index) =>
    index === matchIndex ? artifact : candidate,
  );

  return {
    action: "updated",
    artifact,
    artifacts,
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "updated",
      actorId,
      correlationId,
      occurredAt,
    }),
  };
}

export function validateHandoffReadiness(
  artifact: HandoffArtifact,
): HandoffReadinessValidationError[] {
  const content = artifact.structuredContent;
  const errors: HandoffReadinessValidationError[] = [];
  const requiredSections: Array<{
    field: HandoffSectionKey;
    message: string;
  }> = [
    {
      field: "scope",
      message: "Scope is required before receiving-team readiness review.",
    },
    {
      field: "commitments",
      message:
        "Commitments are required before receiving-team readiness review.",
    },
    {
      field: "owners",
      message: "Owners are required before receiving-team readiness review.",
    },
    {
      field: "risks",
      message: "Risks are required before receiving-team readiness review.",
    },
  ];

  for (const section of requiredSections) {
    if (!normalizeValue(content[section.field].text)) {
      errors.push(section);
    }
  }

  if (!areOpenQuestionsResolved(content.openQuestions)) {
    errors.push({
      field: "openQuestions",
      message:
        "Open questions remain a readiness risk and must be resolved or explicitly marked as none.",
    });
  }

  return errors;
}

export function markHandoffReadyForReview(
  existingArtifacts: HandoffArtifact[],
  handoffId: string,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffContentResult {
  const matchIndex = existingArtifacts.findIndex(
    (artifact) => artifact.handoffId === handoffId,
  );

  if (matchIndex === -1) {
    throw new Error("Handoff artifact was not found.");
  }

  const existingArtifact = existingArtifacts[matchIndex];
  const readinessErrors = validateHandoffReadiness(existingArtifact);

  if (readinessErrors.length > 0) {
    throw new Error(readinessErrors.map((error) => error.message).join(" "));
  }

  const artifact: HandoffArtifact = {
    ...existingArtifact,
    status: "ready_for_review",
    updatedAt: occurredAt,
  };
  const artifacts = existingArtifacts.map((candidate, index) =>
    index === matchIndex ? artifact : candidate,
  );

  return {
    action: "ready_for_review",
    artifact,
    artifacts,
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "ready_for_review",
      actorId,
      correlationId,
      occurredAt,
    }),
  };
}

function buildHandoffAuditEvent(
  artifact: HandoffArtifact,
  {
    action,
    actorId,
    correlationId = createId(
      "corr",
      `${artifact.handoffId}-${action}-${artifact.updatedAt}`,
    ),
    occurredAt,
  }: {
    action: HandoffAction;
    actorId: string;
    correlationId?: string;
    occurredAt: string;
  },
): HandoffAuditEvent {
  const eventTypeByAction: Record<HandoffAction, HandoffAuditEventType> = {
    appended: "handoff.requested",
    created: "handoff.requested",
    ready_for_review: "handoff.ready_for_review",
    updated: "handoff.updated",
  };

  return {
    actorId,
    correlationId,
    eventId: createId("evt", `${correlationId}-handoff-requested`),
    eventType: eventTypeByAction[action],
    handoffId: artifact.handoffId,
    launchId: artifact.launchId,
    metadata: {
      action,
      receivingTeam: artifact.receivingTeam,
      sendingTeam: artifact.sendingTeam,
      workstreamId: artifact.workstreamId,
    },
    occurredAt,
  };
}

function createEmptyStructuredContent(): HandoffStructuredContent {
  return handoffSectionOrder.reduce((content, section) => {
    content[section] = {
      state: "missing",
      supportingSources: [],
      text: "",
    };

    return content;
  }, {} as HandoffStructuredContent);
}

function createPrototypeStructuredContent(): HandoffStructuredContent {
  return buildStructuredContent(
    {
      assumptions: {
        state: "stale",
        supportingSources: [prototypeHandoffSupportingSources[3]],
        text: "Deployment timing assumptions need review against the latest Smartsheet status.",
      },
      commitments: {
        state: "current",
        supportingSources: [prototypeHandoffSupportingSources[0]],
        text: "Launch Operations will provide deployment scope and approved launch context.",
      },
      openQuestions: {
        state: "missing",
        supportingSources: [],
        text: "Deployment owner confirmation remains open.",
      },
      owners: {
        state: "current",
        supportingSources: [],
        text: "Deployment Solutions owns receiving-team readiness.",
      },
      risks: {
        state: "conflicting",
        supportingSources: [prototypeHandoffSupportingSources[3]],
        text: "Latest project status may conflict with the kickoff timing assumption.",
      },
      scope: {
        state: "current",
        supportingSources: [prototypeHandoffSupportingSources[2]],
        text: "Prepare Deployment Solutions for kickoff readiness using existing launch context.",
      },
    },
    {
      actorId: "Launch Operations",
      occurredAt: "2026-05-21T10:30:00.000Z",
    },
  );
}

function buildStructuredContent(
  input: HandoffContentInput,
  {
    actorId,
    occurredAt,
  }: {
    actorId: string;
    occurredAt: string;
  },
): HandoffStructuredContent {
  return handoffSectionOrder.reduce((content, section) => {
    content[section] = {
      state: input[section].state,
      supportingSources: input[section].supportingSources,
      text: input[section].text.trim(),
      updatedAt: occurredAt,
      updatedBy: actorId,
    };

    return content;
  }, {} as HandoffStructuredContent);
}

function hasStructuredContent(artifact: HandoffArtifact) {
  return handoffSectionOrder.some((section) =>
    normalizeValue(artifact.structuredContent[section].text),
  );
}

function buildStructuredContentHistoryEntry(
  artifact: HandoffArtifact,
  input: HandoffContentInput,
  {
    actorId,
    occurredAt,
  }: {
    actorId: string;
    occurredAt: string;
  },
): HandoffHistoryEntry {
  return {
    actorId,
    historyId: createId(
      "hist",
      `${artifact.handoffId}-structured-${artifact.history.length + 1}-${occurredAt}`,
    ),
    occurredAt,
    provenanceLabel: "Structured content update",
    purpose: summarizeStructuredContent(artifact.structuredContent),
    receivingTeam: artifact.receivingTeam,
    requestedTiming: artifact.requestedTiming,
    sendingTeam: artifact.sendingTeam,
    state: getDominantSectionState(input),
    structuredContent: cloneStructuredContent(artifact.structuredContent),
    supportingSources: collectStructuredContentSources(artifact.structuredContent),
  };
}

function summarizeStructuredContent(content: HandoffStructuredContent) {
  const populatedSections = handoffSectionOrder
    .filter((section) => normalizeValue(content[section].text))
    .map((section) => handoffSectionLabels[section]);

  if (populatedSections.length === 0) {
    return "Prior structured handoff content was empty.";
  }

  return `Prior structured handoff content preserved for ${populatedSections.join(
    ", ",
  )}.`;
}

function getDominantSectionState(input: HandoffContentInput) {
  const states = handoffSectionOrder.map((section) => input[section].state);
  const priority: HandoffSectionState[] = [
    "conflicting",
    "superseded",
    "stale",
    "missing",
    "current",
  ];

  return (
    priority.find((state) => states.includes(state)) ?? "current"
  );
}

function areOpenQuestionsResolved(section: HandoffContentSection) {
  const text = normalizeValue(section.text);

  if (!text || section.state !== "current") {
    return false;
  }

  const unresolvedSignals = [
    "awaiting",
    "needs confirmation",
    "open item",
    "pending",
    "requires confirmation",
    "still open",
    "tbd",
    "to be confirmed",
    "unresolved",
  ];

  if (unresolvedSignals.some((signal) => text.includes(signal))) {
    return false;
  }

  return /\b(no|none|resolved|closed)\b/.test(text);
}

function cloneStructuredContent(
  content: HandoffStructuredContent,
): HandoffStructuredContent {
  return handoffSectionOrder.reduce((snapshot, section) => {
    snapshot[section] = {
      ...content[section],
      supportingSources: content[section].supportingSources.map((source) => ({
        ...source,
      })),
    };

    return snapshot;
  }, {} as HandoffStructuredContent);
}

function collectStructuredContentSources(content: HandoffStructuredContent) {
  return collectUniqueSources(
    handoffSectionOrder.flatMap(
      (section) => content[section].supportingSources,
    ),
  );
}

function collectUniqueSources(sources: HandoffSupportingSource[]) {
  const sourceById = new Map<string, HandoffSupportingSource>();

  for (const source of sources) {
    sourceById.set(source.sourceId, source);
  }

  return [...sourceById.values()];
}

function buildHistoryEntry(
  input: HandoffRequestInput,
  {
    actorId,
    handoffId,
    occurredAt,
    sequence,
  }: {
    actorId: string;
    handoffId: string;
    occurredAt: string;
    sequence: number;
  },
): HandoffHistoryEntry {
  return {
    actorId,
    historyId: createId("hist", `${handoffId}-${sequence}-${occurredAt}`),
    occurredAt,
    provenanceLabel: "User request",
    purpose: input.purpose.trim(),
    receivingTeam: input.receivingTeam.trim(),
    requestedTiming: input.requestedTiming.trim(),
    sendingTeam: input.sendingTeam.trim(),
    state: "current",
    supportingSources: input.supportingSources,
  };
}

function buildPrototypeHistoryEntry(
  handoffId: string,
  sequence: number,
  options: {
    occurredAt: string;
    purpose: string;
    state: HandoffHistoryState;
    supportingSources: HandoffSupportingSource[];
  },
): HandoffHistoryEntry {
  return {
    actorId: "Launch Operations",
    historyId: createId("hist", `${handoffId}-prototype-${sequence}`),
    occurredAt: options.occurredAt,
    provenanceLabel: "Existing handoff context",
    purpose: options.purpose,
    receivingTeam: "Deployment Solutions",
    requestedTiming: "Before deployment kickoff",
    sendingTeam: "Launch Operations",
    state: options.state,
    supportingSources: options.supportingSources,
  };
}

function isReusableHandoffMatch(
  artifact: HandoffArtifact,
  input: HandoffRequestInput,
) {
  const artifactLaunch = normalizeValue(artifact.launchId);
  const inputLaunch = normalizeValue(input.launchId);
  const artifactWorkstream = normalizeValue(artifact.workstreamId);
  const inputWorkstream = normalizeValue(input.workstreamId);
  const artifactReceivingTeam = normalizeValue(artifact.receivingTeam);
  const inputReceivingTeam = normalizeValue(input.receivingTeam);

  if (artifactLaunch !== inputLaunch) {
    return false;
  }

  return (
    (artifactWorkstream && artifactWorkstream === inputWorkstream) ||
    artifactReceivingTeam === inputReceivingTeam
  );
}

function createHandoffId(input: HandoffRequestInput) {
  return `handoff-${slugify(input.launchId)}-${slugify(
    input.workstreamId,
  )}-${slugify(input.receivingTeam)}`;
}

function createId(prefix: string, seed: string) {
  return `${prefix}-${slugify(seed)}-${createSeedHash(seed)}`;
}

function createSeedHash(seed: string) {
  let hash = 5381;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function normalizeValue(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function slugify(value: string) {
  return (
    normalizeValue(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "handoff"
  );
}
