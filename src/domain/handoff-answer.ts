import type {
  AnswerConfidence,
  SourceBackedAnswer,
  SourceBackedAnswerState,
  SourceCitation,
  SourceSystem,
} from "./answer";
import type {
  HandoffArtifact,
  HandoffAuditEvent,
  HandoffContentSection,
  HandoffHistoryEntry,
  HandoffSectionKey,
  HandoffSupportingSource,
} from "./handoff";
import {
  getHandoffCompletenessReview,
  getHandoffKickoffReadinessDecisions,
  handoffHistoryStateLabels,
  handoffKickoffReadinessStateLabels,
  handoffReviewAreaLabels,
  handoffReviewStateLabels,
  handoffSectionLabels,
  handoffSectionOrder,
  handoffStatusLabels,
} from "./handoff";
import type { WorkspaceSession } from "./workspace";

type BuildHandoffAnswerInput = {
  artifacts: HandoffArtifact[];
  auditEvents?: HandoffAuditEvent[];
  previousQuestion?: string | null;
  question: string;
  session: WorkspaceSession;
};

type HandoffQuestionKind =
  | "audit"
  | "changes"
  | "clarifications"
  | "overview"
  | "readiness"
  | "sections"
  | "unknown";

type HandoffQuestionIntent = {
  kind: HandoffQuestionKind;
  sections: HandoffSectionKey[];
};

const sectionKeywordMatchers: Array<{
  key: HandoffSectionKey;
  pattern: RegExp;
}> = [
  { key: "scope", pattern: /\b(scope|scoped|handoff scope)\b/i },
  {
    key: "assumptions",
    pattern: /\b(assumption|assumptions)\b/i,
  },
  {
    key: "commitments",
    pattern: /\b(commitment|commitments|committed|promise|promises)\b/i,
  },
  { key: "risks", pattern: /\b(risk|risks|blocker|blockers)\b/i },
  { key: "owners", pattern: /\b(owner|owners|owns|responsible)\b/i },
  {
    key: "openQuestions",
    pattern: /\b(open question|open questions|question|questions|unresolved)\b/i,
  },
];

function hasHandoffTerm(question: string) {
  return /\b(handoff|handoffs|handoff artifact|clarification|clarifications|receiving team|sending team|kickoff readiness)\b/i.test(
    question,
  );
}

function isContextualFollowUp(question: string) {
  return /^(what about (it|this|that|them|those|the owner|the owners|the risk|the risks|the source|the sources)|what changed|that one|this one)\??$/i.test(
    question.trim(),
  );
}

export function isHandoffQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  if (hasHandoffTerm(question)) {
    return true;
  }

  return Boolean(previousQuestion && hasHandoffTerm(previousQuestion) &&
    isContextualFollowUp(question));
}

export function createPrototypeHandoffAuditEvents(
  artifacts: HandoffArtifact[],
): HandoffAuditEvent[] {
  return artifacts.flatMap((artifact) => [
    {
      actorId: "Launch Operations",
      correlationId: `${artifact.handoffId}-requested-correlation`,
      eventId: `${artifact.handoffId}-requested-event`,
      eventType: "handoff.requested",
      handoffId: artifact.handoffId,
      launchId: artifact.launchId,
      metadata: {
        action: "created",
        receivingTeam: artifact.receivingTeam,
        sendingTeam: artifact.sendingTeam,
        workstreamId: artifact.workstreamId,
      },
      occurredAt: artifact.createdAt,
    },
    {
      actorId: "Launch Operations",
      correlationId: `${artifact.handoffId}-updated-correlation`,
      eventId: `${artifact.handoffId}-updated-event`,
      eventType: "handoff.updated",
      handoffId: artifact.handoffId,
      launchId: artifact.launchId,
      metadata: {
        action: "updated",
        receivingTeam: artifact.receivingTeam,
        sendingTeam: artifact.sendingTeam,
        workstreamId: artifact.workstreamId,
      },
      occurredAt: artifact.updatedAt,
    },
  ]);
}

