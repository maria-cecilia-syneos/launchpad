"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowUp, MessageSquare, Sparkles } from "lucide-react";

import {
  buildApprovedTrainingContentAnswer,
  buildPrototypeAnswer,
  isApprovedTrainingContentQuestion,
} from "@/domain/answer";
import {
  type AnswerFeedbackCategory,
  type AnswerFeedbackRecord,
  type AnswerFeedbackRating,
  type AuditSourceReference,
  type AuditEventRecord,
  buildAnswerAuditEvents,
  buildFeedbackSubmittedEvent,
  buildPrototypeFeedbackRecord,
} from "@/domain/audit";
import {
  type AgentConversationStatus,
  type AgentMessage,
  needsClarification,
  shouldSimulateError,
  suggestedLaunchQuestions,
} from "@/domain/agent";
import {
  buildHandoffSourceBackedAnswer,
  createPrototypeHandoffAuditEvents,
  isHandoffQuestion,
} from "@/domain/handoff-answer";
import {
  buildSmartsheetStatusSourceBackedAnswer,
  isSmartsheetStatusQuestion,
} from "@/domain/smartsheet-status";
import {
  buildLaunchExecutionRiskSourceBackedAnswer,
  isLaunchExecutionRiskQuestion,
} from "@/domain/launch-execution-risk-answer";
import {
  createPrototypeHandoffArtifacts,
  type HandoffArtifact,
  type HandoffAuditEvent,
} from "@/domain/handoff";
import type { WorkspaceSession } from "@/domain/workspace";

import { SourceBackedAnswerCard } from "./SourceBackedAnswerCard";

type AgentChatShellProps = {
  handoffArtifacts?: HandoffArtifact[];
  handoffAuditEvents?: HandoffAuditEvent[];
  session: WorkspaceSession;
  onAuditEventsRecorded?: (events: AuditEventRecord[]) => void;
  onFeedbackRecorded?: (feedback: AnswerFeedbackRecord) => void;
};

const statusLabels: Record<AgentConversationStatus, string> = {
  idle: "Ready for a launch question.",
  retrieving: "Retrieving launch context",
  answering: "Synthesizing question context",
  answered: "Answer ready",
  clarification: "Clarification needed",
  error: "Agent error",
};

