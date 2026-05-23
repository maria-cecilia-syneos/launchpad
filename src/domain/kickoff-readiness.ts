import type {
  HandoffArtifact,
  HandoffAuditEvent,
  HandoffHistoryState,
  HandoffKickoffReadinessDecision,
  HandoffReviewArea,
  HandoffReviewState,
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
  isHandoffKickoffPrepEligible,
} from "./handoff";

export type KickoffReadinessReference = {
  accessState: "authorized" | "restricted";
  freshnessLabel: string;
  href?: string;
  id: string;
  sourceType: string;
  title: string;
};

export type KickoffReadinessSummarySection = {
  id: string;
  label: string;
  referenceIds: string[];
  state: HandoffHistoryState;
  stateLabel: string;
  text: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type KickoffReadinessGap = {
  id: string;
  label: string;
  nextAction: string;
  ownerRoute: string;
  referenceIds: string[];
  reason: string;
  sourceRoute: string;
  state: HandoffReviewState | "not_ready";
  stateLabel: string;
};

export type KickoffReadinessDecisionFact = HandoffKickoffReadinessDecision & {
  areaLabel: string;
  referenceIds: string[];
  stateLabel: string;
};

export type KickoffReadinessSummary = {
  decisionHistory: KickoffReadinessDecisionFact[];
  eligible: boolean;
  freshnessLabel: string;
  gaps: KickoffReadinessGap[];
  nextActions: Array<{
    href: string;
    id: string;
    label: string;
  }>;
  references: KickoffReadinessReference[];
  sections: KickoffReadinessSummarySection[];
  summary: string;
  title: string;
};

type BuildKickoffReadinessSummaryInput = {
  artifact: HandoffArtifact;
  auditEvents?: HandoffAuditEvent[];
  canViewRestricted: boolean;
};

export function buildKickoffReadinessSummary({
  artifact,
  auditEvents = [],
  canViewRestricted,
}: BuildKickoffReadinessSummaryInput): KickoffReadinessSummary {
  const review = getHandoffCompletenessReview(artifact);
  const sourceReferenceIdBySourceId = buildSourceReferenceIdBySourceId(
    collectArtifactSources(artifact),
    canViewRestricted,
  );
  const references = buildReferences(
    artifact,
    auditEvents,
    canViewRestricted,
    sourceReferenceIdBySourceId,
  );
  const sections = [
    ...handoffSectionOrder.map((sectionKey) =>
      buildSectionSummary(
        artifact,
        sectionKey,
        canViewRestricted,
        sourceReferenceIdBySourceId,
      ),
    ),
    ...artifact.history.map((entry, index) => {
      const hasRestrictedEvidence = hasRestrictedSource(entry.supportingSources) &&
        !canViewRestricted;
      const historyReferenceId = hasRestrictedEvidence
        ? `restricted-history-${index + 1}`
        : entry.historyId;

      return {
        id: entry.historyId,
        label: index === artifact.history.length - 1
          ? "Latest appended context"
          : "Appended context",
        referenceIds: [
          historyReferenceId,
          ...entry.supportingSources.map((source) =>
            getSourceReferenceId(source, sourceReferenceIdBySourceId)
          ),
        ],
        state: entry.state,
        stateLabel: handoffHistoryStateLabels[entry.state],
        text: hasRestrictedEvidence
          ? "Restricted handoff history."
          : entry.purpose,
        updatedAt: hasRestrictedEvidence ? undefined : entry.occurredAt,
        updatedBy: hasRestrictedEvidence ? undefined : entry.actorId,
      };
    }),
  ];
  const eligibilityGap: KickoffReadinessGap[] = isHandoffKickoffPrepEligible(artifact)
    ? []
    : [
        {
          id: `${artifact.handoffId}-kickoff-eligibility`,
          label: "Kickoff eligibility",
          nextAction: "Mark the handoff ready for review or accept it before kickoff preparation.",
          ownerRoute: artifact.responsibleOwner,
          referenceIds: [artifact.handoffId],
          reason: "The handoff is not accepted or ready for kickoff preparation.",
          sourceRoute: "Digital Handoff Artifact status",
          state: "not_ready",
          stateLabel: "Not ready",
        },
      ];
  const reviewGaps = review.gaps.map((gap) => {
    const hasRestrictedEvidence = hasRestrictedSource(gap.evidence) &&
      !canViewRestricted;

    return {
      id: `${artifact.handoffId}-${gap.area}-kickoff-gap`,
      label: gap.label,
      nextAction: hasRestrictedEvidence
        ? "Ask an authorized handoff owner to resolve restricted kickoff readiness context."
        : gap.requiredUpdate ??
          `Ask ${gap.ownerRoute} to resolve ${gap.label.toLowerCase()}.`,
      ownerRoute: hasRestrictedEvidence ? "Restricted owner" : gap.ownerRoute,
      referenceIds: [
        artifact.handoffId,
        ...gap.evidence.map((source) =>
          getSourceReferenceId(source, sourceReferenceIdBySourceId)
        ),
      ],
      reason: hasRestrictedEvidence
        ? "Restricted source-backed handoff context needs authorized review."
        : gap.reason,
      sourceRoute: hasRestrictedEvidence
        ? "Restricted source"
        : gap.sourceRoute ?? "No source route available",
      state: gap.state,
      stateLabel: handoffReviewStateLabels[gap.state],
    };
  });
  const clarificationGaps = artifact.clarificationRequests
    .filter((request) => request.status === "open")
    .map((request) => {
      const evidence = getEvidenceForArea(artifact, request.area);
      const hasRestrictedEvidence = hasRestrictedSource(evidence) &&
        !canViewRestricted;

      return {
        id: `${request.clarificationId}-kickoff-gap`,
        label: `${handoffReviewAreaLabels[request.area]} clarification`,
        nextAction: hasRestrictedEvidence
          ? "Ask an authorized handoff owner to respond to the restricted clarification."
          : `Respond to clarification request from ${request.requestedBy}.`,
        ownerRoute: hasRestrictedEvidence ? "Restricted owner" : request.owner,
        referenceIds: [
          artifact.handoffId,
          ...evidence.map((source) =>
            getSourceReferenceId(source, sourceReferenceIdBySourceId)
          ),
        ],
        reason: hasRestrictedEvidence
          ? "Restricted handoff clarification."
          : request.question,
        sourceRoute: hasRestrictedEvidence
          ? "Restricted source"
          : request.sourceRoute ?? "No source route available",
        state: "needs_clarification" as const,
        stateLabel: handoffReviewStateLabels.needs_clarification,
      };
    });
  const gaps = collectUniqueGaps([
    ...eligibilityGap,
    ...reviewGaps,
    ...clarificationGaps,
  ]);
  const decisionHistory = getHandoffKickoffReadinessDecisions(artifact).map((
    decision,
    index,
  ) =>
    buildDecisionFact(
      artifact,
      decision,
      index,
      auditEvents,
      canViewRestricted,
    ),
  );

  return {
    decisionHistory,
    eligible: isHandoffKickoffPrepEligible(artifact),
    freshnessLabel: getFreshnessLabel(artifact, auditEvents),
    gaps,
    nextActions: buildNextActions(artifact, gaps, decisionHistory),
    references,
    sections,
    summary: gaps.length > 0
      ? `${gaps.length} kickoff readiness gap(s) need follow-up before kickoff.`
      : "Kickoff readiness summary is clear from the reusable handoff artifact.",
    title: isHandoffKickoffPrepEligible(artifact)
      ? "Kickoff readiness summary"
      : "Kickoff readiness is not yet available",
  };
}

function buildSectionSummary(
  artifact: HandoffArtifact,
  sectionKey: HandoffSectionKey,
  canViewRestricted: boolean,
  sourceReferenceIdBySourceId: Map<string, string>,
): KickoffReadinessSummarySection {
  const section = artifact.structuredContent[sectionKey];
  const hasRestrictedEvidence = hasRestrictedSource(section.supportingSources) &&
    !canViewRestricted;

  return {
    id: `${artifact.handoffId}-${sectionKey}-kickoff-section`,
    label: handoffSectionLabels[sectionKey],
    referenceIds: [
      artifact.handoffId,
      ...section.supportingSources.map((source) =>
        getSourceReferenceId(source, sourceReferenceIdBySourceId)
      ),
    ],
    state: section.state,
    stateLabel: handoffHistoryStateLabels[section.state],
    text: hasRestrictedEvidence
      ? "Restricted handoff content."
      : section.text || "Missing section content.",
    updatedAt: hasRestrictedEvidence
      ? undefined
      : section.updatedAt ?? artifact.updatedAt,
    updatedBy: hasRestrictedEvidence
      ? undefined
      : section.updatedBy ?? artifact.responsibleOwner,
  };
}

function buildReferences(
  artifact: HandoffArtifact,
  auditEvents: HandoffAuditEvent[],
  canViewRestricted: boolean,
  sourceReferenceIdBySourceId: Map<string, string>,
): KickoffReadinessReference[] {
  const sourceReferences = collectArtifactSources(artifact).map((source) =>
    sourceToReference(source, canViewRestricted, sourceReferenceIdBySourceId)
  );
  const historyReferences = artifact.history.map((entry, index) => {
    const hasRestrictedEvidence = hasRestrictedSource(entry.supportingSources) &&
      !canViewRestricted;

    return {
      accessState: hasRestrictedEvidence
        ? "restricted" as const
        : "authorized" as const,
      freshnessLabel: hasRestrictedEvidence
        ? "Freshness: restricted"
        : `Freshness: handoff history ${entry.occurredAt}`,
      id: hasRestrictedEvidence
        ? `restricted-history-${index + 1}`
        : entry.historyId,
      sourceType: "Handoff history event",
      title: hasRestrictedEvidence
        ? "Restricted handoff history"
        : "Handoff history event",
    };
  });
  const auditReferences = auditEvents
    .filter((event) => event.handoffId === artifact.handoffId)
    .map((event) => ({
      accessState: "authorized" as const,
      freshnessLabel: `Freshness: audit event ${event.occurredAt}`,
      id: event.eventId,
      sourceType: "Handoff audit event",
      title: event.eventType,
    }));

  return collectUniqueReferences([
    {
      accessState: "authorized",
      freshnessLabel: `Freshness: handoff updated ${artifact.updatedAt}`,
      href: "/handoff",
      id: artifact.handoffId,
      sourceType: "Digital handoff artifact",
      title: "Digital Handoff Artifact",
    },
    ...sourceReferences,
    ...historyReferences,
    ...auditReferences,
  ]);
}

function sourceToReference(
  source: HandoffSupportingSource,
  canViewRestricted: boolean,
  sourceReferenceIdBySourceId: Map<string, string>,
): KickoffReadinessReference {
  const isRestricted = isSourceRestricted(source) && !canViewRestricted;

  return {
    accessState: isRestricted ? "restricted" : "authorized",
    freshnessLabel: isRestricted
      ? "Freshness: restricted"
      : source.freshnessState
      ? `Freshness: ${source.freshnessState}`
      : "Freshness: not provided",
    href: isRestricted ? undefined : `/sources#${slugifySourceId(source.sourceId)}`,
    id: getSourceReferenceId(source, sourceReferenceIdBySourceId),
    sourceType: isRestricted
      ? "Restricted source"
      : source.provenanceLabel || "Handoff source",
    title: isRestricted ? "Restricted handoff source" : source.title,
  };
}

function buildDecisionFact(
  artifact: HandoffArtifact,
  decision: HandoffKickoffReadinessDecision,
  index: number,
  auditEvents: HandoffAuditEvent[],
  canViewRestricted: boolean,
): KickoffReadinessDecisionFact {
  const evidence = getEvidenceForArea(artifact, decision.area);
  const hasRestrictedEvidence = hasRestrictedSource(evidence) &&
    !canViewRestricted;
  const auditReference = auditEvents.find((event) =>
    event.correlationId === decision.correlationId
  );

  return {
    ...decision,
    actorId: hasRestrictedEvidence ? "Restricted actor" : decision.actorId,
    areaLabel: handoffReviewAreaLabels[decision.area],
    correlationId: decision.correlationId ||
      `${artifact.handoffId}-kickoff-decision-${index + 1}`,
    handoffId: decision.handoffId ?? artifact.handoffId,
    launchId: decision.launchId ?? artifact.launchId,
    note: hasRestrictedEvidence
      ? "Restricted readiness decision details."
      : decision.note,
    occurredAt: hasRestrictedEvidence ? "Restricted" : decision.occurredAt,
    ownerRoute: hasRestrictedEvidence
      ? "Restricted owner"
      : decision.ownerRoute,
    referenceIds: [
      artifact.handoffId,
      ...(auditReference ? [auditReference.eventId] : []),
    ],
    sourceRoute: hasRestrictedEvidence
      ? "Restricted source"
      : decision.sourceRoute,
    stateLabel: handoffKickoffReadinessStateLabels[decision.state],
    workstreamId: decision.workstreamId ?? artifact.workstreamId,
  };
}

function buildNextActions(
  artifact: HandoffArtifact,
  gaps: KickoffReadinessGap[],
  decisionHistory: KickoffReadinessDecisionFact[],
) {
  if (gaps.length > 0) {
    const hasRestrictedGap = gaps.some((gap) =>
      gap.ownerRoute === "Restricted owner" || gap.sourceRoute === "Restricted source"
    );

    return [
      {
        id: "resolve-kickoff-gaps",
        label: hasRestrictedGap
          ? "Ask an authorized handoff owner to resolve kickoff readiness gaps."
          : `Ask ${artifact.responsibleOwner} to resolve kickoff readiness gaps.`,
        href: "/handoff",
      },
      {
        id: "review-kickoff-sources",
        label: "Review linked source records for stale, missing, or conflicting context.",
        href: "/sources",
      },
    ];
  }

  if (decisionHistory.length === 0) {
    return [
      {
        id: "record-kickoff-readiness",
        label: "Record kickoff readiness decisions for the receiving team.",
        href: "/handoff",
      },
    ];
  }

  return [
    {
      id: "open-kickoff-handoff",
      label: "Open the accepted handoff artifact for kickoff.",
      href: "/handoff",
    },
  ];
}

function getFreshnessLabel(
  artifact: HandoffArtifact,
  auditEvents: HandoffAuditEvent[],
) {
  const matchingEvents = auditEvents
    .filter((event) => event.handoffId === artifact.handoffId)
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt));

  return matchingEvents.length > 0
    ? `Freshness: latest handoff audit event ${matchingEvents.at(-1)?.occurredAt}`
    : `Freshness: handoff updated ${artifact.updatedAt}`;
}