export function buildHandoffSourceBackedAnswer({
  artifacts,
  auditEvents = [],
  previousQuestion,
  question,
  session,
}: BuildHandoffAnswerInput): SourceBackedAnswer {
  const activeQuestion = getActiveQuestion(question, previousQuestion);
  const intent = classifyHandoffQuestion(activeQuestion);
  const artifact = findMatchingArtifact(artifacts, session, activeQuestion);

  if (shouldReturnNoReliableSource(activeQuestion) || !artifact) {
    return buildNoReliableHandoffAnswer(session.launch.name);
  }

  const canViewRestricted = session.user.role === "admin";

  if (intent.kind === "changes") {
    return buildHistoryAnswer(artifact, canViewRestricted);
  }

  if (intent.kind === "clarifications") {
    return buildClarificationAnswer(artifact, canViewRestricted);
  }

  if (intent.kind === "readiness") {
    return buildReadinessAnswer(artifact, canViewRestricted);
  }

  if (intent.kind === "audit") {
    return buildAuditAnswer(artifact, auditEvents, canViewRestricted);
  }

  if (intent.kind === "sections") {
    return buildSectionAnswer(artifact, intent.sections, canViewRestricted);
  }

  if (intent.kind === "overview") {
    return buildSectionAnswer(
      artifact,
      ["scope", "commitments", "risks", "owners", "openQuestions"],
      canViewRestricted,
    );
  }

  return buildMissingHandoffInformationAnswer(
    artifact,
    "Source gap: the handoff artifact does not contain a reliable section for that question.",
    [
      {
        id: "ask-handoff-owner",
        label: `Ask ${artifact.responsibleOwner} to add the missing handoff section.`,
        href: "/handoff",
      },
      {
        id: "check-handoff-sources",
        label: "Check Source Ledger for an approved handoff source.",
        href: "/sources",
      },
    ],
    canViewRestricted,
  );
}

function getActiveQuestion(question: string, previousQuestion?: string | null) {
  if (previousQuestion && isContextualFollowUp(question)) {
    return `${previousQuestion} ${question}`;
  }

  return question;
}

function classifyHandoffQuestion(question: string): HandoffQuestionIntent {
  if (/\b(audit|event|events|recorded|action|actions)\b/i.test(question)) {
    return { kind: "audit", sections: [] };
  }

  if (/\b(changed|change|changes|since|prior|previous|history|appended)\b/i.test(question)) {
    return { kind: "changes", sections: [] };
  }

  if (/\b(clarification|clarifications|returned|return)\b/i.test(question)) {
    return { kind: "clarifications", sections: [] };
  }

  const sections = sectionKeywordMatchers
    .filter((matcher) => matcher.pattern.test(question))
    .map((matcher) => matcher.key);

  if (sections.length > 0) {
    return { kind: "sections", sections: uniqueValues(sections) };
  }

  if (/\b(readiness|ready|acceptance|accept|complete|completeness|readiness decisions?|kickoff decisions?|gaps?|missing|stale|conflicting|superseded)\b/i.test(question)) {
    return { kind: "readiness", sections: [] };
  }

  if (/\b(handoff|handoffs)\b/i.test(question)) {
    return { kind: "overview", sections: [] };
  }

  return { kind: "unknown", sections: [] };
}

function findMatchingArtifact(
  artifacts: HandoffArtifact[],
  session: WorkspaceSession,
  question: string,
) {
  const sessionLaunchId = normalize(session.launch.id);
  const launchArtifacts = artifacts.filter(
    (artifact) => normalize(artifact.launchId) === sessionLaunchId,
  );
  const explicitMatches = launchArtifacts.filter((artifact) =>
    questionMentionsArtifact(question, artifact),
  );

  if (explicitMatches.length > 0) {
    return explicitMatches[0];
  }

  if (hasExplicitArtifactQualifier(question)) {
    return undefined;
  }

  return launchArtifacts[0];
}

