import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KickoffReadinessSummaryPanel } from "./KickoffReadinessSummaryPanel";
import {
  acceptHandoff,
  createPrototypeHandoffArtifacts,
  markHandoffReadyForReview,
  saveHandoffStructuredContent,
  updateKickoffReadinessDecision,
  type HandoffContentInput,
} from "@/domain/handoff";
import { buildKickoffReadinessSummary } from "@/domain/kickoff-readiness";

const completeContent: HandoffContentInput = {
  assumptions: {
    state: "current",
    supportingSources: [],
    text: "No additional delivery assumptions are known.",
  },
  commitments: {
    state: "current",
    supportingSources: [],
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

describe("KickoffReadinessSummaryPanel", () => {
  it("renders source-backed kickoff facts, gaps, and references", () => {
    const artifact = createPrototypeHandoffArtifacts()[0];
    const summary = buildKickoffReadinessSummary({
      artifact,
      canViewRestricted: false,
    });

    render(
      <KickoffReadinessSummaryPanel
        onSaveDecision={vi.fn()}
        summary={summary}
      />,
    );

    const panel = screen.getByRole("region", {
      name: /kickoff readiness summary/i,
    });
    expect(panel).toHaveTextContent(/kickoff readiness is not yet available/i);
    expect(panel).toHaveTextContent(/eligibility: needs handoff readiness/i);
    expect(
      within(panel).getByRole("region", { name: /kickoff summary facts/i }),
    ).toHaveTextContent(/state: stale/i);
    expect(
      within(panel).getByRole("region", { name: /kickoff readiness gaps/i }),
    ).toHaveTextContent(/open questions/i);
    expect(
      within(panel).getByRole("region", { name: /kickoff source references/i }),
    ).toHaveTextContent(/digital handoff artifact/i);
    expect(
      within(panel).queryByRole("form", {
        name: /save kickoff readiness decision/i,
      }),
    ).not.toBeInTheDocument();
    expect(panel).toHaveTextContent(
      /decisions can be saved after the handoff is ready for review or accepted/i,
    );
  });

  it("saves selected kickoff readiness decisions", async () => {
    const user = userEvent.setup();
    const onSaveDecision = vi.fn();
    const artifact = getAcceptedArtifact();
    const summary = buildKickoffReadinessSummary({
      artifact,
      canViewRestricted: false,
    });

    render(
      <KickoffReadinessSummaryPanel
        onSaveDecision={onSaveDecision}
        summary={summary}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: /readiness area/i }),
      "risks",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /readiness state/i }),
      "blocked",
    );
    await user.type(
      screen.getByRole("textbox", { name: /decision note/i }),
      "Timeline conflict blocks kickoff.",
    );
    await user.click(
      screen.getByRole("button", { name: /save readiness decision/i }),
    );

    expect(onSaveDecision).toHaveBeenCalledWith({
      area: "risks",
      note: "Timeline conflict blocks kickoff.",
      state: "blocked",
    });
  });

  it("renders saved kickoff decision history", () => {
    const artifact = getAcceptedArtifact();
    const updated = updateKickoffReadinessDecision(
      [artifact],
      artifact.handoffId,
      {
        area: "risks",
        note: "Risk owner confirmed mitigation path.",
        state: "ready",
      },
      {
        actorId: "Deployment Lead",
        occurredAt: "2026-05-22T18:00:00.000Z",
      },
    );
    const summary = buildKickoffReadinessSummary({
      artifact: updated.artifact,
      auditEvents: [updated.auditEvent],
      canViewRestricted: false,
    });

    render(
      <KickoffReadinessSummaryPanel
        onSaveDecision={vi.fn()}
        summary={summary}
      />,
    );

    const history = screen.getByRole("region", {
      name: /kickoff readiness decision history/i,
    });
    expect(history).toHaveTextContent(/risks: ready/i);
    expect(history).toHaveTextContent(/deployment lead/i);
    expect(history).toHaveTextContent(/risk owner confirmed mitigation path/i);
    expect(history).toHaveTextContent(/references:/i);
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
