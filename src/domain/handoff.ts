import type {
  SourceAccessState,
  SourceApprovalState,
  SourceFreshnessState,
} from "./source-ledger";

export type HandoffStatus =
  | "accepted"
  | "draft"
  | "ready_for_review"
  | "requested"
  | "returned_for_clarification";

export type HandoffHistoryState =
  | "current"
  | "stale"
  | "missing"
  | "superseded"
  | "conflicting";

export type HandoffAction =
  | "accepted"
  | "appended"
  | "clarification_requested"
  | "created"
  | "ready_for_review"
  | "returned"
  | "updated";

export type HandoffAuditEventType =
  | "handoff.accepted"
  | "handoff.clarification_requested"
  | "handoff.ready_for_review"
  | "handoff.requested"
  | "handoff.returned"
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

export type HandoffReviewState =
  | "blocked"
  | "conflicting"
  | "incomplete"
  | "needs_clarification"
  | "ready"
  | "stale";

export type HandoffReviewArea =
  | HandoffSectionKey
  | "kickoffContext"
  | "supportingSources";

export type HandoffClarificationStatus = "open" | "resolved";

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

export type HandoffClarificationRequest = {
  area: HandoffReviewArea;
  clarificationId: string;
  owner: string;
  question: string;
  requestedAt: string;
  requestedBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
  sourceRoute?: string;
  status: HandoffClarificationStatus;
  stakeholderRoute?: string;
};

export type HandoffClarificationInput = {
  area: HandoffReviewArea;
  owner?: string;
  question: string;
  sourceRoute?: string;
  stakeholderRoute?: string;
};

export type HandoffReviewDecision = {
  actorId: string;
  decision: Extract<HandoffStatus, "accepted" | "returned_for_clarification">;
  occurredAt: string;
  requiredUpdates: string[];
};

export type HandoffReadinessReviewItem = {
  area: HandoffReviewArea;
  evidence: HandoffSupportingSource[];
  label: string;
  ownerRoute: string;
  reason: string;
  relatedClarificationIds: string[];
  requiredUpdate?: string;
  sourceRoute?: string;
  state: HandoffReviewState;
};