function questionMentionsArtifact(
  question: string,
  artifact: HandoffArtifact,
) {
  const normalizedQuestion = normalizeForSearch(question);
  const candidates = [
    artifact.handoffId,
    artifact.receivingTeam,
    artifact.sendingTeam,
    artifact.workstreamId,
  ]
    .map(normalizeForSearch)
    .filter((value) => value.length >= 4);

  return candidates.some((candidate) =>
    normalizedQuestion.includes(candidate),
  );
}

function hasExplicitArtifactQualifier(question: string) {
  return /\b(workstream|receiving team|sending team|team)\b/i.test(question);
}

function shouldReturnNoReliableSource(question: string) {
  return /\b(unverified|rumor|unsupported|no reliable source)\b/i.test(question);
}

function buildSectionAnswer(
  artifact: HandoffArtifact,
  sections: HandoffSectionKey[],
  canViewRestricted: boolean,
): SourceBackedAnswer {
  const requestedSections = sections.length > 0 ? sections : handoffSectionOrder;
  const sources = requestedSections.flatMap(
    (section) => artifact.structuredContent[section].supportingSources,
  );

  if (hasRestrictedSource(sources) && !canViewRestricted) {
    return buildRestrictedHandoffAnswer(artifact, "handoff section");
  }

  const missingSections = requestedSections.filter((section) =>
    isMissingSection(artifact.structuredContent[section]),
  );
  const state = getSectionAnswerState(
    requestedSections.map((section) => artifact.structuredContent[section]),
  );
  const citations = buildCitations(artifact, sources, canViewRestricted);
  const sectionFacts = requestedSections.map((section) =>
    buildSectionFact(artifact, section),
  );
  const missingFacts = missingSections.map((section) => ({
    id: `${artifact.handoffId}-${section}-missing`,
    text: `${handoffSectionLabels[section]} is missing current handoff information. Responsible owner: ${artifact.responsibleOwner}.`,
    citationId: artifact.handoffId,
  }));

  return {
    id: `${artifact.handoffId}-${requestedSections.join("-")}-answer`,
    state,
    title: getSectionAnswerTitle(requestedSections),
    summary: `The answer is based on the reusable handoff artifact for ${artifact.receivingTeam}.`,
    confidence: getConfidenceForState(state),
    freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
    citations,
    retrievedFacts: [...sectionFacts, ...missingFacts],
    generatedDraft: {
      id: `${artifact.handoffId}-${requestedSections.join("-")}-draft`,
      text: "Draft response: use the current handoff facts, then resolve any stale, conflicting, or missing sections before treating the handoff as final.",
      reviewLabel: "Draft language requires human review.",
    },
    nextActions: buildSectionNextActions(artifact, missingSections),
    sourceGap: getSectionSourceGap(requestedSections, state),
  };
}

