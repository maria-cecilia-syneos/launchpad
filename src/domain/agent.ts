import type { SourceBackedAnswer } from "./answer";

export type AgentConversationStatus =
  | "idle"
  | "retrieving"
  | "answering"
  | "answered"
  | "clarification"
  | "error";

export type AgentMessageRole = "user" | "assistant";

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  status?: AgentConversationStatus;
  answer?: SourceBackedAnswer;
};

export type SuggestedLaunchQuestion = {
  id: string;
  label: string;
  question: string;
};

export const suggestedLaunchQuestions: SuggestedLaunchQuestion[] = [
  {
    id: "commitments",
    label: "Show commitments due this week",
    question: "Which launch commitments are due this week?",
  },
  {
    id: "owners",
    label: "Find owners for open handoffs",
    question: "Who owns the open handoffs for this launch?",
  },
  {
    id: "handoff-readiness",
    label: "Review handoff readiness",
    question: "What is the handoff readiness status?",
  },
  {
    id: "deadlines",
    label: "Check upcoming deadlines",
    question: "What deadlines should the launch team watch next?",
  },
  {
    id: "assets",
    label: "Which assets are at risk?",
    question: "Which launch assets are at risk or missing approval?",
  },
  {
    id: "approved-training-content",
    label: "Find approved training content",
    question: "What approved content is available for training?",
  },
];

export function needsClarification(question: string) {
  const normalized = question.trim().toLowerCase();

  return (
    normalized.length < 8 ||
    /^(what about it|what about this|what about that|that one|this one)\??$/.test(
      normalized,
    )
  );
}

export function shouldSimulateError(question: string) {
  return question.toLowerCase().includes("simulate error");
}
