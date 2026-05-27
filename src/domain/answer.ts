import {
  approvalStateLabels,
  createPrototypeSourceRecords,
  defaultSourceLedgerFilters,
  filterSourceLedgerResults,
  filterVisibleSourceRecords,
  freshnessStateLabels,
  hasTrainingImpactSearchIntent,
  isSourceApprovedForTrainingUse,
  isRestrictedSource,
  sourceSystemLabels,
  sourceTrainingImpactMatchesQuery,
  sourceTypeLabels,
  type SourceApprovalState,
  type SourceLedgerRecord,
  type SourceLedgerSystem,
} from "./source-ledger";
import type { WorkspaceRole } from "./workspace";

export type SourceBackedAnswerState =
  | "answered"
  | "no_reliable_source"
  | "source_stale"
  | "access_restricted"
  | "partial_confidence"
  | "missing_information"
  | "connector_unavailable";

export type AnswerConfidence = "high" | "medium" | "low" | "none";

export type SourceAccessState = "authorized" | "restricted";

export type SourceSystem = (typeof sourceSystemLabels)[SourceLedgerSystem];

export type SourceCitation = {
  id: string;
  marker: string;
  title: string;
  system: SourceSystem;
  href?: string;
  freshnessLabel: string;
  accessState: SourceAccessState;
  sourceType: string;
  approvalState?: SourceApprovalState;
  owner?: string;
};

export type RetrievedFact = {
  id: string;
  text: string;
  citationId?: string;
};

export type GeneratedDraft = {
  id: string;
  omittedTopics?: string[];
  reviewActionLabel?: string;
  text: string;
  reviewLabel: string;
};

export type AnswerNextAction = {
  id: string;
  label: string;
  href: string;
};

export type SourceBackedAnswer = {
  id: string;
  state: SourceBackedAnswerState;
  title: string;
  summary: string;
  confidence: AnswerConfidence;
  freshnessLabel: string;
  citations: SourceCitation[];
  retrievedFacts: RetrievedFact[];
  generatedDraft?: GeneratedDraft;
  nextActions: AnswerNextAction[];
  sourceGap?: string;
};

export const answerStateLabels: Record<SourceBackedAnswerState, string> = {
  answered: "Answered",
  no_reliable_source: "No reliable source",
  source_stale: "Source stale",
  access_restricted: "Access restricted",
  partial_confidence: "Partial confidence",
  missing_information: "Missing information",
  connector_unavailable: "Connector unavailable",
};

const approvedLaunchPlanCitation: SourceCitation = {
  id: "cardiomax-launch-plan",
  marker: "1",
  title: "CARDIOMAX Launch Plan",
  system: "SharePoint",
  href: "/sources#cardiomax-launch-plan",
  freshnessLabel: "Freshness: refreshed 2 hours ago",
  accessState: "authorized",
  sourceType: "Launch plan",
};

const smartsheetCitation: SourceCitation = {
  id: "cardiomax-smartsheet-status",
  marker: "2",
  title: "CARDIOMAX Smartsheet Status",
  system: "Smartsheet",
  href: "/sources#cardiomax-smartsheet-status",
  freshnessLabel: "Freshness: refreshed 45 minutes ago",
  accessState: "authorized",
  sourceType: "Project status",
};

type ApprovedTrainingContentEntry = {
  citation: SourceCitation;
  fact: RetrievedFact;
  keywords: string[];
};

type TrainingSummaryDraftEntry = ApprovedTrainingContentEntry & {
  draftText: string;
  topicAliases: string[];
};

const approvedTrainingContentCatalog: Record<
  string,
  {
    draftText: string;
    draftTopics: string[];
    factText: string;
    keywords: string[];
  }
> = {
  "src-cardiomax-approved-assets": {
    draftText:
      "Use CARDIOMAX Approved Asset Library as the reusable training source set for Learning Solutions materials.",
    draftTopics: [
      "asset",
      "assets",
      "asset library",
      "approved asset",
      "approved assets",
      "training asset",
      "training assets",
      "training source",
      "training sources",
    ],
    factText:
      "CARDIOMAX Approved Asset Library is approved for training use and owned by Learning Solutions.",
    keywords: [
      "asset",
      "assets",
      "asset library",
      "approved asset",
      "training asset",
      "training source",
      "training sources",
    ],
  },
  "src-cardiomax-approved-message-house": {
    draftText:
      "Position CARDIOMAX with the approved core narrative from CARDIOMAX Approved Message House.",
    draftTopics: [
      "core narrative",
      "message house",
      "messaging",
      "approved message",
      "approved messaging",
    ],
    factText:
      "CARDIOMAX Approved Message House contains approved messaging for training-safe core narrative.",
    keywords: [
      "core narrative",
      "message house",
      "messaging",
      "approved message",
      "approved messaging",
    ],
  },
  "src-cardiomax-approved-clinical-claims": {
    draftText:
      "Use CARDIOMAX Approved Clinical Claim Set for clinical claim language in training materials.",
    draftTopics: [
      "claim",
      "claims",
      "claim language",
      "clinical claim",
      "clinical claims",
    ],
    factText:
      "CARDIOMAX Approved Clinical Claim Set contains approved claim language for training materials.",
    keywords: [
      "claim",
      "claims",
      "claim language",
      "clinical claim",
      "clinical claims",
    ],
  },
  "src-cardiomax-value-proposition-brief": {
    draftText:
      "Anchor value messaging in CARDIOMAX Value Proposition Brief for the training build.",
    draftTopics: [
      "value prop",
      "value proposition",
      "value propositions",
      "positioning",
      "proposition",
    ],
    factText:
      "CARDIOMAX Value Proposition Brief contains the current approved value proposition for the training build.",
    keywords: [
      "value prop",
      "value proposition",
      "value propositions",
      "positioning",
      "proposition",
    ],
  },
};