function buildReadinessAnswer(
  artifact: HandoffArtifact,
  canViewRestricted: boolean,
): SourceBackedAnswer {
  const review = getHandoffCompletenessReview(artifact);
  const sources = review.items.flatMap((item) => item.evidence);

  if (hasRestrictedSource(sources) && !canViewRestricted) {
    return buildRestrictedHandoffAnswer(artifact, "handoff readiness");
  }

  const state: SourceBackedAnswerState = review.canAccept
    ? "answered"
    : "missing_information";
  const citations = buildCitations(artifact, sources, canViewRestricted);
  const statusRequiredUpdate = !review.canAccept &&
    review.gaps.length === 0 &&
    artifact.status !== "ready_for_review"
    ? ["Handoff status: mark the handoff ready for review before acceptance."]
    : [];
  const requiredUpdates = review.requiredUpdates.length > 0
    ? review.requiredUpdates
    : statusRequiredUpdate;
  const issueCount = review.gaps.length + statusRequiredUpdate.length;
  const gapFacts = review.items.map((item) => ({
    id: `${artifact.handoffId}-${item.area}-readiness`,
    text:
      `${item.label} is ${handoffReviewStateLabels[item.state]}. ` +
      `${item.reason} Owner route: ${item.ownerRoute}. ` +
      `Source route: ${item.sourceRoute ?? "No source route available"}.`,
    citationId: getFirstCitationId(item.evidence, artifact.handoffId),
  }));

  return {
    id: `${artifact.handoffId}-readiness-answer`,
    state,
    title: review.canAccept
      ? "Handoff readiness is clear"
      : "Handoff readiness needs attention",
    summary: review.canAccept
      ? "The handoff completeness review has no open readiness gaps."
      : `The handoff is not acceptance-ready. ${issueCount} readiness issue(s) and ${review.openClarificationCount} open clarification request(s) remain.`,
    confidence: review.canAccept ? "high" : "low",
    freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
    citations,
    retrievedFacts: [
      {
        id: `${artifact.handoffId}-status`,
        text:
          `Handoff status is ${handoffStatusLabels[artifact.status]}. ` +
          `Acceptance ready: ${review.canAccept ? "Yes" : "No"}.`,
        citationId: artifact.handoffId,
      },
      ...gapFacts,
      ...buildReviewDecisionFacts(artifact),
      ...buildKickoffReadinessDecisionFacts(artifact),
    ],
    nextActions: review.canAccept
      ? [
          {
            id: "open-handoff",
            label: "Open the accepted handoff artifact.",
            href: "/handoff",
          },
        ]
      : [
          {
            id: "resolve-readiness-gaps",
            label: `Ask ${artifact.responsibleOwner} to resolve readiness gaps.`,
            href: "/handoff",
          },
          {
            id: "check-linked-sources",
            label: "Review linked source records for freshness and conflicts.",
            href: "/sources",
          },
        ],
    sourceGap: review.canAccept
      ? undefined
      : `Source gap: ${requiredUpdates.join(" ")}`,
  };
}

function buildHistoryAnswer(
  artifact: HandoffArtifact,
  canViewRestricted: boolean,
): SourceBackedAnswer {
  const sources = [
    ...artifact.history.flatMap((entry) => entry.supportingSources),
    ...getStructuredContentSources(artifact),
  ];

  if (hasRestrictedSource(sources) && !canViewRestricted) {
    return buildRestrictedHandoffAnswer(artifact, "handoff history");
  }

    if (artifact.history.length === 0) {
    return buildMissingHandoffInformationAnswer(
      artifact,
      "Source gap: no handoff history has been recorded for this artifact.",
      [
        {
          id: "add-handoff-history",
          label: "Ask the handoff owner to append source-backed history.",
          href: "/handoff",
        },
      ],
      canViewRestricted,
    );
  }

  const citations = buildCitations(artifact, sources, canViewRestricted);
  const nonCurrentHistory = artifact.history.filter(
    (entry) => entry.state !== "current",
  );

  return {
    id: `${artifact.handoffId}-history-answer`,
    state: nonCurrentHistory.length > 0 ? "partial_confidence" : "answered",
    title: "Handoff change history",
    summary:
      "LaunchPad found appended handoff history and separated current context from stale, missing, superseded, or conflicting context.",
    confidence: nonCurrentHistory.length > 0 ? "medium" : "high",
    freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
    citations,
    retrievedFacts: [
      ...artifact.history.map((entry) => buildHistoryFact(artifact, entry)),
      ...buildCurrentSectionUpdateFacts(artifact),
      ...buildKickoffReadinessDecisionFacts(artifact),
    ],
    generatedDraft: {
      id: `${artifact.handoffId}-history-draft`,
      text: "Draft response: review the non-current history entries before using prior handoff context for kickoff decisions.",
      reviewLabel: "Draft language requires human review.",
    },
    nextActions: [
      {
        id: "open-handoff-history",
        label: "Open the handoff artifact history.",
        href: "/handoff",
      },
      {
        id: "refresh-stale-history",
        label: "Ask the responsible owner to refresh stale or conflicting context.",
        href: "/handoff",
      },
    ],
    sourceGap: nonCurrentHistory.length > 0
      ? "Source gap: prior handoff context includes stale, missing, superseded, or conflicting entries."
      : undefined,
  };
}

