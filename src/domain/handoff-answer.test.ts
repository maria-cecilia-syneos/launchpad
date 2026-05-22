import { describe, expect, it } from "vitest";

import {
  buildHandoffSourceBackedAnswer,
  createPrototypeHandoffAuditEvents,
  isHandoffQuestion,
} from "./handoff-answer";
import {
  createPrototypeHandoffArtifacts,
  type HandoffArtifact,
  type HandoffAuditEvent,
  type HandoffSupportingSource,
  handoffSectionOrder,
} from "./handoff";
import { defaultWorkspaceSession, type WorkspaceSession } from "./workspace";

function getPrototypeArtifact() {
  return createPrototypeHandoffArtifacts()[0];
}

function buildAnswer(question: string, artifact = getPrototypeArtifact()) {
  return buildHandoffSourceBackedAnswer({
    artifacts: [artifact],
    auditEvents: createPrototypeHandoffAuditEvents([artifact]),
    question,
    session: defaultWorkspaceSession,
  });
}

describe("handoff answer domain", () => {
  it("detects explicit handoff questions and contextual follow-ups", () => {
    expect(isHandoffQuestion("What is the handoff readiness status?")).toBe(
      true,
    );
    expect(isHandoffQuestion("What about the owner?", "Who owns the handoff?"))
      .toBe(true);
    expect(isHandoffQuestion("Which launch commitments are due?")).toBe(false);
    expect(isHandoffQuestion("Are the launch assets ready?")).toBe(false);
  });

  it("answers readiness questions from handoff completeness review items", () => {
    const answer = buildAnswer("What is the handoff readiness status?");

    expect(answer.state).toBe("missing_information");
    expect(answer.title).toBe("Handoff readiness needs attention");
    expect(answer.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "handoff-cardiomax-deployment-readiness-deployment-solutions",
          title: "Digital Handoff Artifact",
        }),
        expect.objectContaining({
          id: "src-cardiomax-smartsheet-status",
          title: "CARDIOMAX Smartsheet Status",
        }),
      ]),
    );
    expect(answer.retrievedFacts.map((fact) => fact.text).join(" ")).toContain(
      "Assumptions is Stale",
    );
    expect(answer.sourceGap).toContain("Open questions");
  });

  it("identifies changed, stale, superseded, missing, and conflicting handoff history", () => {
    const answer = buildAnswer("What changed since the prior handoff review?");
    const factText = answer.retrievedFacts.map((fact) => fact.text).join(" ");

    expect(answer.state).toBe("partial_confidence");
    expect(answer.title).toBe("Handoff change history");
    expect(factText).toContain("2026-05-21T09:00:00.000Z");
    expect(factText).toContain("State: Superseded");
    expect(factText).toContain("State: Conflicting");
    expect(factText).toContain("by Launch Operations");
    expect(factText).toContain(
      "Current Scope was updated 2026-05-21T10:30:00.000Z by Launch Operations",
    );
  });

  it("routes missing-section handoff questions to current readiness gaps", () => {
    const answer = buildAnswer("Which handoff sections are missing?");

    expect(answer.title).toBe("Handoff readiness needs attention");
    expect(answer.state).toBe("missing_information");
    expect(answer.retrievedFacts.map((fact) => fact.text).join(" ")).toContain(
      "Open questions is Incomplete",
    );
  });

  it("answers unresolved item questions while distinguishing missing and current context", () => {
    const answer = buildAnswer(
      "Which handoff risks and open questions are unresolved?",
    );
    const factText = answer.retrievedFacts.map((fact) => fact.text).join(" ");

    expect(answer.state).toBe("missing_information");
    expect(factText).toContain(
      "Latest project status may conflict with the kickoff timing assumption.",
    );
    expect(factText).toContain("Open questions is missing current handoff information");
    expect(answer.nextActions[0].label).toContain("open questions");
  });

  it("redacts restricted source-backed handoff content for non-admin users", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "restricted",
      approvalState: "restricted",
      freshnessState: "restricted",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-scope",
      title: "Secret Scope Source",
    };
    const artifact: HandoffArtifact = {
      ...getPrototypeArtifact(),
      structuredContent: {
        ...getPrototypeArtifact().structuredContent,
        scope: {
          ...getPrototypeArtifact().structuredContent.scope,
          supportingSources: [restrictedSource],
          text: "Secret scope text",
        },
      },
    };
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What scope is in the handoff?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("access_restricted");
    expect(JSON.stringify(answer)).not.toContain("Secret Scope Source");
    expect(JSON.stringify(answer)).not.toContain("Secret scope text");
    expect(answer.citations[0]).toEqual(
      expect.objectContaining({
        accessState: "restricted",
        title: "Restricted handoff source",
      }),
    );
  });

  it("redacts artifact-level restricted sources in missing-information answers", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "restricted",
      approvalState: "restricted",
      freshnessState: "restricted",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-artifact",
      title: "Secret Artifact Source",
    };
    const artifact: HandoffArtifact = {
      ...getPrototypeArtifact(),
      supportingSources: [restrictedSource],
    };
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What artifact detail has no evidence?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("missing_information");
    expect(JSON.stringify(answer)).not.toContain("Secret Artifact Source");
    expect(answer.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accessState: "restricted",
          title: "Restricted handoff source",
        }),
      ]),
    );
  });

  it("redacts artifact-level restricted sources when audit events are missing", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "restricted",
      approvalState: "restricted",
      freshnessState: "restricted",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-audit",
      title: "Secret Audit Source",
    };
    const artifact: HandoffArtifact = {
      ...getPrototypeArtifact(),
      supportingSources: [restrictedSource],
    };
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      auditEvents: [],
      question: "What handoff audit events were recorded?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("missing_information");
    expect(JSON.stringify(answer)).not.toContain("Secret Audit Source");
    expect(answer.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accessState: "restricted",
          title: "Restricted handoff source",
        }),
      ]),
    );
  });

  it("treats missing source access state as restricted for non-admin users", () => {
    const unknownAccessSource: HandoffSupportingSource = {
      approvalState: "approved",
      freshnessState: "fresh",
      provenanceLabel: "Source Ledger",
      sourceId: "src-unknown-access",
      title: "Unknown Access Source",
    };
    const artifact: HandoffArtifact = {
      ...getPrototypeArtifact(),
      structuredContent: {
        ...getPrototypeArtifact().structuredContent,
        scope: {
          ...getPrototypeArtifact().structuredContent.scope,
          supportingSources: [unknownAccessSource],
          text: "Unknown access source detail",
        },
      },
    };
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What scope is in the handoff?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("access_restricted");
    expect(JSON.stringify(answer)).not.toContain("Unknown Access Source");
    expect(JSON.stringify(answer)).not.toContain("Unknown access source detail");
  });

  it("allows admin users to see restricted source-backed handoff content", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "restricted",
      approvalState: "restricted",
      freshnessState: "restricted",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-scope",
      title: "Secret Scope Source",
    };
    const artifact: HandoffArtifact = {
      ...getPrototypeArtifact(),
      structuredContent: {
        ...getPrototypeArtifact().structuredContent,
        scope: {
          ...getPrototypeArtifact().structuredContent.scope,
          supportingSources: [restrictedSource],
          text: "Secret scope text",
        },
      },
    };
    const adminSession: WorkspaceSession = {
      ...defaultWorkspaceSession,
      user: {
        name: "Admin User",
        role: "admin",
        roleLabel: "Admin",
      },
    };
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What scope is in the handoff?",
      session: adminSession,
    });

    expect(answer.state).toBe("answered");
    expect(answer.retrievedFacts.map((fact) => fact.text).join(" ")).toContain(
      "Secret scope text",
    );
    expect(answer.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accessState: "authorized",
          title: "Secret Scope Source",
        }),
      ]),
    );
  });

  it("returns no reliable source when no handoff artifact supports the question", () => {
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [],
      question: "Who owns the handoff?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("no_reliable_source");
    expect(answer.citations).toHaveLength(0);
    expect(answer.sourceGap).toContain("no approved handoff artifact");
  });

  it("matches explicit workstream wording and fails closed on missing workstreams", () => {
    const deploymentArtifact = getPrototypeArtifact();
    const trainingArtifact: HandoffArtifact = {
      ...deploymentArtifact,
      handoffId: "handoff-cardiomax-training-readiness-learning-solutions",
      receivingTeam: "Learning Solutions",
      responsibleOwner: "Learning Solutions",
      workstreamId: "training-readiness",
      structuredContent: {
        ...deploymentArtifact.structuredContent,
        owners: {
          ...deploymentArtifact.structuredContent.owners,
          text: "Learning Solutions owns training readiness.",
        },
      },
    };
    const trainingAnswer = buildHandoffSourceBackedAnswer({
      artifacts: [deploymentArtifact, trainingArtifact],
      question: "Who owns the training-readiness workstream handoff?",
      session: defaultWorkspaceSession,
    });
    const missingAnswer = buildHandoffSourceBackedAnswer({
      artifacts: [deploymentArtifact, trainingArtifact],
      question: "Who owns the marketing-readiness workstream handoff?",
      session: defaultWorkspaceSession,
    });

    expect(trainingAnswer.retrievedFacts.map((fact) => fact.text).join(" "))
      .toContain("Learning Solutions owns training readiness.");
    expect(missingAnswer.state).toBe("no_reliable_source");
  });

  it("returns an actionable readiness gap for complete draft handoffs", () => {
    const artifact = getCompleteArtifact({
      status: "draft",
    });
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What is the handoff readiness status?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("missing_information");
    expect(answer.summary).toContain("1 readiness issue");
    expect(answer.sourceGap).toContain("mark the handoff ready for review");
  });

  it("includes accepted and returned review decisions in readiness answers", () => {
    const artifact = getCompleteArtifact({
      reviewDecisions: [
        {
          actorId: "Deployment Lead",
          decision: "accepted",
          occurredAt: "2026-05-22T12:00:00.000Z",
          requiredUpdates: [],
        },
        {
          actorId: "Deployment Lead",
          decision: "returned_for_clarification",
          occurredAt: "2026-05-22T13:00:00.000Z",
          requiredUpdates: ["Risks: clarify blocker owner."],
        },
      ],
      status: "ready_for_review",
    });
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      question: "What is the handoff readiness status?",
      session: defaultWorkspaceSession,
    });
    const factText = answer.retrievedFacts.map((fact) => fact.text).join(" ");

    expect(factText).toContain(
      "Review decision Accepted recorded 2026-05-22T12:00:00.000Z by Deployment Lead",
    );
    expect(factText).toContain(
      "Review decision Returned for clarification recorded 2026-05-22T13:00:00.000Z by Deployment Lead",
    );
    expect(factText).toContain("Risks: clarify blocker owner.");
  });

  it("answers handoff audit questions from provided audit events", () => {
    const artifact = getPrototypeArtifact();
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      auditEvents: createPrototypeHandoffAuditEvents([artifact]),
      question: "What handoff audit events were recorded?",
      session: defaultWorkspaceSession,
    });

    expect(answer.state).toBe("answered");
    expect(answer.retrievedFacts.map((fact) => fact.text).join(" ")).toContain(
      "handoff.requested occurred 2026-05-20T15:00:00.000Z",
    );
  });

  it("sorts audit events before reporting latest freshness", () => {
    const artifact = getPrototypeArtifact();
    const auditEvents: HandoffAuditEvent[] = [
      {
        actorId: "Later Actor",
        correlationId: "corr-later",
        eventId: "evt-later",
        eventType: "handoff.updated",
        handoffId: artifact.handoffId,
        launchId: artifact.launchId,
        metadata: {
          action: "updated",
          receivingTeam: artifact.receivingTeam,
          sendingTeam: artifact.sendingTeam,
          workstreamId: artifact.workstreamId,
        },
        occurredAt: "2026-05-23T10:00:00.000Z",
      },
      {
        actorId: "Earlier Actor",
        correlationId: "corr-earlier",
        eventId: "evt-earlier",
        eventType: "handoff.requested",
        handoffId: artifact.handoffId,
        launchId: artifact.launchId,
        metadata: {
          action: "created",
          receivingTeam: artifact.receivingTeam,
          sendingTeam: artifact.sendingTeam,
          workstreamId: artifact.workstreamId,
        },
        occurredAt: "2026-05-20T10:00:00.000Z",
      },
    ];
    const answer = buildHandoffSourceBackedAnswer({
      artifacts: [artifact],
      auditEvents,
      question: "What handoff audit events were recorded?",
      session: defaultWorkspaceSession,
    });

    expect(answer.freshnessLabel).toBe(
      "Freshness: latest audit event 2026-05-23T10:00:00.000Z",
    );
    expect(answer.retrievedFacts[0].text).toContain("Earlier Actor");
  });
});

function getCompleteArtifact(
  overrides: Partial<HandoffArtifact> = {},
): HandoffArtifact {
  const artifact = getPrototypeArtifact();
  const structuredContent = handoffSectionOrder.reduce(
    (content, sectionKey) => {
      content[sectionKey] = {
        ...artifact.structuredContent[sectionKey],
        state: "current",
        text: sectionKey === "openQuestions"
          ? "None remain."
          : `${sectionKey} is complete.`,
      };

      return content;
    },
    {} as HandoffArtifact["structuredContent"],
  );

  return {
    ...artifact,
    ...overrides,
    structuredContent,
  };
}