function hasWord(question: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(question);
}

function isContextualFollowUp(question: string) {
  return /^(what about (it|this|that|them|those|the owner|the owners|the deadline|the deadlines|the risk|the risks|the asset|the assets)|that one|this one)\??$/i.test(
    question.trim(),
  );
}

function isSupportedAnsweredQuestion(question: string) {
  return /\b(owner|owners|owns|handoff|handoffs|commitment|commitments|deadline|deadlines|asset|assets|risk|risks|blocker|blockers|kickoff|readiness|deployment)\b/i.test(
    question,
  );
}

export function isApprovedTrainingContentQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  if (previousQuestion && isContextualFollowUp(question)) {
    return isApprovedTrainingContentQuestion(previousQuestion);
  }

  const normalizedQuestion = normalizeApprovedContentQuestion(question);
  const hasContentTerm =
    /\b(message house|messaging|claim|claims|value proposition|value propositions|approved asset|approved assets|training asset|training assets|asset library)\b/i.test(
      normalizedQuestion,
    );
  const hasApprovedTrainingIntent =
    /\b(approved|training|learning solutions|source|sources|content|for use)\b/i.test(
      normalizedQuestion,
    );

  return (
    /\b(approved content|training content|training source|training sources|approved source|approved sources)\b/i.test(
      normalizedQuestion,
    ) ||
    (hasContentTerm && hasApprovedTrainingIntent)
  );
}

export function isTrainingSummaryDraftQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  if (previousQuestion && isContextualFollowUp(question)) {
    return isTrainingSummaryDraftQuestion(previousQuestion);
  }

  const normalizedQuestion = normalizeApprovedContentQuestion(question);
  const hasDraftVerb =
    /\b(draft|create|generate|prepare|write)\b/i.test(normalizedQuestion);
  const hasTrainingSummaryObject =
    /\b(training summary|training summaries|learning solutions summary|training material summary|training materials summary)\b/i.test(
      normalizedQuestion,
    );
  const hasApprovedSourceScope =
    /\b(approved source|approved sources|approved content|source-backed content|sourced content|training content|learning solutions)\b/i.test(
      normalizedQuestion,
    );
  const hasSummarizeTrainingIntent =
    /\bsummarize\b/i.test(normalizedQuestion) &&
    /\b(approved content|approved source|approved sources|training content)\b/i.test(
      normalizedQuestion,
    ) &&
    /\btraining\b/i.test(normalizedQuestion);

  return (
    (hasDraftVerb && hasTrainingSummaryObject) ||
    (hasApprovedSourceScope && hasSummarizeTrainingIntent)
  );
}

function isMissingApprovedTrainingContentQuestion(question: string) {
  const normalizedQuestion = normalizeApprovedContentQuestion(question);

  return (
    /\b(draft|stale|superseded|inactive|unapproved|not approved)\b/i.test(
      normalizedQuestion,
    ) ||
    /\b(unavailable|missing|unknown|unsupported|nonexistent|not available|no approved)\b/i.test(
      normalizedQuestion,
    ) || hasUnsupportedSpecificApprovedContentRequest(normalizedQuestion)
  );
}

function getStateForQuestion(
  question: string,
  previousQuestion?: string | null,
): SourceBackedAnswerState {
  const normalized = question.toLowerCase();

  if (hasWord(normalized, "restricted")) {
    return "access_restricted";
  }

  if (hasWord(normalized, "stale")) {
    return "source_stale";
  }

  if (hasWord(normalized, "partial")) {
    return "partial_confidence";
  }

  if (hasWord(normalized, "missing")) {
    return "missing_information";
  }

  if (
    hasWord(normalized, "unavailable") ||
    /\bconnector\b.*\b(down|offline|unavailable)\b/i.test(normalized)
  ) {
    return "connector_unavailable";
  }

  if (hasWord(normalized, "unverified") || hasWord(normalized, "rumor")) {
    return "no_reliable_source";
  }

  if (previousQuestion && isContextualFollowUp(question)) {
    return getStateForQuestion(previousQuestion);
  }

  return isSupportedAnsweredQuestion(question) ? "answered" : "no_reliable_source";
}

export function buildPrototypeAnswer(
  question: string,
  launchName: string,
  previousQuestion?: string | null,
): SourceBackedAnswer {
  return createStatePrototypeAnswer(
    getStateForQuestion(question, previousQuestion),
    launchName,
    previousQuestion,
  );
}