function buildClarificationAnswer(
  artifact: HandoffArtifact,
  canViewRestricted: boolean,
): SourceBackedAnswer {
  if (
    !canViewRestricted &&
    artifact.clarificationRequests.some((request) =>
      request.sourceRoute?.toLowerCase().includes("restricted"),
    )
  ) {
    return buildRestrictedHandoffAnswer(artifact, "handoff clarification history");
  }

  const citations = buildCitations(artifact, artifact.supportingSources, canViewRestricted);

  return {
    id: `${artifact.handoffId}-clarification-answer`,
    state: "answered",
    title: "Handoff clarification history",
    summary: artifact.clarificationRequests.length > 0
      ? "Clarification requests are recorded on the handoff artifact."
      : "No clarification requests are currently recorded on the handoff artifact.",
    confidence: "high",
    freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
    citations,
    retrievedFacts: artifact.clarificationRequests.length > 0
      ? artifact.clarificationRequests.map((request) => ({
          id: request.clarificationId,
          text:
            `${handoffReviewAreaLabels[request.area]} clarification is ${request.status}. ` +
            `Question: ${request.question}. Requested ${request.requestedAt} by ${request.requestedBy}. ` +
            `Owner: ${request.owner}.`,
          citationId: artifact.handoffId,
        }))
      : [
          {
            id: `${artifact.handoffId}-no-clarifications`,
            text: "No clarification requests are recorded for this handoff artifact.",
            citationId: artifact.handoffId,
          },
        ],
    nextActions: [
      {
        id: "open-clarification-flow",
        label: "Open the handoff clarification flow.",
        href: "/handoff",
      },
    ],
  };
}

function buildAuditAnswer(
  artifact: HandoffArtifact,
  auditEvents: HandoffAuditEvent[],
  canViewRestricted: boolean,
): SourceBackedAnswer {
  const matchingEvents = auditEvents.filter(
    (event) => event.handoffId === artifact.handoffId,
  ).sort((first, second) =>
    first.occurredAt.localeCompare(second.occurredAt),
  );

  if (matchingEvents.length === 0) {
    return buildMissingHandoffInformationAnswer(
      artifact,
      "Source gap: no handoff audit events were available for this answer.",
      [
        {
          id: "check-handoff-audit",
          label: "Ask the handoff owner or admin to confirm audit history.",
          href: "/handoff",
        },
      ],
      canViewRestricted,
    );
  }

  return {
    id: `${artifact.handoffId}-audit-answer`,
    state: "answered",
    title: "Handoff audit events",
    summary: "Audit events are available for the handoff artifact.",
    confidence: "high",
    freshnessLabel: `Freshness: latest audit event ${matchingEvents.at(-1)?.occurredAt}`,
    citations: buildCitations(
      artifact,
      artifact.supportingSources,
      canViewRestricted,
    ),
    retrievedFacts: matchingEvents.map((event) => ({
      id: event.eventId,
      text:
        `${event.eventType} occurred ${event.occurredAt} by ${event.actorId}. ` +
        `Action: ${event.metadata.action}.`,
      citationId: artifact.handoffId,
    })),
    nextActions: [
      {
        id: "open-handoff-audit",
        label: "Open the handoff artifact audit details.",
        href: "/handoff",
      },
    ],
  };
}

function buildNoReliableHandoffAnswer(launchName: string): SourceBackedAnswer {
  return {
    id: `${launchName}-handoff-no-reliable-source`,
    state: "no_reliable_source",
    title: "No reliable handoff source found",
    summary:
      "LaunchPad did not find an approved, accessible handoff artifact or source record that can verify this handoff claim.",
    confidence: "none",
    freshnessLabel: "Freshness: no reliable handoff source available",
    citations: [],
    retrievedFacts: [],
    sourceGap:
      "Source gap: no approved handoff artifact or source record was found for that question.",
    nextActions: [
      {
        id: "open-handoff",
        label: "Open the handoff workspace to request or complete the artifact.",
        href: "/handoff",
      },
      {
        id: "check-source-ledger",
        label: "Check Source Ledger for missing handoff records.",
        href: "/sources",
      },
    ],
  };
}

