import type {
  AnswerConfidence,
  SourceAccessState,
  SourceBackedAnswer,
  SourceBackedAnswerState,
  SourceSystem,
} from "./answer";

export type AuditEventType =
  | "answer.created"
  | "answer.source_cited"
  | "feedback.submitted";

export type AnswerFeedbackCategory =
  | "usefulness"
  | "accuracy"
  | "source_quality"
  | "missing_context";

export type AnswerFeedbackRating = "helpful" | "not_helpful";

export type AuditSourceReference = {
  sourceId: string;
  sourceSystem: SourceSystem;
  accessState: SourceAccessState;
};

export type AuditEventMetadata = {
  answerId?: string;
  answerState?: SourceBackedAnswerState;
  confidence?: AnswerConfidence;
  sourceId?: string;
  sourceTitle?: string;
  sourceAccessState?: SourceAccessState;
  citedSourceIds?: string[];
  citedSources?: AuditSourceReference[];
  categories?: AnswerFeedbackCategory[];
  rating?: AnswerFeedbackRating;
};

export type AuditEventRecord = {
  eventId: string;
  eventType: AuditEventType;
  occurredAt: string;
  actorId?: string;
  systemActor?: string;
  launchId?: string;
  sourceSystem?: SourceSystem;
  correlationId: string;
  metadata: AuditEventMetadata;
};

export type AnswerFeedbackRecord = {
  feedbackId: string;
  answerId: string;
  actorId: string;
  launchId: string;
  rating: AnswerFeedbackRating;
  categories: AnswerFeedbackCategory[];
  citedSources: AuditSourceReference[];
  submittedAt: string;
  correlationId: string;
};

type AnswerAuditInput = {
  answer: SourceBackedAnswer;
  actorId: string;
  launchId: string;
  occurredAt?: string;
  correlationId?: string;
};

type FeedbackInput = {
  answerId: string;
  actorId: string;
  citedSources: AuditSourceReference[];
  launchId: string;
  rating: AnswerFeedbackRating;
  categories: AnswerFeedbackCategory[];
  submittedAt?: string;
  correlationId?: string;
};

function createTimestamp() {
  return new Date().toISOString();
}

function createId(prefix: string, seed: string) {
  const normalizedSeed =
    seed
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "id";

  return `${prefix}-${normalizedSeed}-${createSeedHash(seed)}`;
}

function createSeedHash(seed: string) {
  let hash = 5381;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function createUniqueSeed() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createUniqueCorrelationId(seed: string) {
  return createId("corr", `${seed}-${createUniqueSeed()}`);
}

export function buildAnswerAuditEvents({
  actorId,
  answer,
  correlationId = createUniqueCorrelationId(answer.id),
  launchId,
  occurredAt = createTimestamp(),
}: AnswerAuditInput): AuditEventRecord[] {
  const citedSourceIds = answer.citations.map((citation) => citation.id);
  const answerCreated: AuditEventRecord = {
    actorId,
    correlationId,
    eventId: createId("evt", `${correlationId}-answer-created`),
    eventType: "answer.created",
    launchId,
    metadata: {
      answerId: answer.id,
      answerState: answer.state,
      citedSourceIds,
      confidence: answer.confidence,
    },
    occurredAt,
  };

  return [
    answerCreated,
    ...answer.citations.map<AuditEventRecord>((citation) => ({
      actorId,
      correlationId,
      eventId: createId(
        "evt",
        `${correlationId}-source-cited-${citation.id}`,
      ),
      eventType: "answer.source_cited",
      launchId,
      metadata: {
        answerId: answer.id,
        sourceAccessState: citation.accessState,
        sourceId: citation.id,
        sourceTitle: citation.title,
      },
      occurredAt,
      sourceSystem: citation.system,
    })),
  ];
}

export function buildPrototypeFeedbackRecord({
  answerId,
  actorId,
  categories,
  citedSources,
  correlationId = createUniqueCorrelationId(`${answerId}-feedback`),
  launchId,
  rating,
  submittedAt = createTimestamp(),
}: FeedbackInput): AnswerFeedbackRecord {
  return {
    actorId,
    answerId,
    categories,
    citedSources,
    correlationId,
    feedbackId: createId("feedback", `${correlationId}-${answerId}`),
    launchId,
    rating,
    submittedAt,
  };
}

export function buildFeedbackSubmittedEvent(
  feedback: AnswerFeedbackRecord,
): AuditEventRecord {
  return {
    actorId: feedback.actorId,
    correlationId: feedback.correlationId,
    eventId: createId("evt", `${feedback.correlationId}-feedback-submitted`),
    eventType: "feedback.submitted",
    launchId: feedback.launchId,
    metadata: {
      answerId: feedback.answerId,
      categories: feedback.categories,
      citedSourceIds: feedback.citedSources.map((source) => source.sourceId),
      citedSources: feedback.citedSources,
      rating: feedback.rating,
    },
    occurredAt: feedback.submittedAt,
  };
}
