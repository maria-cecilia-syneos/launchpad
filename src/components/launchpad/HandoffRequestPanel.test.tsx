import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HandoffRequestPanel } from "./HandoffRequestPanel";
import {
  createPrototypeHandoffArtifacts,
  type HandoffArtifact,
} from "@/domain/handoff";
import { defaultWorkspaceSession } from "@/domain/workspace";

describe("HandoffRequestPanel", () => {
  it("creates a reusable Digital Handoff Artifact with sources and audit details", async () => {
    const user = userEvent.setup();
    const onHandoffAuditEvent = vi.fn();

    render(
      <HandoffRequestPanel
        initialArtifacts={[]}
        onHandoffAuditEvent={onHandoffAuditEvent}
        session={defaultWorkspaceSession}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /request handoff/i }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /handoff purpose is required/i,
    );

    await user.type(
      screen.getByRole("textbox", { name: /handoff purpose/i }),
      "Prepare Deployment Solutions for kickoff readiness.",
    );
    await user.type(
      screen.getByRole("textbox", { name: /requested timing/i }),
      "Before June kickoff",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /cardiomax launch plan/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /request handoff/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /created reusable digital handoff artifact/i,
    );
    const artifact = screen.getByRole("article", {
      name: /digital handoff artifact/i,
    });
    expect(artifact).toHaveTextContent(/status: requested/i);
    expect(artifact).toHaveTextContent(
      /responsible owner: deployment solutions/i,
    );
    expect(artifact).toHaveTextContent(/cardiomax launch plan/i);
    expect(artifact).toHaveTextContent(/state: current/i);

    const audit = screen.getByRole("region", { name: /latest audit event/i });
    expect(audit).toHaveTextContent(/action: created/i);
    expect(audit).toHaveTextContent(/actor: cece rivera/i);
    expect(audit).toHaveTextContent(/handoff id:/i);
    expect(audit).toHaveTextContent(/correlation id:/i);
    expect(onHandoffAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "handoff.requested",
        metadata: expect.objectContaining({
          action: "created",
          receivingTeam: "Deployment Solutions",
          sendingTeam: "Launch Operations",
        }),
      }),
    );
  });

  it("appends to an existing reusable artifact and preserves history states", async () => {
    const user = userEvent.setup();

    render(
      <HandoffRequestPanel
        initialArtifacts={createPrototypeHandoffArtifacts()}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /handoff purpose/i }),
      "Add updated deployment training dependency.",
    );
    await user.type(
      screen.getByRole("textbox", { name: /requested timing/i }),
      "Before deployment kickoff",
    );
    const requestForm = screen.getByRole("form", {
      name: /request reusable handoff/i,
    });
    await user.click(
      within(requestForm).getByRole("checkbox", {
        name: /cardiomax approved asset library/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /request handoff/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /appended reusable digital handoff artifact/i,
    );
    const artifact = screen.getByRole("article", {
      name: /digital handoff artifact/i,
    });
    expect(artifact).toHaveTextContent(/previously handed-off context/i);
    expect(artifact).toHaveTextContent(/new request update/i);
    expect(artifact).toHaveTextContent(/state: current/i);
    expect(artifact).toHaveTextContent(/state: stale/i);
    expect(artifact).toHaveTextContent(/state: missing/i);
    expect(artifact).toHaveTextContent(/state: superseded/i);
    expect(artifact).toHaveTextContent(/state: conflicting/i);
    expect(
      within(artifact).getAllByText(/cardiomax approved asset library/i).length,
    ).toBeGreaterThan(0);
  });

  it("saves structured draft content with section state, source metadata, history, and audit details", async () => {
    const user = userEvent.setup();

    render(
      <HandoffRequestPanel
        initialArtifacts={createPrototypeHandoffArtifacts()}
        session={defaultWorkspaceSession}
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: /scope content/i }));
    await user.type(
      screen.getByRole("textbox", { name: /scope content/i }),
      "Deployment Solutions will prepare kickoff context and readiness checks.",
    );
    await user.clear(
      screen.getByRole("textbox", { name: /commitments content/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /commitments content/i }),
      "Updated kickoff material commitment supersedes the prior handoff note.",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /commitments state/i }),
      "superseded",
    );
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /saved draft digital handoff artifact/i,
    );
    const artifact = screen.getByRole("article", {
      name: /digital handoff artifact/i,
    });
    expect(artifact).toHaveTextContent(/status: draft/i);
    expect(artifact).toHaveTextContent(/commitments/i);
    expect(artifact).toHaveTextContent(/state: superseded/i);
    expect(artifact).toHaveTextContent(/freshness: fresh/i);
    expect(artifact).toHaveTextContent(/approval: approved/i);
    expect(artifact).toHaveTextContent(/access: authorized/i);
    expect(artifact).toHaveTextContent(/structured content update/i);
    expect(artifact).toHaveTextContent(
      /prior structured handoff content preserved/i,
    );
    expect(artifact).toHaveTextContent(
      /launch operations will provide deployment scope and approved launch context/i,
    );

    const audit = screen.getByRole("region", { name: /latest audit event/i });
    expect(audit).toHaveTextContent(/action: updated/i);
    expect(audit).toHaveTextContent(/workstream id: deployment-readiness/i);
    expect(audit).toHaveTextContent(/correlation id:/i);
  });

  it("blocks readiness with inline errors and marks complete content ready for review", async () => {
    const user = userEvent.setup();
    const onHandoffAuditEvent = vi.fn();

    render(
      <HandoffRequestPanel
        initialArtifacts={createPrototypeHandoffArtifacts()}
        onHandoffAuditEvent={onHandoffAuditEvent}
        session={defaultWorkspaceSession}
      />,
    );

    await user.clear(
      screen.getByRole("textbox", { name: /commitments content/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /mark ready for review/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /commitments are required before receiving-team readiness review/i,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /open questions remain a readiness risk/i,
    );
    expect(screen.getAllByText(/commitments are required/i).length)
      .toBeGreaterThan(0);

    await user.type(
      screen.getByRole("textbox", { name: /commitments content/i }),
      "Deploy kickoff materials before the June kickoff window.",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /assumptions state/i }),
      "current",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /risks state/i }),
      "current",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /open questions state/i }),
      "current",
    );
    await user.clear(
      screen.getByRole("textbox", { name: /open questions content/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /open questions content/i }),
      "No open questions remain for kickoff readiness.",
    );
    await user.click(
      screen.getByRole("button", { name: /mark ready for review/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /marked digital handoff artifact ready for review/i,
    );
    expect(
      screen.getByRole("article", { name: /digital handoff artifact/i }),
    ).toHaveTextContent(/status: ready for review/i);
    expect(
      screen.getByRole("region", { name: /latest audit event/i }),
    ).toHaveTextContent(/action: ready for review/i);
    expect(onHandoffAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "handoff.ready_for_review",
        metadata: expect.objectContaining({
          action: "ready_for_review",
        }),
      }),
    );

    const completenessPanel = screen.getByRole("region", {
      name: /handoff completeness panel/i,
    });
    expect(completenessPanel).toHaveTextContent(/review status: ready to accept/i);
    await user.click(screen.getByRole("button", { name: /accept handoff/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /accepted digital handoff artifact/i,
    );
    expect(
      screen.getByRole("article", { name: /digital handoff artifact/i }),
    ).toHaveTextContent(/status: accepted/i);
    expect(
      screen.getByRole("region", { name: /latest audit event/i }),
    ).toHaveTextContent(/action: accepted/i);
    expect(onHandoffAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "handoff.accepted",
        metadata: expect.objectContaining({
          action: "accepted",
        }),
      }),
    );
  });

  it("shows completeness gaps, records clarification requests, and returns for update", async () => {
    const user = userEvent.setup();
    const onHandoffAuditEvent = vi.fn();

    render(
      <HandoffRequestPanel
        initialArtifacts={createPrototypeHandoffArtifacts()}
        onHandoffAuditEvent={onHandoffAuditEvent}
        session={defaultWorkspaceSession}
      />,
    );

    const panel = screen.getByRole("region", {
      name: /handoff completeness panel/i,
    });
    expect(panel).toHaveTextContent(/assumptions/i);
    expect(panel).toHaveTextContent(/state: stale/i);
    expect(panel).toHaveTextContent(/risks/i);
    expect(panel).toHaveTextContent(/state: conflicting/i);
    expect(panel).toHaveTextContent(/owner route: deployment solutions/i);
    expect(panel).toHaveTextContent(/source route: cardiomax smartsheet status/i);

    await user.click(screen.getByRole("button", { name: /accept handoff/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /handoff must be marked ready for review before acceptance/i,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: /clarification area/i }),
      "risks",
    );
    await user.type(
      screen.getByRole("textbox", { name: /clarification question/i }),
      "Which timeline source should Deployment Solutions trust?",
    );
    await user.click(
      screen.getByRole("button", { name: /request clarification/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /requested clarification on risks/i,
    );
    expect(panel).toHaveTextContent(/state: needs clarification/i);
    expect(panel).toHaveTextContent(
      /which timeline source should deployment solutions trust/i,
    );
    expect(
      screen.getByRole("region", { name: /latest audit event/i }),
    ).toHaveTextContent(/action: clarification requested/i);
    expect(onHandoffAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "handoff.clarification_requested",
        metadata: expect.objectContaining({
          action: "clarification_requested",
        }),
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /return for clarification/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /returned digital handoff artifact for clarification/i,
    );
    expect(
      screen.getByRole("article", { name: /digital handoff artifact/i }),
    ).toHaveTextContent(/status: returned for clarification/i);
    expect(panel).toHaveTextContent(/decision: returned for clarification/i);
    expect(panel).toHaveTextContent(/required updates/i);
    expect(
      screen.getByRole("region", { name: /latest audit event/i }),
    ).toHaveTextContent(/action: returned/i);
    expect(panel).toHaveTextContent(/decision history: returned for clarification/i);
  });

  it("redacts restricted structured source details for non-admin users", () => {
    const artifacts = createRestrictedStructuredSourceArtifacts();

    render(
      <HandoffRequestPanel
        initialArtifacts={artifacts}
        session={defaultWorkspaceSession}
      />,
    );

    const structuredSummary = screen.getByRole("region", {
      name: /structured content summary/i,
    });
    expect(structuredSummary).toHaveTextContent(
      /restricted source details are hidden/i,
    );
    expect(structuredSummary).toHaveTextContent(/access: restricted/i);
    expect(structuredSummary).not.toHaveTextContent(
      /restricted commercial launch plan/i,
    );

    const completenessPanel = screen.getByRole("region", {
      name: /handoff completeness panel/i,
    });
    expect(completenessPanel).toHaveTextContent(/source route: restricted source/i);
    expect(completenessPanel).not.toHaveTextContent(
      /restricted commercial launch plan/i,
    );
  });
});

function createRestrictedStructuredSourceArtifacts(): HandoffArtifact[] {
  const [artifact] = createPrototypeHandoffArtifacts();

  return [
    {
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
    },
  ];
}