function buildRestrictedHandoffAnswer(
  artifact: HandoffArtifact,
  restrictedArea: string,
): SourceBackedAnswer {
  return {
    id: `${artifact.handoffId}-${slugify(restrictedArea)}-restricted`,
    state: "access_restricted",
    title: "Access restricted",
    summary:
      `A matching ${restrictedArea} exists, but your current role cannot view the restricted handoff details.`,
    confidence: "low",
    freshnessLabel: "Freshness: hidden because access is restricted",
    citations: [
      {
        accessState: "restricted",
        freshnessLabel: "Freshness: restricted",
        id: `${artifact.handoffId}-restricted-source`,
        marker: "1",
        sourceType: "Restricted handoff source",
        system: "Handoff artifact",
        title: "Restricted handoff source",
      },
    ],
    retrievedFacts: [],
    sourceGap:
      "Source gap: request access or ask an authorized handoff owner to provide a non-restricted summary.",
    nextActions: [
      {
        id: "request-handoff-access",
        label: "Request access from the handoff owner.",
        href: "/handoff",
      },
      {
        id: "ask-authorized-owner",
        label: "Ask an authorized owner for an access-safe summary.",
        href: "/handoff",
      },
    ],
  };
}

function buildMissingHandoffInformationAnswer(
  artifact: HandoffArtifact,
  sourceGap: string,
  nextActions: SourceBackedAnswer["nextActions"],
  canViewRestricted: boolean,
): SourceBackedAnswer {
  return {
    id: `${artifact.handoffId}-missing-information`,
    state: "missing_information",
    title: "Missing handoff information",
    summary:
      "LaunchPad found a handoff artifact, but it does not contain reliable information to answer this completely.",
    confidence: "low",
    freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
    citations: buildCitations(
      artifact,
      artifact.supportingSources,
      canViewRestricted,
    ),
    retrievedFacts: [
      {
        id: `${artifact.handoffId}-missing-gap`,
        text: sourceGap.replace(/^Source gap:\s*/i, ""),
        citationId: artifact.handoffId,
      },
    ],
    sourceGap,
    nextActions,
  };
}

function buildSectionFact(
  artifact: HandoffArtifact,
  sectionKey: HandoffSectionKey,
) {
  const section = artifact.structuredContent[sectionKey];
  const label = handoffSectionLabels[sectionKey];
  const stateLabel = handoffHistoryStateLabels[section.state];
  const timestamp = section.updatedAt ?? artifact.updatedAt;
  const actor = section.updatedBy ?? artifact.responsibleOwner;

  if (isMissingSection(section)) {
    return {
      id: `${artifact.handoffId}-${sectionKey}-gap`,
      text: `${label} is missing current handoff information. Updated ${timestamp} by ${actor}.`,
      citationId: artifact.handoffId,
    };
  }

  return {
    id: `${artifact.handoffId}-${sectionKey}`,
    text:
      `${label}: ${section.text} State: ${stateLabel}. ` +
      `Updated ${timestamp} by ${actor}.`,
    citationId: getFirstCitationId(section.supportingSources, artifact.handoffId),
  };
}

function buildReviewDecisionFacts(artifact: HandoffArtifact) {
  return artifact.reviewDecisions.map((decision, index) => ({
    id: `${artifact.handoffId}-review-decision-${index + 1}`,
    text:
      `Review decision ${handoffStatusLabels[decision.decision]} recorded ` +
      `${decision.occurredAt} by ${decision.actorId}. Required updates: ` +
      `${decision.requiredUpdates.length > 0 ? decision.requiredUpdates.join(" ") : "None"}.`,
    citationId: artifact.handoffId,
  }));
}