export function buildApprovedTrainingContentAnswer(
  question: string,
  launchName: string,
  previousQuestion?: string | null,
): SourceBackedAnswer {
  const effectiveQuestion =
    previousQuestion && isContextualFollowUp(question) ? previousQuestion : question;

  if (hasWord(effectiveQuestion.toLowerCase(), "restricted")) {
    return createStatePrototypeAnswer("access_restricted", launchName);
  }

  if (isMissingApprovedTrainingContentQuestion(effectiveQuestion)) {
    return createMissingApprovedTrainingContentAnswer(launchName);
  }

  const selectedEntries = getApprovedTrainingContentEntriesForQuestion(
    effectiveQuestion,
  );

  if (selectedEntries.length === 0) {
    return createMissingApprovedTrainingContentAnswer(launchName);
  }

  const citations = selectedEntries.map((entry, index) => ({
    ...entry.citation,
    marker: String(index + 1),
  }));
  const retrievedFacts = selectedEntries.map((entry) => entry.fact);
  const primaryCitation = citations[0];

  return {
    id: `${launchName}-approved-training-content`,
    state: "answered",
    title: "Approved training content",
    summary:
      `For ${launchName}, LaunchPad found approved, authorized content that is safe for Learning Solutions discovery. ` +
      "It is source-backed only; no training draft was generated.",
    confidence: "high",
    freshnessLabel: "Freshness: refreshed 2026-05-26",
    citations,
    retrievedFacts,
    nextActions: [
      {
        id: `open-${primaryCitation.id}`,
        label: `Open ${primaryCitation.title}.`,
        href: primaryCitation.href ?? "/sources",
      },
      {
        id: "review-approved-content-filters",
        label: "Review approved content filters in Source Ledger.",
        href: "/sources",
      },
    ],
  };
}

export function buildTrainingSummaryDraftAnswer(
  question: string,
  launchName: string,
  previousQuestion?: string | null,
): SourceBackedAnswer {
  const effectiveQuestion =
    previousQuestion && isContextualFollowUp(question) ? previousQuestion : question;
  const normalizedQuestion = normalizeApprovedContentQuestion(effectiveQuestion);

  const { selectedEntries, unsupportedTopics } =
    getTrainingSummaryDraftEntriesForQuestion(normalizedQuestion);

  if (selectedEntries.length === 0) {
    return createMissingApprovedTrainingContentAnswer(
      launchName,
      unsupportedTopics[0] ?? getSpecificTrainingSummaryRequest(normalizedQuestion),
    );
  }

  const draftSignature = createTrainingSummaryDraftSignature(
    selectedEntries,
    unsupportedTopics,
  );
  const citations = selectedEntries.map((entry, index) => ({
    ...entry.citation,
    marker: String(index + 1),
  }));
  const retrievedFacts = selectedEntries.map((entry) => entry.fact);
  const draftBullets = selectedEntries.map((entry, index) => {
    const marker = citations[index].marker;

    return `- ${entry.draftText} [${marker}]`;
  });
  const sourceGap =
    unsupportedTopics.length > 0
      ? `Source gap: missing approved source for ${joinHumanList(
          unsupportedTopics,
        )}. Unsupported sections were omitted from the draft.`
      : undefined;

  return {
    id: `${launchName}-training-summary-draft-${draftSignature}`,
    state: sourceGap ? "missing_information" : "answered",
    title: "Training summary draft",
    summary:
      `For ${launchName}, LaunchPad drafted training summary language from approved, current, authorized sources only.` +
      (sourceGap ? " Unsupported sections are called out as source gaps." : ""),
    confidence: sourceGap ? "medium" : "high",
    freshnessLabel: "Freshness: refreshed 2026-05-26 from approved sources",
    citations,
    retrievedFacts,
    generatedDraft: {
      id: `${slugifyForId(launchName)}-training-summary-draft-${draftSignature}`,
      omittedTopics: unsupportedTopics,
      reviewActionLabel: "Save draft for review",
      text: `Draft training summary:\n${draftBullets.join("\n")}`,
      reviewLabel:
        "Draft language requires human review before approval or publishing.",
    },
    nextActions: [
      {
        id: "review-training-summary-draft",
        label: "Review the draft with Learning Solutions.",
        href: "#agent-question",
      },
      {
        id: "open-approved-training-sources",
        label: "Open approved training sources.",
        href: "/sources",
      },
    ],
    sourceGap,
  };
}

export function isTrainingImpactQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  if (previousQuestion && isContextualFollowUp(question)) {
    return isTrainingImpactQuestion(previousQuestion);
  }

  return hasTrainingImpactSearchIntent(question);
}

