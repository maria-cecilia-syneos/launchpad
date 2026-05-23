import { describe, expect, it } from "vitest";

import {
  acceptHandoff,
  createPrototypeHandoffArtifacts,
  markHandoffReadyForReview,
  saveHandoffStructuredContent,
  updateKickoffReadinessDecision,
  type HandoffArtifact,
  type HandoffContentInput,
  type HandoffSupportingSource,
} from "./handoff";
import { buildKickoffReadinessSummary } from "./kickoff-readiness";

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
    text: "Deployment Solutions owns kickoff readiness.",
  },
  risks: {
    state: "current",
    supportingSources: [],
    text: "Late asset updates could affect deployment preparation.",
  },
  scope: {
    state: "current",
    supportingSources: [],
    text: "Deployment Solutions will prepare kickoff context.",
  },
};

describe("kickoff readiness domain", () => {
  it("summarizes current and historical handoff context with actionable gaps", () => {
    const artifact = createPrototypeHandoffArtifacts()[0];
    const summary = buildKickoffReadinessSummary({
      artifact,
      canViewRestricted: false,
    });
    const sectionText = summary.sections.map((section) => section.text).join(" ");

    expect(summary.eligible).toBe(false);
    expect(summary.title).toBe("Kickoff readiness is not yet available");
    expect(summary.sections.map((section) => section.stateLabel)).toEqual(
      expect.arrayContaining([
        "Current",
        "Missing",
        "Stale",
        "Superseded",
        "Conflicting",
      ]),
    );
    expect(sectionText).toContain("Initial deployment scope");
    expect(summary.gaps.map((gap) => gap.label)).toEqual(
      expect.arrayContaining([
        "Kickoff eligibility",
        "Assumptions",
        "Risks",
        "Open questions",
      ]),
    );
    expect(summary.gaps.find((gap) => gap.label === "Risks")).toMatchObject({
      ownerRoute: "Deployment Solutions",
      sourceRoute: "CARDIOMAX Smartsheet Status",
    });
    expect(summary.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: artifact.handoffId,
          title: "Digital Handoff Artifact",
        }),
      ]),
    );
  });

  it("builds a clear eligible summary for accepted handoffs", () => {
    const artifact = getAcceptedArtifact();
    const summary = buildKickoffReadinessSummary({
      artifact,
      canViewRestricted: false,
    });

    expect(summary.eligible).toBe(true);
    expect(summary.title).toBe("Kickoff readiness summary");
    expect(summary.gaps).toHaveLength(0);
    expect(summary.summary).toContain("clear");
    expect(summary.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "src-cardiomax-launch-plan",
          title: "CARDIOMAX Launch Plan",
        }),
      ]),
    );
  });

  it("saves kickoff readiness decisions append-only with audit metadata", () => {
    const artifact = getAcceptedArtifact();
    const first = updateKickoffReadinessDecision(
      [artifact],
      artifact.handoffId,
      {
        area: "risks",
        note: "Risk owner confirmed mitigation path.",
        state: "ready",
      },
      {
        actorId: "Deployment Lead",
        correlationId: "corr-kickoff-risks",
        occurredAt: "2026-05-22T18:00:00.000Z",
      },
    );
    const second = updateKickoffReadinessDecision(
      first.artifacts,
      artifact.handoffId,
      {
        area: "openQuestions",
        note: "One launch question needs follow-up before kickoff.",
        state: "needs_follow_up",
      },
      {
        actorId: "Deployment Lead",
        correlationId: "corr-kickoff-open-questions",
        occurredAt: "2026-05-22T18:05:00.000Z",
      },
    );

    expect(second.artifact.kickoffReadinessDecisions).toHaveLength(2);
    expect(second.artifact.kickoffReadinessDecisions.map((decision) =>
      decision.state
    )).toEqual(["ready", "needs_follow_up"]);
    expect(first.artifact.kickoffReadinessDecisions[0]).toMatchObject({
      handoffId: artifact.handoffId,
      launchId: artifact.launchId,
      workstreamId: artifact.workstreamId,
    });
    expect(first.auditEvent).toMatchObject({
      actorId: "Deployment Lead",
      correlationId: "corr-kickoff-risks",
      eventType: "handoff.kickoff_readiness_updated",
      metadata: {
        action: "kickoff_readiness_updated",
        readinessArea: "risks",
        readinessNote: "Risk owner confirmed mitigation path.",
        readinessState: "ready",
        workstreamId: "deployment-readiness",
      },
      occurredAt: "2026-05-22T18:00:00.000Z",
    });
  });

  it("redacts restricted source-backed summary content for non-admin users", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "authorized",
      approvalState: "restricted",
      freshnessState: "fresh",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-kickoff-risk",
      title: "Secret Kickoff Risk Source",
    };
    const baseArtifact = createPrototypeHandoffArtifacts()[0];
    const artifact: HandoffArtifact = {
      ...baseArtifact,
      history: [
        {
          ...baseArtifact.history[0],
          actorId: "Secret History Owner",
          purpose: "Secret restricted handoff history.",
          supportingSources: [restrictedSource],
        },
      ],
      structuredContent: {
        ...baseArtifact.structuredContent,
        risks: {
          ...baseArtifact.structuredContent.risks,
          supportingSources: [restrictedSource],
          text: "Secret kickoff blocker.",
        },
      },
    };
    const summary = buildKickoffReadinessSummary({
      artifact,
      canViewRestricted: false,
    });

    expect(JSON.stringify(summary)).not.toContain("Secret Kickoff Risk Source");
    expect(JSON.stringify(summary)).not.toContain("Secret kickoff blocker");
    expect(JSON.stringify(summary)).not.toContain("Secret History Owner");
    expect(JSON.stringify(summary)).not.toContain("Secret restricted handoff history");
    expect(JSON.stringify(summary)).not.toContain("src-secret-kickoff-risk");
    expect(summary.sections.find((section) => section.label === "Risks"))
      .toMatchObject({
        text: "Restricted handoff content.",
      });
    expect(summary.gaps.find((gap) => gap.label === "Risks")).toMatchObject({
      ownerRoute: "Restricted owner",
      sourceRoute: "Restricted source",
    });
    expect(summary.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accessState: "restricted",
          title: "Restricted handoff source",
        }),
      ]),
    );
  });

  it("redacts restricted source-backed decision history for non-admin users", () => {
    const restrictedSource: HandoffSupportingSource = {
      accessState: "authorized",
      approvalState: "restricted",
      freshnessState: "fresh",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-kickoff-decision",
      title: "Secret Kickoff Decision Source",
    };
    const acceptedArtifact = getAcceptedArtifact();
    const restrictedArtifact: HandoffArtifact = {
      ...acceptedArtifact,
      structuredContent: {
        ...acceptedArtifact.structuredContent,
        risks: {
          ...acceptedArtifact.structuredContent.risks,
          supportingSources: [restrictedSource],
          text: "Secret decision evidence.",
        },
      },
    };
    const updated = updateKickoffReadinessDecision(
      [restrictedArtifact],
      restrictedArtifact.handoffId,
      {
        area: "risks",
        note: "Secret restricted decision rationale.",
        state: "blocked",
      },
      {
        actorId: "Secret Decision Owner",
        correlationId: "corr-secret-kickoff-decision",
        occurredAt: "2026-05-22T19:00:00.000Z",
      },
    );
    const summary = buildKickoffReadinessSummary({
      artifact: updated.artifact,
      auditEvents: [updated.auditEvent],
      canViewRestricted: false,
    });

    expect(JSON.stringify(summary)).not.toContain("Secret Kickoff Decision Source");
    expect(JSON.stringify(summary)).not.toContain("Secret decision evidence");
    expect(JSON.stringify(summary)).not.toContain("Secret restricted decision rationale");
    expect(JSON.stringify(summary)).not.toContain("Secret Decision Owner");
    expect(JSON.stringify(summary)).not.toContain("src-secret-kickoff-decision");
    expect(summary.decisionHistory[0]).toMatchObject({
      actorId: "Restricted actor",
      note: "Restricted readiness decision details.",
      ownerRoute: "Restricted owner",
      sourceRoute: "Restricted source",
    });
    expect(summary.decisionHistory[0].referenceIds).toEqual(
      expect.arrayContaining([
        restrictedArtifact.handoffId,
        updated.auditEvent.eventId,
      ]),
    );
  });

  it("handles legacy artifacts without kickoff readiness decisions", () => {
    const legacyArtifact = { ...getAcceptedArtifact() };
    delete (legacyArtifact as Partial<HandoffArtifact>).kickoffReadinessDecisions;

    const summary = buildKickoffReadinessSummary({
      artifact: legacyArtifact,
      canViewRestricted: false,
    });
    const updated = updateKickoffReadinessDecision(
      [legacyArtifact],
      legacyArtifact.handoffId,
      {
        area: "risks",
        note: "First readiness decision on a legacy artifact.",
        state: "ready",
      },
      {
        actorId: "Deployment Lead",
      },
    );

    expect(summary.decisionHistory).toHaveLength(0);
    expect(updated.artifact.kickoffReadinessDecisions).toHaveLength(1);
  });

  it("requires kickoff-prep eligibility before saving decisions", () => {
    const artifact = createPrototypeHandoffArtifacts()[0];

    expect(() =>
      updateKickoffReadinessDecision(
        [artifact],
        artifact.handoffId,
        {
          area: "risks",
          state: "ready",
        },
        {
          actorId: "Deployment Lead",
        },
      ),
    ).toThrow(/ready for review or accepted/i);
  });

  it("fails closed for invalid kickoff readiness decisions", () => {
    const artifact = getAcceptedArtifact();

    expect(() =>
      updateKickoffReadinessDecision(
        [artifact],
        artifact.handoffId,
        {
          area: "risks",
          state: "waiting" as never,
        },
        {
          actorId: "Deployment Lead",
        },
      ),
    ).toThrow(/kickoff readiness state is invalid/i);
  });
});

function getAcceptedArtifact() {
  const artifact = createPrototypeHandoffArtifacts()[0];
  const draft = saveHandoffStructuredContent(
    [artifact],
    artifact.handoffId,
    completeContent,
    {
      actorId: "CeCe Rivera",
      occurredAt: "2026-05-22T17:00:00.000Z",
    },
  );
  const ready = markHandoffReadyForReview(draft.artifacts, artifact.handoffId, {
    actorId: "CeCe Rivera",
    occurredAt: "2026-05-22T17:05:00.000Z",
  });
  const accepted = acceptHandoff(ready.artifacts, artifact.handoffId, {
    actorId: "Deployment Lead",
    occurredAt: "2026-05-22T17:10:00.000Z",
  });

  return accepted.artifact;
}