function buildKickoffReadinessDecisionFacts(artifact: HandoffArtifact) {
  return getHandoffKickoffReadinessDecisions(artifact).map((decision, index) => ({
    id: `${artifact.handoffId}-kickoff-readiness-decision-${index + 1}`,
    text:
      `Kickoff readiness decision for ${handoffReviewAreaLabels[decision.area]} ` +
      `is ${handoffKickoffReadinessStateLabels[decision.state]}. ` +
      `Recorded ${decision.occurredAt} by ${decision.actorId}. ` +
      `Handoff ID: ${decision.handoffId ?? artifact.handoffId}. ` +
      `Launch ID: ${decision.launchId ?? artifact.launchId}. ` +
      `Workstream ID: ${decision.workstreamId ?? artifact.workstreamId}. ` +
      `Owner route: ${decision.ownerRoute}. Source route: ` +
      `${decision.sourceRoute ?? "No source route available"}. ` +
      `Note: ${decision.note || "None"}.`,
    citationId: artifact.handoffId,
  }));
}

function buildCurrentSectionUpdateFacts(artifact: HandoffArtifact) {
  return handoffSectionOrder
    .filter((sectionKey) =>
      Boolean(artifact.structuredContent[sectionKey].updatedAt) ||
      Boolean(normalize(artifact.structuredContent[sectionKey].text)),
    )
    .map((sectionKey) => {
      const section = artifact.structuredContent[sectionKey];
      const timestamp = section.updatedAt ?? artifact.updatedAt;
      const actor = section.updatedBy ?? artifact.responsibleOwner;

      return {
        id: `${artifact.handoffId}-${sectionKey}-current-update`,
        text:
          `Current ${handoffSectionLabels[sectionKey]} was updated ` +
          `${timestamp} by ${actor}. State: ${handoffHistoryStateLabels[section.state]}.`,
        citationId: getFirstCitationId(
          section.supportingSources,
          artifact.handoffId,
        ),
      };
    });
}

function buildHistoryFact(
  artifact: HandoffArtifact,
  entry: HandoffHistoryEntry,
) {
  return {
    id: entry.historyId,
    text:
      `Appended handoff history from ${entry.occurredAt} by ${entry.actorId}: ` +
      `${entry.purpose} State: ${handoffHistoryStateLabels[entry.state]}.`,
    citationId: getFirstCitationId(entry.supportingSources, artifact.handoffId),
  };
}

function buildCitations(
  artifact: HandoffArtifact,
  sources: HandoffSupportingSource[],
  canViewRestricted: boolean,
): SourceCitation[] {
  const citations = [
    {
      accessState: "authorized" as const,
      freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
      href: "/handoff",
      id: artifact.handoffId,
      marker: "0",
      sourceType: "Digital handoff artifact",
      system: "Handoff artifact" as const,
      title: "Digital Handoff Artifact",
    },
    ...collectUniqueSources(sources).map((source) =>
      sourceToCitation(source, canViewRestricted),
    ),
  ];

  return collectUniqueCitations(citations).map((citation, index) => ({
    ...citation,
    marker: String(index + 1),
  }));
}

function sourceToCitation(
  source: HandoffSupportingSource,
  canViewRestricted: boolean,
): SourceCitation {
  const isRestricted = isSourceRestricted(source) && !canViewRestricted;

  return {
    accessState: isRestricted ? "restricted" : "authorized",
    freshnessLabel: getSourceFreshnessLabel(source),
    href: isRestricted ? undefined : `/sources#${slugifySourceId(source.sourceId)}`,
    id: source.sourceId,
    marker: "0",
    sourceType: source.provenanceLabel || "Handoff source",
    system: inferSourceSystem(source),
    title: isRestricted ? "Restricted handoff source" : source.title,
  };
}

function getSourceFreshnessLabel(source: HandoffSupportingSource) {
  if (!source.freshnessState) {
    return "Freshness: not provided";
  }

  return `Freshness: ${source.freshnessState}`;
}

function inferSourceSystem(source: HandoffSupportingSource): SourceSystem {
  const sourceText = `${source.sourceId} ${source.title} ${source.provenanceLabel}`.toLowerCase();

  if (sourceText.includes("smartsheet")) {
    return "Smartsheet";
  }

  if (sourceText.includes("salesforce") || sourceText.includes("ecrm")) {
    return "ECRM/Salesforce";
  }

  if (sourceText.includes("teams")) {
    return "Teams";
  }

  if (sourceText.includes("email")) {
    return "Email";
  }

  if (sourceText.includes("playbook")) {
    return "Playbook";
  }

  if (sourceText.includes("handoff")) {
    return "Handoff artifact";
  }

  return "SharePoint";
}

