import { describe, expect, it } from "vitest";

import {
  acceptHandoff,
  createPrototypeHandoffArtifacts,
  getHandoffCompletenessReview,
  getHandoffResponsibleOwner,
  markHandoffReadyForReview,
  requestReusableHandoff,
  requestHandoffClarification,
  returnHandoffForClarification,
  saveHandoffStructuredContent,
  validateHandoffRequest,
  validateHandoffReadiness,
  type HandoffArtifact,
  type HandoffContentInput,
  type HandoffRequestInput,
} from "./handoff";

const validRequest: HandoffRequestInput = {
  launchId: "cardiomax",
  workstreamId: "deployment-readiness",
  sendingTeam: "Launch Operations",
  receivingTeam: "Deployment Solutions",
  purpose: "Prepare Deployment Solutions for kickoff readiness.",
  requestedTiming: "Before June kickoff",
  supportingSources: [
    {
      provenanceLabel: "Source Ledger",
      sourceId: "src-cardiomax-launch-plan",
      title: "CARDIOMAX Launch Plan",
    },
  ],
};

const completeContent: HandoffContentInput = {
  assumptions: {
    state: "current",
    supportingSources: [],
    text: "No additional delivery assumptions are known.",
  },
  commitments: {
    state: "current",
    supportingSources: [
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        provenanceLabel: "Source Ledger",
        sourceId: "src-cardiomax-launch-plan",
        title: "CARDIOMAX Launch Plan",
      },
    ],
    text: "Deploy kickoff materials before the June kickoff window.",
  },
  openQuestions: {
    state: "current",
    supportingSources: [],
    text: "No open questions remain for kickoff readiness.",
  },
  owners: {
    state: "current",
    supportingSources: [],
    text: "Deployment Solutions owns kickoff readiness; Launch Operations owns source updates.",
  },
  risks: {
    state: "current",
    supportingSources: [],
    text: "Late asset updates could affect deployment preparation.",
  },
  scope: {
    state: "current",
    supportingSources: [],
    text: "Deployment Solutions will prepare kickoff context and readiness checks.",
  },
};