export function buildTrainingImpactAnswer(
  question: string,
  launchName: string,
  previousQuestion?: string | null,
  role: WorkspaceRole = "project-manager",
): SourceBackedAnswer {
  const effectiveQuestion =
    previousQuestion && isContextualFollowUp(question) ? previousQuestion : question;
  const records = createPrototypeSourceRecords();
  const queryVariantHash = createStableHash(effectiveQuestion);
  const rawMatches = records.filter((source) =>
    sourceTrainingImpactMatchesQuery(source, effectiveQuestion),
  );
  const restrictedRawMatches = rawMatches.filter(isRestrictedSource);
  const visibleSources = filterVisibleSourceRecords(records, role);
  const visibleImpactResults = filterSourceLedgerResults(
    visibleSources,
    {
      ...defaultSourceLedgerFilters,
      launchOrWorkstream: launchName,
      query: effectiveQuestion,
    },
    {
      isAdmin: role === "admin",
    },
  ).filter((source) => source.trainingImpact);

  if (
    rawMatches.length > 0 &&
    visibleImpactResults.length === 0 &&
    restrictedRawMatches.length === rawMatches.length
  ) {
    return createRestrictedTrainingImpactAnswer(launchName, queryVariantHash);
  }

  if (visibleImpactResults.length === 0) {
    return createMissingTrainingImpactAnswer(launchName, queryVariantHash);
  }

  const recordsById = new Map(records.map((source) => [source.sourceId, source]));
  const citedSources = getTrainingImpactCitationSources(
    visibleImpactResults,
    recordsById,
  );
  const citations = citedSources.map((source, index) => ({
    ...createCitationFromSourceRecord(source),
    marker: String(index + 1),
  }));
  const retrievedFacts = getTrainingImpactRetrievedFacts(
    visibleImpactResults,
  );
  const unreliableResults = visibleImpactResults.filter(
    (source) => !isReliableTrainingImpactResult(source),
  );
  const state: SourceBackedAnswerState = unreliableResults.length === 0
    ? "answered"
    : unreliableResults.every(
          (source) =>
            (source.freshnessState === "stale" ||
              source.ingestionStatus === "stale") &&
            source.ingestionStatus !== "incomplete" &&
            source.approvalState !== "draft",
        )
      ? "source_stale"
      : "missing_information";
  const sourceGap =
    unreliableResults.length === 0
      ? undefined
      : "Source gap: impacted assets were found, but at least one matching source is stale, incomplete, inaccessible, or not approved for use.";
  const primaryCitation = citations[0];
  const hasApprovedReplacement = visibleImpactResults.some(
    (source) => source.trainingImpact?.approvedReplacement,
  );

  return {
    id: `${launchName}-training-impact-${createStableHash(
      [
        queryVariantHash,
        ...visibleImpactResults.map((source) => source.sourceKey).sort(),
      ].join("|"),
    )}`,
    state,
    title: "Impacted training assets",
    summary:
      `For ${launchName}, LaunchPad found training assets with matching changed content. ` +
      (hasApprovedReplacement
        ? "Affected assets and approved replacement sources are cited separately."
        : "Affected assets are cited; no approved replacement source is available for every match."),
    confidence: state === "answered" ? "high" : "medium",
    freshnessLabel: getTrainingImpactFreshnessLabel(visibleImpactResults),
    citations,
    retrievedFacts,
    nextActions: [
      {
        id: "open-impacted-training-asset",
        label: primaryCitation
          ? `Open ${primaryCitation.title}.`
          : "Open Source Ledger.",
        href: primaryCitation?.href ?? "/sources",
      },
      {
        id: "review-training-impact-ledger",
        label: "Review impacted assets in Source Ledger.",
        href: "/sources",
      },
    ],
    sourceGap,
  };
}

function createMissingTrainingImpactAnswer(
  launchName: string,
  queryVariantHash: string,
): SourceBackedAnswer {
  return {
    id: `${launchName}-training-impact-no-match-${queryVariantHash}`,
    state: "no_reliable_source",
    title: "No impacted training assets found",
    summary:
      "LaunchPad did not find matching ingested training assets for that changed-content request.",
    confidence: "none",
    freshnessLabel: "Freshness: no matching impacted assets found",
    citations: [],
    retrievedFacts: [],
    sourceGap:
      "Source gap: no matching ingested training assets were found. Results may be incomplete if sources are missing, stale, restricted, inaccessible, or not yet ingested.",
    nextActions: [
      {
        id: "check-training-impact-ledger",
        label: "Check Source Ledger for training asset ingestion gaps.",
        href: "/sources",
      },
      {
        id: "ask-learning-solutions-to-ingest-assets",
        label: "Ask Learning Solutions to attach current training assets.",
        href: "/sources",
      },
    ],
  };
}

function createRestrictedTrainingImpactAnswer(
  launchName: string,
  queryVariantHash: string,
): SourceBackedAnswer {
  return {
    id: `${launchName}-training-impact-access-restricted-${queryVariantHash}`,
    state: "access_restricted",
    title: "Access restricted",
    summary:
      "A matching impacted training asset exists, but your current role cannot view its details.",
    confidence: "low",
    freshnessLabel: "Freshness: hidden because access is restricted",
    citations: [
      {
        accessState: "restricted",
        freshnessLabel: "Freshness: restricted",
        id: "restricted-training-impact",
        marker: "1",
        sourceType: "Restricted training asset",
        system: "Asset",
        title: "Restricted training asset",
      },
    ],
    retrievedFacts: [],
    sourceGap:
      "Source gap: request access or ask an authorized owner to confirm affected training assets.",
    nextActions: [
      {
        id: "request-training-impact-access",
        label: "Request access to the restricted training asset.",
        href: "/sources",
      },
      {
        id: "ask-authorized-owner-training-impact",
        label: "Ask an authorized owner for a non-restricted summary.",
        href: "/sources",
      },
    ],
  };
}

function isReliableTrainingImpactResult(
  source: ReturnType<typeof filterSourceLedgerResults>[number],
) {
  return (
    source.accessState === "authorized" &&
    source.approvalState === "approved" &&
    source.ingestionStatus === "complete" &&
    source.freshnessState !== "stale" &&
    source.sourceLinkHealth === "healthy"
  );
}

function getTrainingImpactCitationSources(
  visibleImpactResults: ReturnType<typeof filterSourceLedgerResults>,
  recordsById: Map<string, SourceLedgerRecord>,
) {
  const sources: SourceLedgerRecord[] = [];

  for (const result of visibleImpactResults) {
    const impactedSource = result.displaySourceId
      ? recordsById.get(result.displaySourceId)
      : undefined;
    const replacementSourceId = result.trainingImpact?.approvedReplacement?.sourceId;
    const replacementSource = replacementSourceId
      ? recordsById.get(replacementSourceId)
      : undefined;

    for (const source of [impactedSource, replacementSource]) {
      if (
        source &&
        !sources.some((candidate) => candidate.sourceId === source.sourceId)
      ) {
        sources.push(source);
      }
    }
  }

  return sources;
}