export function AgentChatShell({
  handoffArtifacts,
  handoffAuditEvents,
  onAuditEventsRecorded,
  onFeedbackRecorded,
  session,
}: AgentChatShellProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Ask a launch question about ${session.launch.name}. I will keep the current launch context visible and return source-backed answers when reliable sources are available.`,
      status: "idle",
    },
  ]);
  const [statusMessage, setStatusMessage] = useState(statusLabels.idle);
  const [, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [, setFeedbackRecords] = useState<AnswerFeedbackRecord[]>([]);
  const [priorQuestion, setPriorQuestion] = useState<string | null>(null);
  const [followUpReference, setFollowUpReference] = useState<string | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const priorQuestionRef = useRef<string | null>(null);

  const canSubmit = question.trim().length > 0;
  const hasFollowUpContext = Boolean(priorQuestion);
  const launchName = session.launch.name;
  const activeHandoffArtifacts = useMemo(
    () => handoffArtifacts ?? createPrototypeHandoffArtifacts(),
    [handoffArtifacts],
  );
  const activeHandoffAuditEvents = useMemo(
    () =>
      handoffAuditEvents ??
      createPrototypeHandoffAuditEvents(activeHandoffArtifacts),
    [activeHandoffArtifacts, handoffAuditEvents],
  );

  const conversationMessages = useMemo(() => messages, [messages]);

  const clearScheduledStatuses = useCallback(() => {
    for (const timerId of timerIds.current) {
      clearTimeout(timerId);
    }
    timerIds.current = [];
  }, []);

  useEffect(() => clearScheduledStatuses, [clearScheduledStatuses]);

  function setLiveStatus(nextStatus: AgentConversationStatus, suffix = "") {
    const baseLabel = statusLabels[nextStatus];
    setStatusMessage(suffix ? `${baseLabel} ${suffix}` : baseLabel);
  }

  function addMessage(message: AgentMessage) {
    setMessages((current) => [...current, message]);
  }

  function scheduleStatus(callback: () => void, delay: number) {
    const timerId = setTimeout(callback, delay);
    timerIds.current.push(timerId);
  }

  function recordAuditEvents(events: AuditEventRecord[]) {
    setAuditEvents((current) => [...current, ...events]);
    onAuditEventsRecorded?.(events);
  }

  function handleFeedbackSubmit({
    answerId,
    categories,
    citedSources,
    rating,
  }: {
    answerId: string;
    categories: AnswerFeedbackCategory[];
    citedSources: AuditSourceReference[];
    rating: AnswerFeedbackRating;
  }) {
    const feedback = buildPrototypeFeedbackRecord({
      actorId: session.user.name,
      answerId,
      categories,
      citedSources,
      launchId: session.launch.id,
      rating,
    });
    const event = buildFeedbackSubmittedEvent(feedback);

    setFeedbackRecords((current) => [...current, feedback]);
    onFeedbackRecorded?.(feedback);
    recordAuditEvents([event]);
    setStatusMessage(
      `Feedback received for ${launchName}. Preserved for answer quality review.`,
    );
  }

  function processQuestion(rawQuestion: string) {
    const submittedQuestion = rawQuestion.trim();

    if (!submittedQuestion) {
      return;
    }

    clearScheduledStatuses();

    addMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content: submittedQuestion,
    });
    setQuestion("");

    const previousQuestion = priorQuestionRef.current;

    if (needsClarification(submittedQuestion) && !previousQuestion) {
      setLiveStatus("clarification", `for ${launchName}.`);
      addMessage({
        id: `clarification-${Date.now()}`,
        role: "assistant",
        status: "clarification",
        content:
          "Which launch item should I check: a commitment, owner, deadline, document, handoff, risk, or asset?",
      });
      textareaRef.current?.focus();
      return;
    }

    if (shouldSimulateError(submittedQuestion)) {
      setLiveStatus("error", `while preparing ${launchName}.`);
      addMessage({
        id: `error-${Date.now()}`,
        role: "assistant",
        status: "error",
        content:
          "I could not process that question. Your question is still here in the conversation, and no launch facts were generated.",
      });
      textareaRef.current?.focus();
      return;
    }

    setFollowUpReference(previousQuestion);
    setPriorQuestion(submittedQuestion);
    priorQuestionRef.current = submittedQuestion;
    setLiveStatus("retrieving", `for ${launchName}.`);

    scheduleStatus(() => {
      setLiveStatus("answering", `for ${launchName}.`);
    }, 300);

    scheduleStatus(() => {
      const answer = buildAgentAnswer({
        activeHandoffArtifacts,
        activeHandoffAuditEvents,
        launchName,
        previousQuestion,
        question: submittedQuestion,
        session,
      });

      setLiveStatus("answered", `for ${launchName}.`);
      recordAuditEvents(
        buildAnswerAuditEvents({
          actorId: session.user.name,
          answer,
          launchId: session.launch.id,
        }),
      );
      addMessage({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        status: "answered",
        content: previousQuestion
          ? `Source-backed answer ready. Using prior question: "${previousQuestion}".`
          : "Source-backed answer ready.",
        answer,
      });
      textareaRef.current?.focus();
    }, 600);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    processQuestion(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      processQuestion(question);
    }
  }

  function applySuggestedQuestion(nextQuestion: string) {
    setQuestion(nextQuestion);
    textareaRef.current?.focus();
  }

  return (
    <section
      aria-labelledby="agent-title"
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-2">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-syneos-orange">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Agent Cockpit
          </p>
          <h2 className="text-2xl font-semibold tracking-normal" id="agent-title">
            Agent
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Ask about {launchName}. This chat preserves the current launch and
            session context while showing citations, freshness, confidence, and
            missing-source states.
          </p>
        </div>

        <div
          aria-label="Agent conversation"
          className="mb-4 flex min-h-72 flex-col gap-3 rounded-md border border-border bg-background p-4"
          role="log"
        >
          {conversationMessages.map((message) => (
            <div
              className={
                message.role === "user"
                  ? "ml-auto max-w-[80%] rounded-md bg-syneos-orange px-4 py-3 text-sm text-white"
                  : "max-w-[85%] rounded-md border border-border bg-card px-4 py-3 text-sm leading-6"
              }
              key={message.id}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-normal">
                {message.role === "user" ? "You" : "LaunchPad"}
              </p>
              <p>{message.content}</p>
              {message.answer ? (
                <div className="mt-3">
                  <SourceBackedAnswerCard
                    answer={message.answer}
                    onFeedbackSubmit={handleFeedbackSubmit}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div
          className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-sm"
          role="status"
        >
          {statusMessage}
        </div>

        {hasFollowUpContext ? (
          <p className="mb-3 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            Follow-up context active for {launchName}. Using prior question:
            &quot;{followUpReference ?? priorQuestion}&quot;.
          </p>
        ) : null}

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="font-medium" htmlFor="agent-question">
            Ask LaunchPad
          </label>
          <textarea
            className="min-h-28 rounded-md border border-input bg-background px-3 py-3 text-base shadow-sm"
            id="agent-question"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about owners, risks, deadlines, handoffs, documents, commitments, or assets..."
            ref={textareaRef}
            value={question}
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-syneos-orange px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
              Ask LaunchPad
            </button>
          </div>
        </form>
      </div>

      <aside
        aria-labelledby="suggested-questions-title"
        className="rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-syneos-teal" />
          <h3 className="font-semibold" id="suggested-questions-title">
            Suggested questions
          </h3>
        </div>
        <ul aria-label="Suggested questions" className="flex flex-col gap-2">
          {suggestedLaunchQuestions.map((prompt) => (
            <li key={prompt.id}>
              <button
                className="min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:border-syneos-orange hover:bg-syneos-orange/10"
                onClick={() => applySuggestedQuestion(prompt.question)}
                type="button"
              >
                {prompt.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

function buildAgentAnswer({
  activeHandoffArtifacts,
  activeHandoffAuditEvents,
  launchName,
  previousQuestion,
  question,
  session,
}: {
  activeHandoffArtifacts: HandoffArtifact[];
  activeHandoffAuditEvents: HandoffAuditEvent[];
  launchName: string;
  previousQuestion?: string | null;
  question: string;
  session: WorkspaceSession;
}) {
  if (isHandoffQuestion(question, previousQuestion)) {
    return buildHandoffSourceBackedAnswer({
      artifacts: activeHandoffArtifacts,
      auditEvents: activeHandoffAuditEvents,
      previousQuestion,
      question,
      session,
    });
  }

  if (isLaunchExecutionRiskQuestion(question, previousQuestion)) {
    return buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: session.launch.id,
      launchName,
      previousQuestion,
      question,
      role: session.user.role,
    });
  }

  if (isSmartsheetStatusQuestion(question, previousQuestion)) {
    return buildSmartsheetStatusSourceBackedAnswer({
      launchId: session.launch.id,
      launchName,
      previousQuestion,
      question,
      role: session.user.role,
    });
  }

  if (isApprovedTrainingContentQuestion(question, previousQuestion)) {
    return buildApprovedTrainingContentAnswer(
      question,
      launchName,
      previousQuestion,
    );
  }

  return buildPrototypeAnswer(question, launchName, previousQuestion);
}