function getFirstCitationId(
  sources: HandoffSupportingSource[],
  fallbackCitationId: string,
) {
  return sources[0]?.sourceId ?? fallbackCitationId;
}

function getSectionAnswerState(
  sections: HandoffContentSection[],
): SourceBackedAnswerState {
  if (sections.some(isMissingSection)) {
    return "missing_information";
  }

  if (sections.some((section) => section.state === "stale")) {
    return "source_stale";
  }

  if (
    sections.some((section) =>
      section.state === "conflicting" || section.state === "superseded",
    )
  ) {
    return "partial_confidence";
  }

  return "answered";
}

function getConfidenceForState(
  state: SourceBackedAnswerState,
): AnswerConfidence {
  if (state === "answered") {
    return "high";
  }

  if (state === "no_reliable_source") {
    return "none";
  }

  if (state === "access_restricted" || state === "missing_information") {
    return "low";
  }

  return "medium";
}

function getSectionAnswerTitle(sections: HandoffSectionKey[]) {
  if (sections.length === 1) {
    return `${handoffSectionLabels[sections[0]]} handoff answer`;
  }

  return "Handoff facts and gaps";
}

function getSectionSourceGap(
  sections: HandoffSectionKey[],
  state: SourceBackedAnswerState,
) {
  if (state === "answered") {
    return undefined;
  }

  const labels = sections.map((section) => handoffSectionLabels[section]).join(", ");

  if (state === "source_stale") {
    return `Source gap: ${labels} include stale handoff context that should be refreshed.`;
  }

  if (state === "partial_confidence") {
    return `Source gap: ${labels} include conflicting or superseded handoff context.`;
  }

  return `Source gap: ${labels} need current handoff information or linked sources.`;
}

function buildSectionNextActions(
  artifact: HandoffArtifact,
  missingSections: HandoffSectionKey[],
) {
  if (missingSections.length === 0) {
    return [
      {
        id: "open-handoff-artifact",
        label: "Open the handoff artifact.",
        href: "/handoff",
      },
      {
        id: "ask-readiness-follow-up",
        label: "Ask a readiness follow-up question.",
        href: "#agent-question",
      },
    ];
  }

  return [
    {
      id: "complete-missing-sections",
      label: `Ask ${artifact.responsibleOwner} to complete ${missingSections
        .map((section) => handoffSectionLabels[section].toLowerCase())
        .join(", ")}.`,
      href: "/handoff",
    },
    {
      id: "link-missing-sources",
      label: "Link approved source records to the missing handoff sections.",
      href: "/sources",
    },
  ];
}

function isMissingSection(section: HandoffContentSection) {
  return !normalize(section.text) || section.state === "missing";
}

function hasRestrictedSource(sources: HandoffSupportingSource[]) {
  return sources.some(isSourceRestricted);
}

function isSourceRestricted(source: HandoffSupportingSource) {
  return (
    source.accessState !== "authorized" ||
    source.approvalState === "restricted" ||
    source.freshnessState === "restricted"
  );
}

function getStructuredContentSources(artifact: HandoffArtifact) {
  return handoffSectionOrder.flatMap(
    (sectionKey) => artifact.structuredContent[sectionKey].supportingSources,
  );
}

function collectUniqueSources(sources: HandoffSupportingSource[]) {
  const sourceById = new Map<string, HandoffSupportingSource>();

  for (const source of sources) {
    sourceById.set(source.sourceId, source);
  }

  return [...sourceById.values()];
}

function collectUniqueCitations(citations: SourceCitation[]) {
  const citationById = new Map<string, SourceCitation>();

  for (const citation of citations) {
    citationById.set(citation.id, citation);
  }

  return [...citationById.values()];
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeForSearch(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugifySourceId(sourceId: string) {
  return sourceId.replace(/^src-/, "");
}