function getTrainingImpactRetrievedFacts(
  visibleImpactResults: ReturnType<typeof filterSourceLedgerResults>,
): RetrievedFact[] {
  const facts: RetrievedFact[] = [];

  for (const result of visibleImpactResults) {
    const impact = result.trainingImpact;

    if (!impact || !result.displaySourceId) {
      continue;
    }

    facts.push({
      citationId: result.displaySourceId,
      id: `${result.sourceKey}-impact-location`,
      text:
        `${result.displayName} contains ${impact.changedContentTypeLabel.toLowerCase()} ` +
        `in ${impact.displayMatchLocation}. Approval: ${approvalStateLabels[result.approvalState]}; freshness: ${freshnessStateLabels[result.freshnessState]}.`,
    });

    if (impact.approvedReplacement) {
      facts.push({
        citationId: impact.approvedReplacement.sourceId,
        id: `${result.sourceKey}-approved-replacement`,
        text:
          `${impact.approvedReplacement.title} is the approved replacement source for ${impact.displayChangedContent}.`,
      });
    }

    if (
      result.approvalState !== "approved" ||
      result.ingestionStatus !== "complete" ||
      result.freshnessState === "stale"
    ) {
      facts.push({
        id: `${result.sourceKey}-impact-gap`,
        text:
          `${result.displayName} needs verification before reuse because its approval, freshness, or ingestion state is not fully reliable.`,
      });
    }
  }

  return facts.filter((fact, index, allFacts) =>
    allFacts.findIndex((candidate) => candidate.id === fact.id) === index,
  );
}