export type HandoffCompletenessReview = {
  artifactStatus: HandoffStatus;
  canAccept: boolean;
  gaps: HandoffReadinessReviewItem[];
  items: HandoffReadinessReviewItem[];
  openClarificationCount: number;
  requiredUpdates: string[];
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
  clarificationRequests: HandoffClarificationRequest[];
  createdAt: string;
  handoffId: string;
  history: HandoffHistoryEntry[];
  launchId: string;
  purpose: string;
  receivingTeam: string;
  requestedTiming: string;
  responsibleOwner: string;
  reviewDecision?: HandoffReviewDecision;
  reviewDecisions: HandoffReviewDecision[];
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

export const handoffReviewStateLabels: Record<HandoffReviewState, string> = {
  blocked: "Blocked",
  conflicting: "Conflicting",
  incomplete: "Incomplete",
  needs_clarification: "Needs clarification",
  ready: "Ready",
  stale: "Stale",
};

export const handoffStatusLabels: Record<HandoffStatus, string> = {
  accepted: "Accepted",
  draft: "Draft",
  ready_for_review: "Ready for review",
  requested: "Requested",
  returned_for_clarification: "Returned for clarification",
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

export const handoffReviewAreaLabels: Record<HandoffReviewArea, string> = {
  ...handoffSectionLabels,
  kickoffContext: "Kickoff context",
  supportingSources: "Supporting sources",
};

export const handoffReviewAreaOrder: HandoffReviewArea[] = [
  "scope",
  "assumptions",
  "commitments",
  "risks",
  "owners",
  "openQuestions",
  "supportingSources",
  "kickoffContext",
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
      reviewDecision: undefined,
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
    clarificationRequests: [],
    createdAt: occurredAt,
    handoffId,
    history: [entry],
    launchId: input.launchId.trim(),
    purpose: input.purpose.trim(),
    receivingTeam: input.receivingTeam.trim(),
    requestedTiming: input.requestedTiming.trim(),
    responsibleOwner: input.receivingTeam.trim(),
    reviewDecisions: [],
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
      clarificationRequests: [],
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
      reviewDecisions: [],
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
  const clarificationRequests = resolveClarificationRequestsForContent(
    existingArtifact,
    structuredContent,
    {
      actorId,
      occurredAt,
    },
  );
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
    clarificationRequests,
    history: [...existingArtifact.history, ...priorContentEntry],
    reviewDecision: undefined,
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
    reviewDecision: undefined,
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

export function getHandoffCompletenessReview(
  artifact: HandoffArtifact,
): HandoffCompletenessReview {
  const items = handoffReviewAreaOrder.map((area) =>
    buildReadinessReviewItem(artifact, area),
  );
  const gaps = items.filter((item) => item.state !== "ready");
  const openClarificationCount = artifact.clarificationRequests.filter(
    (request) => request.status === "open",
  ).length;

  return {
    artifactStatus: artifact.status,
    canAccept: artifact.status === "ready_for_review" && gaps.length === 0,
    gaps,
    items,
    openClarificationCount,
    requiredUpdates: gaps.map((gap) => gap.requiredUpdate ?? gap.reason),
  };
}

export function requestHandoffClarification(
  existingArtifacts: HandoffArtifact[],
  handoffId: string,
  input: HandoffClarificationInput,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffContentResult {
  const matchIndex = findHandoffArtifactIndex(existingArtifacts, handoffId);
  const existingArtifact = existingArtifacts[matchIndex];
  const question = input.question.trim();

  if (!question) {
    throw new Error("Clarification question is required.");
  }

  const clarificationRequest: HandoffClarificationRequest = {
    area: input.area,
    clarificationId: createId(
      "clar",
      `${handoffId}-${input.area}-${question}-${occurredAt}`,
    ),
    owner: input.owner?.trim() || getHandoffResponsibleOwner(existingArtifact),
    question,
    requestedAt: occurredAt,
    requestedBy: actorId,
    sourceRoute: getSafeSourceRoute(
      existingArtifact,
      input.area,
      input.sourceRoute,
    ),
    stakeholderRoute: input.stakeholderRoute?.trim() ||
      getDefaultStakeholderRoute(existingArtifact),
    status: "open",
  };
  const artifact: HandoffArtifact = {
    ...existingArtifact,
    clarificationRequests: [
      ...existingArtifact.clarificationRequests,
      clarificationRequest,
    ],
    reviewDecision: undefined,
    updatedAt: occurredAt,
  };
  const artifacts = replaceHandoffArtifact(
    existingArtifacts,
    matchIndex,
    artifact,
  );

  return {
    action: "clarification_requested",
    artifact,
    artifacts,
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "clarification_requested",
      actorId,
      correlationId,
      occurredAt,
    }),
  };
}

export function acceptHandoff(
  existingArtifacts: HandoffArtifact[],
  handoffId: string,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffContentResult {
  const matchIndex = findHandoffArtifactIndex(existingArtifacts, handoffId);
  const existingArtifact = existingArtifacts[matchIndex];
  const review = getHandoffCompletenessReview(existingArtifact);

  if (!review.canAccept) {
    throw new Error(buildAcceptBlockedMessage(existingArtifact, review));
  }

  const reviewDecision: HandoffReviewDecision = {
    actorId,
    decision: "accepted",
    occurredAt,
    requiredUpdates: [],
  };
  const artifact: HandoffArtifact = {
    ...existingArtifact,
    reviewDecision,
    reviewDecisions: [...existingArtifact.reviewDecisions, reviewDecision],
    status: "accepted",
    updatedAt: occurredAt,
  };
  const artifacts = replaceHandoffArtifact(
    existingArtifacts,
    matchIndex,
    artifact,
  );

  return {
    action: "accepted",
    artifact,
    artifacts,
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "accepted",
      actorId,
      correlationId,
      occurredAt,
    }),
  };
}

export function returnHandoffForClarification(
  existingArtifacts: HandoffArtifact[],
  handoffId: string,
  {
    actorId,
    correlationId,
    occurredAt = new Date().toISOString(),
  }: RequestReusableHandoffOptions,
): HandoffContentResult {
  const matchIndex = findHandoffArtifactIndex(existingArtifacts, handoffId);
  const existingArtifact = existingArtifacts[matchIndex];
  const review = getHandoffCompletenessReview(existingArtifact);
  const clarificationUpdates = existingArtifact.clarificationRequests
    .filter((request) => request.status === "open")
    .map((request) => `${handoffReviewAreaLabels[request.area]}: ${request.question}`);
  const requiredUpdates = [
    ...review.requiredUpdates,
    ...clarificationUpdates,
  ];
  const reviewDecision: HandoffReviewDecision = {
    actorId,
    decision: "returned_for_clarification",
    occurredAt,
    requiredUpdates:
      requiredUpdates.length > 0
        ? uniqueText(requiredUpdates)
        : ["Receiving team requested clarification before acceptance."],
  };
  const artifact: HandoffArtifact = {
    ...existingArtifact,
    reviewDecision,
    reviewDecisions: [...existingArtifact.reviewDecisions, reviewDecision],
    status: "returned_for_clarification",
    updatedAt: occurredAt,
  };
  const artifacts = replaceHandoffArtifact(
    existingArtifacts,
    matchIndex,
    artifact,
  );

  return {
    action: "returned",
    artifact,
    artifacts,
    auditEvent: buildHandoffAuditEvent(artifact, {
      action: "returned",
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
    accepted: "handoff.accepted",
    appended: "handoff.requested",
    clarification_requested: "handoff.clarification_requested",
    created: "handoff.requested",
    ready_for_review: "handoff.ready_for_review",
    returned: "handoff.returned",
    updated: "handoff.updated",
  };

  return {
    actorId,
    correlationId,
    eventId: createId("evt", `${correlationId}-handoff-${action}`),
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

function buildReadinessReviewItem(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
): HandoffReadinessReviewItem {
  const openClarifications = artifact.clarificationRequests.filter(
    (request) => request.area === area && request.status === "open",
  );
  const label = handoffReviewAreaLabels[area];
  const ownerRoute = getOwnerRouteForArea(artifact, area);

  if (openClarifications.length > 0) {
    return {
      area,
      evidence: getEvidenceForArea(artifact, area),
      label,
      ownerRoute,
      reason: `${label} has an open clarification request.`,
      relatedClarificationIds: openClarifications.map(
        (request) => request.clarificationId,
      ),
      requiredUpdate: `${label}: respond to ${openClarifications[0].question}`,
      sourceRoute: openClarifications[0].sourceRoute,
      state: "needs_clarification",
    };
  }

  if (area === "supportingSources") {
    const evidence = getEvidenceForArea(artifact, area);

    return {
      area,
      evidence,
      label,
      ownerRoute,
      reason: evidence.length > 0
        ? "Supporting source evidence is linked."
        : "No supporting sources are linked to the handoff.",
      relatedClarificationIds: [],
      requiredUpdate: evidence.length > 0
        ? undefined
        : "Supporting sources: link at least one source-backed reference.",
      sourceRoute: evidence.length > 0
        ? "Use linked source references."
        : "Source Ledger or sending team owner",
      state: evidence.length > 0 ? "ready" : "incomplete",
    };
  }

  if (area === "kickoffContext") {
    const hasKickoffContext = [
      artifact.launchId,
      artifact.workstreamId,
      artifact.purpose,
      artifact.requestedTiming,
    ].every((value) => normalizeValue(value));

    return {
      area,
      evidence: artifact.supportingSources,
      label,
      ownerRoute,
      reason: hasKickoffContext
        ? "Launch, workstream, purpose, and requested timing are present."
        : "Launch, workstream, purpose, or requested timing is missing.",
      relatedClarificationIds: [],
      requiredUpdate: hasKickoffContext
        ? undefined
        : "Kickoff context: confirm launch, workstream, purpose, and timing.",
      sourceRoute: "Digital Handoff Artifact request details",
      state: hasKickoffContext ? "ready" : "incomplete",
    };
  }

  return buildSectionReadinessReviewItem(artifact, area, {
    label,
    ownerRoute,
  });
}

function buildSectionReadinessReviewItem(
  artifact: HandoffArtifact,
  sectionKey: HandoffSectionKey,
  {
    label,
    ownerRoute,
  }: {
    label: string;
    ownerRoute: string;
  },
): HandoffReadinessReviewItem {
  const section = artifact.structuredContent[sectionKey];
  const hasText = Boolean(normalizeValue(section.text));
  const evidence = section.supportingSources;
  const sourceRoute = getDefaultSourceRoute(artifact, sectionKey);

  if (!hasText || section.state === "missing") {
    return {
      area: sectionKey,
      evidence,
      label,
      ownerRoute,
      reason: `${label} is missing current handoff context.`,
      relatedClarificationIds: [],
      requiredUpdate: `${label}: add current handoff context or explicitly mark none where appropriate.`,
      sourceRoute,
      state: "incomplete",
    };
  }

  if (sectionKey === "openQuestions" && !areOpenQuestionsResolved(section)) {
    return {
      area: sectionKey,
      evidence,
      label,
      ownerRoute,
      reason: "Open questions remain unresolved for receiving-team readiness.",
      relatedClarificationIds: [],
      requiredUpdate:
        "Open questions: resolve the questions or explicitly mark that none remain.",
      sourceRoute,
      state: "blocked",
    };
  }

  if (section.state === "stale") {
    return {
      area: sectionKey,
      evidence,
      label,
      ownerRoute,
      reason: `${label} is based on stale handoff context.`,
      relatedClarificationIds: [],
      requiredUpdate: `${label}: refresh the source or confirm the content is still current.`,
      sourceRoute,
      state: "stale",
    };
  }

  if (section.state === "conflicting") {
    return {
      area: sectionKey,
      evidence,
      label,
      ownerRoute,
      reason: `${label} conflicts with another handoff or source signal.`,
      relatedClarificationIds: [],
      requiredUpdate: `${label}: resolve the conflicting source or owner signal.`,
      sourceRoute,
      state: "conflicting",
    };
  }

  if (section.state === "superseded") {
    return {
      area: sectionKey,
      evidence,
      label,
      ownerRoute,
      reason: `${label} has been superseded and needs current replacement context.`,
      relatedClarificationIds: [],
      requiredUpdate: `${label}: replace superseded context with current receiving-team guidance.`,
      sourceRoute,
      state: "incomplete",
    };
  }

  return {
    area: sectionKey,
    evidence,
    label,
    ownerRoute,
    reason: `${label} is ready for receiving-team review.`,
    relatedClarificationIds: [],
    sourceRoute,
    state: "ready",
  };
}

function findHandoffArtifactIndex(
  artifacts: HandoffArtifact[],
  handoffId: string,
) {
  const matchIndex = artifacts.findIndex(
    (artifact) => artifact.handoffId === handoffId,
  );

  if (matchIndex === -1) {
    throw new Error("Handoff artifact was not found.");
  }

  return matchIndex;
}

function replaceHandoffArtifact(
  artifacts: HandoffArtifact[],
  matchIndex: number,
  artifact: HandoffArtifact,
) {
  return artifacts.map((candidate, index) =>
    index === matchIndex ? artifact : candidate,
  );
}

function getEvidenceForArea(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
) {
  if (area === "supportingSources") {
    return collectUniqueSources([
      ...artifact.supportingSources,
      ...collectStructuredContentSources(artifact.structuredContent),
    ]);
  }

  if (area === "kickoffContext") {
    return artifact.supportingSources;
  }

  return artifact.structuredContent[area].supportingSources;
}

function getOwnerRouteForArea(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
) {
  if (area === "owners") {
    return artifact.structuredContent.owners.text ||
      getHandoffResponsibleOwner(artifact);
  }

  if (area === "kickoffContext") {
    return artifact.sendingTeam;
  }

  return getHandoffResponsibleOwner(artifact);
}

function getDefaultSourceRoute(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
) {
  const evidence = getEvidenceForArea(artifact, area);

  if (evidence.length > 0) {
    return getSourceRouteLabel(evidence[0]);
  }

  if (area === "kickoffContext") {
    return "Digital Handoff Artifact request details";
  }

  return "Sending team or Source Ledger";
}

function getSafeSourceRoute(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
  sourceRoute?: string,
) {
  const evidence = getEvidenceForArea(artifact, area);

  if (evidence.some((source) => source.accessState === "restricted")) {
    return "Restricted source";
  }

  return sourceRoute?.trim() || getDefaultSourceRoute(artifact, area);
}

function getSourceRouteLabel(source: HandoffSupportingSource) {
  if (source.accessState === "restricted") {
    return "Restricted source";
  }

  return source.title;
}

function getDefaultStakeholderRoute(artifact: HandoffArtifact) {
  return `${artifact.sendingTeam} -> ${artifact.receivingTeam}`;
}

function resolveClarificationRequestsForContent(
  artifact: HandoffArtifact,
  structuredContent: HandoffStructuredContent,
  {
    actorId,
    occurredAt,
  }: {
    actorId: string;
    occurredAt: string;
  },
) {
  return artifact.clarificationRequests.map((request) => {
    if (
      request.status !== "open" ||
      !isClarificationAreaResolved(artifact, structuredContent, request.area)
    ) {
      return request;
    }

    return {
      ...request,
      resolvedAt: occurredAt,
      resolvedBy: actorId,
      status: "resolved" as const,
    };
  });
}

function isClarificationAreaResolved(
  artifact: HandoffArtifact,
  structuredContent: HandoffStructuredContent,
  area: HandoffReviewArea,
) {
  if (area === "supportingSources") {
    return collectUniqueSources([
      ...artifact.supportingSources,
      ...collectStructuredContentSources(structuredContent),
    ]).length > 0;
  }

  if (area === "kickoffContext") {
    return [
      artifact.launchId,
      artifact.workstreamId,
      artifact.purpose,
      artifact.requestedTiming,
    ].every((value) => normalizeValue(value));
  }

  const section = structuredContent[area];

  if (area === "openQuestions") {
    return areOpenQuestionsResolved(section);
  }

  return Boolean(normalizeValue(section.text)) && section.state === "current";
}

function buildAcceptBlockedMessage(
  artifact: HandoffArtifact,
  review: HandoffCompletenessReview,
) {
  if (artifact.status !== "ready_for_review") {
    return "Handoff must be marked ready for review before acceptance.";
  }

  return `Resolve readiness gaps before accepting: ${review.requiredUpdates.join(
    " ",
  )}`;
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

function uniqueText(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
