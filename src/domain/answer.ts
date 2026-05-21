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

export type SourceSystem =
  | "SharePoint"
  | "Smartsheet"
  | "ECRM/Salesforce"
  | "Teams"
  | "Email"
  | "Playbook";

export type SourceCitation = {
  id: string;
  marker: string;
  title: string;
  system: SourceSystem;
  href?: string;
  freshnessLabel: string;
  accessState: SourceAccessState;
  sourceType: string;
};

export type RetrievedFact = {
  id: string;
  text: string;
  citationId?: string;
};

export type GeneratedDraft = {
  id: string;
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
