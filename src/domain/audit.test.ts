import { describe, expect, it } from "vitest";

import {
  buildPrototypeAnswer,
  buildTrainingSummaryDraftAnswer,
} from "./answer";
import {
  type AuditSourceReference,
  buildAnswerAuditEvents,
  buildDraftUsageAuditEvent,
  buildFeedbackSubmittedEvent,
  buildPrototypeFeedbackRecord,
} from "./audit";
import { defaultWorkspaceSession } from "./workspace";

function getSourceReferences(answer: ReturnType<typeof buildPrototypeAnswer>) {
  return answer.citations.map<AuditSourceReference>((citation) => ({
    accessState: citation.accessState,
    sourceId: citation.id,
    sourceSystem: citation.system,
  }));
}

describe("audit domain helpers", () => {
  it("creates answer audit events with source citations and shared correlation id", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      defaultWorkspaceSession.launch.name,
    );

    const events = buildAnswerAuditEvents({
      actorId: defaultWorkspaceSession.user.name,
      answer,
      correlationId: "corr-answer-1",
      launchId: defaultWorkspaceSession.launch.id,
      occurredAt: "2026-05-21T12:00:00.000Z",
    });

    expect(events.map((event) => event.eventType)).toEqual([
      "answer.created",
      "answer.source_cited",
      "answer.source_cited",
    ]);
    expect(events.every((event) => event.correlationId === "corr-answer-1"))
      .toBe(true);
    expect(events[0]).toMatchObject({
      actorId: defaultWorkspaceSession.user.name,
      launchId: defaultWorkspaceSession.launch.id,
      metadata: {
        answerId: answer.id,
        answerState: answer.state,
        citedSourceIds: ["cardiomax-launch-plan", "cardiomax-smartsheet-status"],
        confidence: answer.confidence,
      },
      occurredAt: "2026-05-21T12:00:00.000Z",
    });
    expect(events[1]).toMatchObject({
      eventType: "answer.source_cited",
      sourceSystem: "SharePoint",
      metadata: {
        answerId: answer.id,
        sourceAccessState: "authorized",
        sourceId: "cardiomax-launch-plan",
      },
    });
  });

  it("submits feedback without storing raw question or answer content", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      defaultWorkspaceSession.launch.name,
    );
    const feedback = buildPrototypeFeedbackRecord({
      actorId: defaultWorkspaceSession.user.name,
      answerId: answer.id,
      categories: ["usefulness", "missing_context"],
      citedSources: getSourceReferences(answer),
      correlationId: "corr-feedback-1",
      launchId: defaultWorkspaceSession.launch.id,
      rating: "helpful",
      submittedAt: "2026-05-21T12:01:00.000Z",
    });
    const event = buildFeedbackSubmittedEvent(feedback);

    expect(feedback).toMatchObject({
      answerId: answer.id,
      actorId: defaultWorkspaceSession.user.name,
      categories: ["usefulness", "missing_context"],
      citedSources: [
        {
          accessState: "authorized",
          sourceId: "cardiomax-launch-plan",
          sourceSystem: "SharePoint",
        },
        {
          accessState: "authorized",
          sourceId: "cardiomax-smartsheet-status",
          sourceSystem: "Smartsheet",
        },
      ],
      launchId: defaultWorkspaceSession.launch.id,
      rating: "helpful",
    });
    expect(event).toMatchObject({
      actorId: defaultWorkspaceSession.user.name,
      correlationId: "corr-feedback-1",
      eventType: "feedback.submitted",
      launchId: defaultWorkspaceSession.launch.id,
      metadata: {
        answerId: answer.id,
        categories: ["usefulness", "missing_context"],
        citedSourceIds: ["cardiomax-launch-plan", "cardiomax-smartsheet-status"],
        citedSources: [
          {
            accessState: "authorized",
            sourceId: "cardiomax-launch-plan",
            sourceSystem: "SharePoint",
          },
          {
            accessState: "authorized",
            sourceId: "cardiomax-smartsheet-status",
            sourceSystem: "Smartsheet",
          },
        ],
        rating: "helpful",
      },
    });
    expect(JSON.stringify([feedback, event])).not.toContain(
      "Who owns the deployment handoff?",
    );
    expect(JSON.stringify([feedback, event])).not.toContain(answer.summary);
    expect(JSON.stringify([feedback, event])).not.toContain(
      "Jamie Chen is listed",
    );
  });

  it("generates distinct default ids for repeated answer and feedback records", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      defaultWorkspaceSession.launch.name,
    );
    const commonInput = {
      actorId: defaultWorkspaceSession.user.name,
      launchId: defaultWorkspaceSession.launch.id,
    };
    const firstAnswerEvents = buildAnswerAuditEvents({
      ...commonInput,
      answer,
      occurredAt: "2026-05-21T12:00:00.000Z",
    });
    const secondAnswerEvents = buildAnswerAuditEvents({
      ...commonInput,
      answer,
      occurredAt: "2026-05-21T12:00:00.000Z",
    });
    const firstFeedback = buildPrototypeFeedbackRecord({
      ...commonInput,
      answerId: answer.id,
      categories: ["accuracy"],
      citedSources: getSourceReferences(answer),
      rating: "not_helpful",
      submittedAt: "2026-05-21T12:01:00.000Z",
    });
    const secondFeedback = buildPrototypeFeedbackRecord({
      ...commonInput,
      answerId: answer.id,
      categories: ["accuracy"],
      citedSources: getSourceReferences(answer),
      rating: "not_helpful",
      submittedAt: "2026-05-21T12:01:00.000Z",
    });

    expect(firstAnswerEvents[0].correlationId).not.toBe(
      secondAnswerEvents[0].correlationId,
    );
    expect(firstFeedback.correlationId).not.toBe(secondFeedback.correlationId);
    expect(firstFeedback.feedbackId).not.toBe(secondFeedback.feedbackId);
    expect(
      new Set(
        [...firstAnswerEvents, ...secondAnswerEvents].map(
          (event) => event.eventId,
        ),
      ).size,
    ).toBe(firstAnswerEvents.length + secondAnswerEvents.length);
  });

  it("records draft usage source lineage without raw draft or question content", () => {
    const answer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary from approved sources for Learning Solutions.",
      defaultWorkspaceSession.launch.name,
    );
    const citedSources = getSourceReferences(answer);
    const event = buildDraftUsageAuditEvent({
      actorId: defaultWorkspaceSession.user.name,
      answerId: answer.id,
      answerState: answer.state,
      citedSources,
      correlationId: "corr-draft-usage-1",
      draftId: answer.generatedDraft!.id,
      launchId: defaultWorkspaceSession.launch.id,
      omittedTopics: answer.generatedDraft!.omittedTopics ?? [],
      occurredAt: "2026-05-26T18:00:00.000Z",
      usageAction: "saved_for_review",
    });

    expect(event).toMatchObject({
      actorId: defaultWorkspaceSession.user.name,
      correlationId: "corr-draft-usage-1",
      eventType: "draft.usage_recorded",
      launchId: defaultWorkspaceSession.launch.id,
      metadata: {
        answerId: answer.id,
        answerState: answer.state,
        citedSourceIds: [
          "src-cardiomax-approved-assets",
          "src-cardiomax-approved-message-house",
          "src-cardiomax-approved-clinical-claims",
          "src-cardiomax-value-proposition-brief",
        ],
        citedSources,
        draftId: answer.generatedDraft!.id,
        omittedTopics: [],
        usageAction: "saved_for_review",
      },
      occurredAt: "2026-05-26T18:00:00.000Z",
    });
    expect(JSON.stringify(event)).not.toContain("Draft a training summary");
    expect(JSON.stringify(event)).not.toContain(answer.generatedDraft!.text);
  });
});