describe("handoff domain", () => {
  it("validates required handoff request fields", () => {
    expect(
      validateHandoffRequest({
        ...validRequest,
        purpose: " ",
        receivingTeam: "",
        requestedTiming: "",
        workstreamId: "",
      }),
    ).toEqual([
      {
        field: "workstreamId",
        message: "Launch or workstream is required.",
      },
      {
        field: "receivingTeam",
        message: "Receiving team is required.",
      },
      {
        field: "purpose",
        message: "Handoff purpose is required.",
      },
      {
        field: "requestedTiming",
        message: "Requested timing is required.",
      },
    ]);
  });

  it("creates a reusable handoff artifact with owner and audit details", () => {
    const result = requestReusableHandoff([], validRequest, {
      actorId: "CeCe Rivera",
      correlationId: "corr-handoff-create",
      occurredAt: "2026-05-22T10:00:00.000Z",
    });

    expect(result.action).toBe("created");
    expect(result.artifact).toMatchObject({
      handoffId: "handoff-cardiomax-deployment-readiness-deployment-solutions",
      launchId: "cardiomax",
      receivingTeam: "Deployment Solutions",
      responsibleOwner: "Deployment Solutions",
      status: "requested",
      workstreamId: "deployment-readiness",
    });
    expect(result.artifact.history).toEqual([
      expect.objectContaining({
        actorId: "CeCe Rivera",
        provenanceLabel: "User request",
        state: "current",
        supportingSources: validRequest.supportingSources,
      }),
    ]);
    expect(result.artifacts).toHaveLength(1);
    expect(getHandoffResponsibleOwner(result.artifact)).toBe(
      "Deployment Solutions",
    );
    expect(result.auditEvent).toMatchObject({
      actorId: "CeCe Rivera",
      correlationId: "corr-handoff-create",
      eventType: "handoff.requested",
      handoffId: result.artifact.handoffId,
      launchId: "cardiomax",
      metadata: {
        action: "created",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
      occurredAt: "2026-05-22T10:00:00.000Z",
    });
  });

  it("appends matching reusable handoff context without overwriting history", () => {
    const existingArtifacts = createPrototypeHandoffArtifacts();
    const existingArtifact = existingArtifacts[0];
    const existingHistoryIds = existingArtifact.history.map(
      (entry) => entry.historyId,
    );

    const result = requestReusableHandoff(existingArtifacts, {
      ...validRequest,
      purpose: "Add updated deployment training dependency.",
      supportingSources: [
        {
          provenanceLabel: "Source Ledger",
          sourceId: "src-cardiomax-approved-assets",
          title: "CARDIOMAX Approved Asset Library",
        },
      ],
    }, {
      actorId: "CeCe Rivera",
      correlationId: "corr-handoff-append",
      occurredAt: "2026-05-22T11:30:00.000Z",
    });

    expect(result.action).toBe("appended");
    expect(result.artifact.handoffId).toBe(existingArtifact.handoffId);
    expect(result.artifact.history).toHaveLength(
      existingArtifact.history.length + 1,
    );
    expect(result.artifact.history.slice(0, existingHistoryIds.length).map(
      (entry) => entry.historyId,
    )).toEqual(existingHistoryIds);
    expect(result.artifact.history.map((entry) => entry.state)).toEqual(
      expect.arrayContaining([
        "current",
        "stale",
        "missing",
        "superseded",
        "conflicting",
      ]),
    );
    expect(result.artifact.history.at(-1)).toMatchObject({
      actorId: "CeCe Rivera",
      purpose: "Add updated deployment training dependency.",
      state: "current",
      supportingSources: [
        expect.objectContaining({
          sourceId: "src-cardiomax-approved-assets",
        }),
      ],
    });
    expect(result.auditEvent.metadata.action).toBe("appended");
  });

  it("saves structured handoff content as a draft and preserves prior content in history", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const firstSave = saveHandoffStructuredContent(
      [artifact],
      artifact.handoffId,
      completeContent,
      {
        actorId: "CeCe Rivera",
        correlationId: "corr-content-draft",
        occurredAt: "2026-05-22T12:00:00.000Z",
      },
    );
    const secondSave = saveHandoffStructuredContent(
      firstSave.artifacts,
      artifact.handoffId,
      {
        ...completeContent,
        commitments: {
          ...completeContent.commitments,
          state: "superseded",
          text: "Updated kickoff material commitment supersedes the prior handoff note.",
        },
      },
      {
        actorId: "CeCe Rivera",
        correlationId: "corr-content-update",
        occurredAt: "2026-05-22T12:30:00.000Z",
      },
    );

    expect(firstSave.artifact.status).toBe("draft");
    expect(firstSave.artifact.structuredContent.scope.text).toMatch(
      /deployment solutions will prepare/i,
    );
    expect(firstSave.auditEvent).toMatchObject({
      eventType: "handoff.updated",
      metadata: {
        action: "updated",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
    });
    expect(secondSave.artifact.history.at(-1)).toMatchObject({
      actorId: "CeCe Rivera",
      provenanceLabel: "Structured content update",
      state: "superseded",
    });
    expect(
      secondSave.artifact.history.at(-1)?.structuredContent?.commitments.text,
    ).toBe("Deploy kickoff materials before the June kickoff window.");
    expect(secondSave.artifact.structuredContent.commitments.state).toBe(
      "superseded",
    );
  });

  it("moves a ready artifact back to requested when a new request is appended", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const draft = saveHandoffStructuredContent(
      [artifact],
      artifact.handoffId,
      completeContent,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T13:20:00.000Z",
      },
    );
    const ready = markHandoffReadyForReview(
      draft.artifacts,
      artifact.handoffId,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T13:30:00.000Z",
      },
    );

    const appended = requestReusableHandoff(
      ready.artifacts,
      {
        ...validRequest,
        purpose: "Add a post-review training dependency.",
      },
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T14:00:00.000Z",
      },
    );

    expect(appended.action).toBe("appended");
    expect(appended.artifact.status).toBe("requested");
    expect(appended.artifact.history.at(-1)).toMatchObject({
      purpose: "Add a post-review training dependency.",
      state: "current",
    });
  });

  it("validates readiness and marks complete handoff content ready for review", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const draft = saveHandoffStructuredContent(
      [artifact],
      artifact.handoffId,
      {
        ...completeContent,
        commitments: {
          ...completeContent.commitments,
          text: "",
        },
        openQuestions: {
          ...completeContent.openQuestions,
          state: "missing",
          text: "Deployment owner confirmation is still open.",
        },
      },
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T13:00:00.000Z",
      },
    );

    expect(validateHandoffReadiness(draft.artifact)).toEqual([
      {
        field: "commitments",
        message:
          "Commitments are required before receiving-team readiness review.",
      },
      {
        field: "openQuestions",
        message:
          "Open questions remain a readiness risk and must be resolved or explicitly marked as none.",
      },
    ]);

    const unresolvedOpenQuestion = saveHandoffStructuredContent(
      draft.artifacts,
      artifact.handoffId,
      {
        ...completeContent,
        openQuestions: {
          ...completeContent.openQuestions,
          state: "current",
          text: "Legal approval is still open.",
        },
      },
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T13:10:00.000Z",
      },
    );

    expect(validateHandoffReadiness(unresolvedOpenQuestion.artifact)).toEqual([
      {
        field: "openQuestions",
        message:
          "Open questions remain a readiness risk and must be resolved or explicitly marked as none.",
      },
    ]);

    const completeDraft = saveHandoffStructuredContent(
      draft.artifacts,
      artifact.handoffId,
      completeContent,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T13:20:00.000Z",
      },
    );
    const ready = markHandoffReadyForReview(
      completeDraft.artifacts,
      artifact.handoffId,
      {
        actorId: "CeCe Rivera",
        correlationId: "corr-ready",
        occurredAt: "2026-05-22T13:30:00.000Z",
      },
    );

    expect(ready.artifact.status).toBe("ready_for_review");
    expect(ready.auditEvent).toMatchObject({
      correlationId: "corr-ready",
      eventType: "handoff.ready_for_review",
      metadata: {
        action: "ready_for_review",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
      occurredAt: "2026-05-22T13:30:00.000Z",
    });
  });

  it("builds a receiving-team completeness review with specific gaps and routes", () => {
    const [artifact] = createPrototypeHandoffArtifacts();

    const review = getHandoffCompletenessReview(artifact);

    expect(review.canAccept).toBe(false);
    expect(review.items.find((item) => item.area === "scope")).toMatchObject({
      label: "Scope",
      state: "ready",
    });
    expect(review.items.find((item) => item.area === "assumptions"))
      .toMatchObject({
        ownerRoute: "Deployment Solutions",
        requiredUpdate:
          "Assumptions: refresh the source or confirm the content is still current.",
        state: "stale",
      });
    expect(review.items.find((item) => item.area === "risks")).toMatchObject({
      sourceRoute: "CARDIOMAX Smartsheet Status",
      state: "conflicting",
    });
    expect(review.items.find((item) => item.area === "openQuestions"))
      .toMatchObject({
        reason:
          "Open questions is missing current handoff context.",
        state: "incomplete",
      });
    expect(review.items.find((item) => item.area === "supportingSources"))
      .toMatchObject({
        state: "ready",
      });
    expect(review.items.find((item) => item.area === "kickoffContext"))
      .toMatchObject({
        sourceRoute: "Digital Handoff Artifact request details",
        state: "ready",
      });
    expect(review.requiredUpdates).toEqual(
      expect.arrayContaining([
        "Risks: resolve the conflicting source or owner signal.",
      ]),
    );
  });

  it("records clarification requests with review state and audit details", () => {
    const [artifact] = createPrototypeHandoffArtifacts();

    const result = requestHandoffClarification(
      [artifact],
      artifact.handoffId,
      {
        area: "risks",
        owner: "Launch Operations",
        question: "Which timeline source should Deployment Solutions trust?",
      },
      {
        actorId: "Deployment Lead",
        correlationId: "corr-clarification",
        occurredAt: "2026-05-22T14:30:00.000Z",
      },
    );
    const review = getHandoffCompletenessReview(result.artifact);

    expect(result.action).toBe("clarification_requested");
    expect(result.artifact.clarificationRequests).toEqual([
      expect.objectContaining({
        area: "risks",
        owner: "Launch Operations",
        question: "Which timeline source should Deployment Solutions trust?",
        requestedAt: "2026-05-22T14:30:00.000Z",
        requestedBy: "Deployment Lead",
        sourceRoute: "CARDIOMAX Smartsheet Status",
        status: "open",
      }),
    ]);
    expect(review.items.find((item) => item.area === "risks"))
      .toMatchObject({
        relatedClarificationIds: [
          result.artifact.clarificationRequests[0].clarificationId,
        ],
        state: "needs_clarification",
      });
    expect(result.auditEvent).toMatchObject({
      actorId: "Deployment Lead",
      correlationId: "corr-clarification",
      eventType: "handoff.clarification_requested",
      metadata: {
        action: "clarification_requested",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
      occurredAt: "2026-05-22T14:30:00.000Z",
    });
  });

  it("uses access-safe source routes for restricted review evidence", () => {
    const artifact = createRestrictedReviewSourceArtifact();
    const review = getHandoffCompletenessReview(artifact);
    const riskReviewItem = review.items.find((item) => item.area === "risks");

    expect(riskReviewItem).toMatchObject({
      sourceRoute: "Restricted source",
      state: "conflicting",
    });
    expect(riskReviewItem?.sourceRoute).not.toBe(
      "Restricted commercial launch plan",
    );

    const clarified = requestHandoffClarification(
      [artifact],
      artifact.handoffId,
      {
        area: "risks",
        question: "Which restricted source should Deployment Solutions use?",
        sourceRoute: "Restricted commercial launch plan",
      },
      {
        actorId: "Deployment Lead",
        occurredAt: "2026-05-22T14:45:00.000Z",
      },
    );

    expect(clarified.artifact.clarificationRequests[0]).toMatchObject({
      sourceRoute: "Restricted source",
    });
  });

  it("accepts only clean ready-for-review handoffs and records the decision", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const blockedReady = markHandoffReadyForReview(
      saveHandoffStructuredContent([artifact], artifact.handoffId, {
        ...completeContent,
        risks: {
          ...completeContent.risks,
          state: "conflicting",
        },
      }, {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T15:00:00.000Z",
      }).artifacts,
      artifact.handoffId,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T15:05:00.000Z",
      },
    );

    expect(() =>
      acceptHandoff(blockedReady.artifacts, artifact.handoffId, {
        actorId: "Deployment Lead",
      }),
    ).toThrow(/resolve readiness gaps before accepting/i);

    const cleanReady = markHandoffReadyForReview(
      saveHandoffStructuredContent([artifact], artifact.handoffId, completeContent, {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T15:10:00.000Z",
      }).artifacts,
      artifact.handoffId,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T15:15:00.000Z",
      },
    );
    const accepted = acceptHandoff(cleanReady.artifacts, artifact.handoffId, {
      actorId: "Deployment Lead",
      correlationId: "corr-accept",
      occurredAt: "2026-05-22T15:20:00.000Z",
    });

    expect(accepted.artifact.status).toBe("accepted");
    expect(accepted.artifact.reviewDecision).toEqual({
      actorId: "Deployment Lead",
      decision: "accepted",
      occurredAt: "2026-05-22T15:20:00.000Z",
      requiredUpdates: [],
    });
    expect(accepted.artifact.reviewDecisions).toEqual([
      accepted.artifact.reviewDecision,
    ]);
    expect(accepted.auditEvent).toMatchObject({
      correlationId: "corr-accept",
      eventType: "handoff.accepted",
      metadata: {
        action: "accepted",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
    });
  });

  it("returns a handoff for clarification with required updates and audit", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const clarified = requestHandoffClarification(
      [artifact],
      artifact.handoffId,
      {
        area: "openQuestions",
        question: "Who confirms the final deployment owner?",
      },
      {
        actorId: "Deployment Lead",
        occurredAt: "2026-05-22T16:00:00.000Z",
      },
    );
    const returned = returnHandoffForClarification(
      clarified.artifacts,
      artifact.handoffId,
      {
        actorId: "Deployment Lead",
        correlationId: "corr-return",
        occurredAt: "2026-05-22T16:05:00.000Z",
      },
    );

    expect(returned.artifact.status).toBe("returned_for_clarification");
    expect(returned.artifact.reviewDecision).toMatchObject({
      actorId: "Deployment Lead",
      decision: "returned_for_clarification",
      occurredAt: "2026-05-22T16:05:00.000Z",
      requiredUpdates: expect.arrayContaining([
        "Open questions: respond to Who confirms the final deployment owner?",
      ]),
    });
    expect(returned.artifact.reviewDecisions).toEqual([
      returned.artifact.reviewDecision,
    ]);
    expect(returned.auditEvent).toMatchObject({
      correlationId: "corr-return",
      eventType: "handoff.returned",
      metadata: {
        action: "returned",
        receivingTeam: "Deployment Solutions",
        sendingTeam: "Launch Operations",
        workstreamId: "deployment-readiness",
      },
      occurredAt: "2026-05-22T16:05:00.000Z",
    });
  });

  it("resolves clarification requests after updates and preserves decision history", () => {
    const [artifact] = createPrototypeHandoffArtifacts();
    const clarified = requestHandoffClarification(
      [artifact],
      artifact.handoffId,
      {
        area: "risks",
        question: "Which timeline source should Deployment Solutions trust?",
      },
      {
        actorId: "Deployment Lead",
        occurredAt: "2026-05-22T16:20:00.000Z",
      },
    );
    const returned = returnHandoffForClarification(
      clarified.artifacts,
      artifact.handoffId,
      {
        actorId: "Deployment Lead",
        occurredAt: "2026-05-22T16:25:00.000Z",
      },
    );

    const revised = saveHandoffStructuredContent(
      returned.artifacts,
      artifact.handoffId,
      completeContent,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T16:40:00.000Z",
      },
    );
    const reviewAfterRevision = getHandoffCompletenessReview(revised.artifact);

    expect(revised.artifact.clarificationRequests[0]).toMatchObject({
      resolvedAt: "2026-05-22T16:40:00.000Z",
      resolvedBy: "CeCe Rivera",
      status: "resolved",
    });
    expect(reviewAfterRevision.items.find((item) => item.area === "risks"))
      .toMatchObject({
        state: "ready",
      });

    const ready = markHandoffReadyForReview(
      revised.artifacts,
      artifact.handoffId,
      {
        actorId: "CeCe Rivera",
        occurredAt: "2026-05-22T16:45:00.000Z",
      },
    );
    const accepted = acceptHandoff(ready.artifacts, artifact.handoffId, {
      actorId: "Deployment Lead",
      occurredAt: "2026-05-22T16:50:00.000Z",
    });

    expect(accepted.artifact.reviewDecisions.map((decision) => decision.decision))
      .toEqual(["returned_for_clarification", "accepted"]);
    expect(accepted.artifact.reviewDecision?.decision).toBe("accepted");
  });
});

function createRestrictedReviewSourceArtifact(): HandoffArtifact {
  const [artifact] = createPrototypeHandoffArtifacts();

  return {
    ...artifact,
    structuredContent: {
      ...artifact.structuredContent,
      risks: {
        ...artifact.structuredContent.risks,
        supportingSources: [
          {
            accessState: "restricted",
            approvalState: "restricted",
            freshnessState: "restricted",
            provenanceLabel: "Source Ledger",
            sourceId: "src-restricted-commercial-plan",
            title: "Restricted commercial launch plan",
          },
        ],
      },
    },
  };
}