function collectUniqueSources(sources: HandoffSupportingSource[]) {
  const sourceById = new Map<string, HandoffSupportingSource>();

  for (const source of sources) {
    sourceById.set(source.sourceId, source);
  }

  return [...sourceById.values()];
}

function collectUniqueReferences(references: KickoffReadinessReference[]) {
  const referenceById = new Map<string, KickoffReadinessReference>();

  for (const reference of references) {
    referenceById.set(reference.id, reference);
  }

  return [...referenceById.values()];
}

function collectUniqueGaps(gaps: KickoffReadinessGap[]) {
  const gapById = new Map<string, KickoffReadinessGap>();

  for (const gap of gaps) {
    gapById.set(gap.id, gap);
  }

  return [...gapById.values()];
}

function collectArtifactSources(artifact: HandoffArtifact) {
  return collectUniqueSources([
    ...artifact.supportingSources,
    ...handoffSectionOrder.flatMap(
      (sectionKey) => artifact.structuredContent[sectionKey].supportingSources,
    ),
    ...artifact.history.flatMap((entry) => entry.supportingSources),
  ]);
}

function buildSourceReferenceIdBySourceId(
  sources: HandoffSupportingSource[],
  canViewRestricted: boolean,
) {
  const referenceIdBySourceId = new Map<string, string>();
  let restrictedSourceIndex = 1;

  for (const source of sources) {
    if (referenceIdBySourceId.has(source.sourceId)) {
      continue;
    }

    referenceIdBySourceId.set(
      source.sourceId,
      isSourceRestricted(source) && !canViewRestricted
        ? `restricted-source-${restrictedSourceIndex++}`
        : source.sourceId,
    );
  }

  return referenceIdBySourceId;
}

function getSourceReferenceId(
  source: HandoffSupportingSource,
  sourceReferenceIdBySourceId: Map<string, string>,
) {
  return sourceReferenceIdBySourceId.get(source.sourceId) ?? source.sourceId;
}

function getEvidenceForArea(
  artifact: HandoffArtifact,
  area: HandoffReviewArea,
) {
  if (area === "supportingSources") {
    return collectArtifactSources(artifact);
  }

  if (area === "kickoffContext") {
    return artifact.supportingSources;
  }

  return artifact.structuredContent[area].supportingSources;
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

function slugifySourceId(sourceId: string) {
  return sourceId.replace(/^src-/, "");
}