function getTrainingImpactFreshnessLabel(
  visibleImpactResults: ReturnType<typeof filterSourceLedgerResults>,
) {
  const latestRefresh = visibleImpactResults
    .map((source) => source.lastRefreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return latestRefresh
    ? `Freshness: latest impacted asset refreshed ${latestRefresh}`
    : "Freshness: impacted asset freshness requires source review";
}

function createMissingApprovedTrainingContentAnswer(
  launchName: string,
  requestedContent?: string,
): SourceBackedAnswer {
  const requestedContentLabel = requestedContent?.trim();

  return {
    id: `${launchName}-missing-approved-training-content`,
    state: "no_reliable_source",
    title: "Missing approved source",
    summary:
      "LaunchPad did not find approved, accessible training content for that request.",
    confidence: "none",
    freshnessLabel: "Freshness: no approved source available",
    citations: [],
    retrievedFacts: [],
    sourceGap: requestedContentLabel
      ? `Source gap: missing approved source for ${requestedContentLabel}.`
      : "Source gap: missing approved source for the requested training content.",
    nextActions: [
      {
        id: "ask-learning-solutions-owner",
        label: "Ask Learning Solutions to attach or approve a current source.",
        href: "/sources",
      },
      {
        id: "check-approved-content-ledger",
        label: "Check Source Ledger for approved content ingestion gaps.",
        href: "/sources",
      },
    ],
  };
}

function getTrainingSummaryDraftEntriesForQuestion(
  normalizedQuestion: string,
): {
  selectedEntries: TrainingSummaryDraftEntry[];
  unsupportedTopics: string[];
} {
  const approvedTrainingContentEntries = getApprovedTrainingContentEntries().map(
    (entry): TrainingSummaryDraftEntry => ({
      ...entry,
      draftText:
        approvedTrainingContentCatalog[entry.citation.id]?.draftText ??
        `${entry.citation.title} supports the training summary.`,
      topicAliases:
        approvedTrainingContentCatalog[entry.citation.id]?.draftTopics ??
        entry.keywords,
    }),
  );
  const requestedTopics = getRequestedTrainingSummaryTopics(normalizedQuestion);

  if (requestedTopics.length === 0) {
    return {
      selectedEntries: approvedTrainingContentEntries,
      unsupportedTopics: [],
    };
  }

  const selectedEntries: TrainingSummaryDraftEntry[] = [];
  const unsupportedTopics: string[] = [];

  for (const topic of requestedTopics) {
    const { matchedEntries, unsupportedTopic } =
      getTrainingSummaryTopicMatch(topic, approvedTrainingContentEntries);

    if (matchedEntries.length === 0) {
      unsupportedTopics.push(unsupportedTopic ?? topic);
      continue;
    }

    for (const matchedEntry of matchedEntries) {
      if (
        !selectedEntries.some(
          (entry) => entry.citation.id === matchedEntry.citation.id,
        )
      ) {
        selectedEntries.push(matchedEntry);
      }
    }

    if (unsupportedTopic) {
      unsupportedTopics.push(unsupportedTopic);
    }
  }

  return {
    selectedEntries,
    unsupportedTopics: getUniqueValues(unsupportedTopics),
  };
}

function getTrainingSummaryTopicMatch(
  topic: string,
  entries: TrainingSummaryDraftEntry[],
) {
  if (isIneligibleTrainingSummaryTopic(topic)) {
    return { matchedEntries: [], unsupportedTopic: topic };
  }

  const matches = entries
    .map((entry) => ({
      entry,
      matchedAliases: entry.topicAliases
        .map(normalizeTrainingSummaryTopic)
        .filter((alias) => topicMatchesAlias(topic, alias)),
    }))
    .filter(({ matchedAliases }) => matchedAliases.length > 0);
  const unsupportedRemainder = getUnsupportedTopicRemainder(
    topic,
    matches.flatMap(({ matchedAliases }) => matchedAliases),
  );

  if (unsupportedRemainder) {
    return {
      matchedEntries: [],
      unsupportedTopic: unsupportedRemainder,
    };
  }

  return {
    matchedEntries: matches.map(({ entry }) => entry),
    unsupportedTopic: undefined,
  };
}

function isIneligibleTrainingSummaryTopic(topic: string) {
  if (/\bnot approved\b/i.test(topic)) {
    return true;
  }

  if (
    /\b(?:exclude|excluding|without|avoid|omitting)\s+(?:stale|superseded|inactive|unapproved|draft|restricted)\b/i.test(
      topic,
    )
  ) {
    return false;
  }

  return /\b(stale|superseded|inactive|unapproved|draft|restricted)\b/i.test(
    topic,
  );
}

function getRequestedTrainingSummaryTopics(normalizedQuestion: string) {
  const specificRequest = getSpecificTrainingSummaryRequest(normalizedQuestion);

  if (!specificRequest) {
    return [];
  }

  return specificRequest
    .split(/\s+(?:and|plus|with|including|include|as well as)\s+|[,;]/)
    .map(normalizeTrainingSummaryTopic)
    .filter((topic) => topic && !isGenericTrainingSummaryTopic(topic));
}

function getSpecificTrainingSummaryRequest(normalizedQuestion: string) {
  const preposedTopicMatch = [
    /\b(?:draft|create|generate|prepare|write)\s+(?:a|an)\s+(.+?)\s+training summary\b/,
    /\b(?:draft|create|generate|prepare|write)\s+(.+?)\s+training summary\b/,
  ]
    .map((pattern) => normalizedQuestion.match(pattern))
    .find((result): result is RegExpMatchArray => Boolean(result));

  if (preposedTopicMatch?.[1]) {
    const preposedTopic = preposedTopicMatch[1]
      .replace(/[?.!]+$/g, "")
      .trim();

    if (
      !/^(a|an|the)$/.test(preposedTopic) &&
      !isGenericTrainingSummaryTopic(normalizeTrainingSummaryTopic(preposedTopic))
    ) {
      return preposedTopic;
    }
  }

  const match = [
    /\bcovering\s+(.+)$/,
    /\bwith\s+(.+)$/,
    /\bincluding\s+(.+)$/,
    /\binclude\s+(.+)$/,
    /\bregarding\s+(.+)$/,
    /\brelated to\s+(.+)$/,
    /\babout\s+(.+)$/,
    /\bon\s+(.+)$/,
    /\bfrom\s+(.+)$/,
    /\bfor\s+(.+)$/,
  ]
    .map((pattern) => normalizedQuestion.match(pattern))
    .find((result): result is RegExpMatchArray => Boolean(result));

  return match?.[1]?.replace(/[?.!]+$/g, "").trim() ?? "";
}

function normalizeTrainingSummaryTopic(value: string) {
  return value
    .replace(/\bnot\s+approved\b/g, "not_approved")
    .replace(/\b(approved|current|source-backed|sourced)\b/g, " ")
    .replace(/\bnot_approved\b/g, "not approved")
    .replace(/\b(for|from|using)\s+(learning solutions|training)\b/g, " ")
    .replace(/\b(for|from|using)\b/g, " ")
    .replace(/\b(summary|summaries|material|materials|content|source|sources)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTrainingSummaryTopic(value: string) {
  return /^(source|sources|content|training content|training|learning solutions|learning solutions summary|training summary|training summaries|training material|training materials|material|materials)$/.test(
    value,
  );
}

function topicMatchesAlias(topic: string, alias: string) {
  if (!alias || isGenericTrainingSummaryTopic(alias)) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(topic);
}

function getUnsupportedTopicRemainder(topic: string, matchedAliases: string[]) {
  if (matchedAliases.length === 0) {
    return undefined;
  }

  const remainingTopic = matchedAliases
    .sort((left, right) => right.length - left.length)
    .reduce(
      (current, alias) =>
        current.replace(new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi"), " "),
      topic,
    );
  const normalizedRemainder = normalizeTrainingSummaryTopic(remainingTopic);

  return normalizedRemainder &&
    !isGenericTrainingSummaryTopic(normalizedRemainder)
    ? normalizedRemainder
    : undefined;
}

function getApprovedTrainingContentEntriesForQuestion(question: string) {
  const normalizedQuestion = normalizeApprovedContentQuestion(question);
  const approvedTrainingContentEntries = getApprovedTrainingContentEntries();
  const specificMatches = approvedTrainingContentEntries.filter((entry) =>
    entry.keywords.some((keyword) =>
      normalizedQuestion.includes(normalizeApprovedContentQuestion(keyword)),
    ),
  );

  if (specificMatches.length > 0) {
    return specificMatches;
  }

  if (isGeneralApprovedTrainingContentQuestion(normalizedQuestion)) {
    return approvedTrainingContentEntries;
  }

  return [];
}

function isGeneralApprovedTrainingContentQuestion(normalizedQuestion: string) {
  return (
    /\b(approved content|approved training content|training content|approved source|approved sources)\b/i.test(
      normalizedQuestion,
    ) && !hasUnsupportedSpecificApprovedContentRequest(normalizedQuestion)
  );
}

function hasUnsupportedSpecificApprovedContentRequest(
  normalizedQuestion: string,
) {
  const specificRequest = getSpecificApprovedContentRequest(normalizedQuestion);
  const approvedTrainingContentEntries = getApprovedTrainingContentEntries();

  if (!specificRequest || isGenericTrainingScope(specificRequest)) {
    return false;
  }

  return !approvedTrainingContentEntries.some((entry) =>
    entry.keywords.some((keyword) =>
      specificRequest.includes(normalizeApprovedContentQuestion(keyword)),
    ),
  );
}

function getSpecificApprovedContentRequest(normalizedQuestion: string) {
  const match = [
    /\bfor use in\s+(.+)$/,
    /\b(?:for|about|regarding|related to|covering|on)\s+(.+)$/,
    /[:\-]\s*(.+)$/,
  ]
    .map((pattern) => normalizedQuestion.match(pattern))
    .find((result): result is RegExpMatchArray => Boolean(result));

  return match?.[1]?.replace(/[?.!]+$/g, "").trim() ?? "";
}

function isGenericTrainingScope(value: string) {
  return /^(training|training use|learning solutions|learning solutions discovery|field enablement|cardiomax|cardiomax launch|launch)$/.test(
    value,
  );
}

function normalizeApprovedContentQuestion(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function joinHumanList(values: string[]) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function getUniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function slugifyForId(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "draft"
  );
}

function createTrainingSummaryDraftSignature(
  selectedEntries: TrainingSummaryDraftEntry[],
  unsupportedTopics: string[],
) {
  return createStableHash(
    [
      selectedEntries.map((entry) => entry.citation.id).join("|"),
      unsupportedTopics.join("|"),
    ].join("::"),
  );
}

function createStableHash(seed: string) {
  let hash = 5381;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getApprovedTrainingContentEntries(): ApprovedTrainingContentEntry[] {
  return createPrototypeSourceRecords()
    .filter(
      (source) =>
        isSourceApprovedForTrainingUse(source) &&
        Boolean(approvedTrainingContentCatalog[source.sourceId]),
    )
    .map((source) => {
      const catalogEntry = approvedTrainingContentCatalog[source.sourceId];

      return {
        citation: createCitationFromSourceRecord(source),
        fact: {
          id: source.sourceId.replace(/^src-/, "approved-"),
          text:
            catalogEntry?.factText ??
            `${source.sourceName} is approved for training use and owned by ${source.owningTeam}.`,
          citationId: source.sourceId,
        },
        keywords:
          catalogEntry?.keywords ??
          [
            source.sourceName,
            source.contentCategory ?? "",
            source.relevanceSummary ?? "",
          ],
      };
    });
}

function createCitationFromSourceRecord(source: SourceLedgerRecord): SourceCitation {
  return {
    accessState: source.accessState,
    approvalState: source.approvalState,
    freshnessLabel: source.lastRefreshedAt
      ? `Freshness: refreshed ${source.lastRefreshedAt}`
      : `Freshness: registered ${source.registeredAt}`,
    href: source.sourceUrl,
    id: source.sourceId,
    marker: "1",
    owner: source.owningTeam,
    sourceType: sourceTypeLabels[source.sourceType],
    system: sourceSystemLabels[source.sourceSystem],
    title: source.sourceName,
  };
}

export function createRestrictedPrototypeAnswer(
  launchName: string,
): SourceBackedAnswer {
  return createStatePrototypeAnswer("access_restricted", launchName);
}

export function createStatePrototypeAnswer(
  state: SourceBackedAnswerState,
  launchName: string,
  previousQuestion?: string | null,
): SourceBackedAnswer {
  const priorContext = previousQuestion
    ? ` Prior question used for follow-up context: "${previousQuestion}".`
    : "";

  if (state === "no_reliable_source") {
    return {
      id: `${launchName}-no-reliable-source`,
      state,
      title: "No reliable source found",
      summary:
        "LaunchPad did not find an approved, accessible source that can verify this claim.",
      confidence: "none",
      freshnessLabel: "Freshness: no reliable source available",
      citations: [],
      retrievedFacts: [],
      sourceGap:
        "Source gap: no approved source was found for that launch fact.",
      nextActions: [
        {
          id: "attach-approved-source",
          label: "Ask the project manager to attach an approved source.",
          href: "/sources",
        },
        {
          id: "check-source-ledger",
          label: "Check Source Ledger ingestion status for missing launch records.",
          href: "/sources",
        },
      ],
    };
  }

  if (state === "access_restricted") {
    return {
      id: `${launchName}-access-restricted`,
      state,
      title: "Access restricted",
      summary:
        "A matching source exists, but your current role cannot view its contents.",
      confidence: "low",
      freshnessLabel: "Freshness: hidden because access is restricted",
      citations: [
        {
          id: "restricted-launch-commitment",
          marker: "1",
          title: "Restricted launch commitment source",
          system: "SharePoint",
          freshnessLabel: "Freshness: restricted",
          accessState: "restricted",
          sourceType: "Restricted source",
        },
      ],
      retrievedFacts: [],
      sourceGap:
        "Source gap: request access or ask an authorized owner to confirm the detail.",
      nextActions: [
        {
          id: "request-source-access",
          label: "Request access from the source owner.",
          href: "/sources",
        },
        {
          id: "ask-authorized-summary",
          label: "Ask an authorized launch participant to provide a non-restricted summary.",
          href: "/handoff",
        },
      ],
    };
  }

  if (state === "source_stale") {
    return {
      id: `${launchName}-source-stale`,
      state,
      title: "Source may be stale",
      summary:
        "The latest matching source is older than the freshness threshold for launch execution answers.",
      confidence: "medium",
      freshnessLabel: "Freshness: stale, last refreshed 9 days ago",
      citations: [
        {
          ...approvedLaunchPlanCitation,
          freshnessLabel: "Freshness: stale, last refreshed 9 days ago",
        },
      ],
      retrievedFacts: [
        {
          id: "stale-owner",
          text: "Deployment Solutions is still listed as the receiving team, but the source is stale.",
          citationId: "cardiomax-launch-plan",
        },
      ],
      sourceGap:
        "Source gap: refresh the source before using this as a final launch commitment.",
      nextActions: [
        {
          id: "refresh-launch-plan",
          label: "Refresh the SharePoint launch plan.",
          href: "/sources#cardiomax-launch-plan",
        },
        {
          id: "confirm-stale-handoff",
          label: "Ask the source owner to confirm whether the handoff is still current.",
          href: "/sources#cardiomax-launch-plan",
        },
      ],
    };
  }

  if (state === "partial_confidence") {
    return {
      id: `${launchName}-partial-confidence`,
      state,
      title: "Partial confidence answer",
      summary:
        "LaunchPad found a matching launch source, but one supporting source is missing or unresolved.",
      confidence: "medium",
      freshnessLabel: "Freshness: refreshed 2 hours ago",
      citations: [approvedLaunchPlanCitation],
      retrievedFacts: [
        {
          id: "partial-owner",
          text: "Jamie Chen is listed as the Deployment Solutions readiness owner.",
          citationId: "cardiomax-launch-plan",
        },
        {
          id: "partial-gap",
          text: "The supporting kickoff notes were not found in the accessible source set.",
        },
      ],
      generatedDraft: {
        id: "partial-draft",
        text: "Draft response: use the named owner, but confirm kickoff notes before treating this as final.",
        reviewLabel: "Draft language requires human review.",
      },
      nextActions: [
        {
          id: "open-launch-plan-citation",
          label: "Open the launch plan citation.",
          href: "/sources#cardiomax-launch-plan",
        },
        {
          id: "ask-missing-kickoff-notes",
          label: "Ask for missing kickoff notes in Source Ledger.",
          href: "/sources",
        },
      ],
    };
  }

  if (state === "missing_information") {
    return {
      id: `${launchName}-missing-information`,
      state,
      title: "Missing information",
      summary:
        "LaunchPad found relevant sources, but they do not include the specific information needed to answer completely.",
      confidence: "low",
      freshnessLabel: "Freshness: refreshed 2 hours ago",
      citations: [approvedLaunchPlanCitation],
      retrievedFacts: [
        {
          id: "missing-scope",
          text: "The launch plan references a handoff, but does not name all downstream approvers.",
          citationId: "cardiomax-launch-plan",
        },
      ],
      sourceGap:
        "Source gap: downstream approver details are missing from the approved launch plan.",
      nextActions: [
        {
          id: "add-downstream-approvers",
          label: "Ask the source owner to add downstream approver details.",
          href: "/sources#cardiomax-launch-plan",
        },
        {
          id: "create-handoff-clarification",
          label: "Create a clarification request for the handoff owner.",
          href: "/handoff",
        },
      ],
    };
  }

  if (state === "connector_unavailable") {
    return {
      id: `${launchName}-connector-unavailable`,
      state,
      title: "Connector unavailable",
      summary:
        "LaunchPad cannot complete the answer because one source system is currently unavailable.",
      confidence: "low",
      freshnessLabel: "Freshness: Smartsheet connector unavailable",
      citations: [approvedLaunchPlanCitation],
      retrievedFacts: [
        {
          id: "connector-known-fact",
          text: "The SharePoint launch plan is available, but Smartsheet task status could not be checked.",
          citationId: "cardiomax-launch-plan",
        },
      ],
      sourceGap:
        "Source gap: Smartsheet status cannot be retrieved until the connector recovers.",
      nextActions: [
        {
          id: "retry-connector",
          label: "Retry after connector health returns.",
          href: "/sources",
        },
        {
          id: "check-connector-status",
          label: "Check the source ledger for connector status.",
          href: "/sources",
        },
      ],
    };
  }

  return {
    id: `${launchName}-answered`,
    state,
    title: "Deployment handoff owner",
    summary:
      `For ${launchName}, the deployment handoff is source-backed from approved launch records.` +
      priorContext,
    confidence: "high",
    freshnessLabel: "Freshness: refreshed 2 hours ago",
    citations: [approvedLaunchPlanCitation, smartsheetCitation],
    retrievedFacts: [
      {
        id: "deployment-owner",
        text: "Jamie Chen is listed as the Deployment Solutions readiness owner.",
        citationId: "cardiomax-launch-plan",
      },
      {
        id: "handoff-due",
        text: "The handoff checkpoint is due before the kickoff readiness review.",
        citationId: "cardiomax-smartsheet-status",
      },
    ],
    generatedDraft: {
      id: "handoff-owner-draft",
      text: "Draft response: coordinate the handoff with Jamie Chen and confirm readiness before the kickoff review.",
      reviewLabel: "Draft language requires human review.",
    },
    nextActions: [
      {
        id: "open-cardiomax-launch-plan",
        label: "Open CARDIOMAX Launch Plan.",
        href: "/sources#cardiomax-launch-plan",
      },
      {
        id: "ask-related-risks",
        label: "Ask about related risks or blockers.",
        href: "#agent-question",
      },
    ],
  };
}
