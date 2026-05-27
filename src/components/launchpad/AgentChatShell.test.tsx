import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentChatShell } from "./AgentChatShell";
import { defaultWorkspaceSession } from "@/domain/workspace";
import {
  createPrototypeHandoffArtifacts,
  type HandoffArtifact,
  type HandoffSupportingSource,
} from "@/domain/handoff";

describe("AgentChatShell", () => {
  it("accepts a launch question with visible submit and announces retrieval", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Which launch commitments are due this week?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    expect(screen.getByText("Which launch commitments are due this week?"))
      .toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving launch context for cardiomax launch/i,
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /answer ready for cardiomax launch/i,
      ),
    );
    expect(
      screen.getByRole("article", { name: /source-backed answer/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /^citation 1: cardiomax launch plan from sharepoint$/i,
      }),
    ).toBeVisible();
    expect(screen.queryByText(/press enter to ask/i)).not.toBeInTheDocument();
  });

  it("records audit events when an answer is created and sources are cited", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Which launch commitments are due this week?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("article", { name: /source-backed answer/i });

    expect(onAuditEventsRecorded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "answer.created",
          metadata: expect.objectContaining({
            answerId: "CARDIOMAX Launch-answered",
            citedSourceIds: [
              "cardiomax-launch-plan",
              "cardiomax-smartsheet-status",
            ],
          }),
        }),
        expect.objectContaining({
          eventType: "answer.source_cited",
          metadata: expect.objectContaining({
            sourceAccessState: "authorized",
          }),
          sourceSystem: "SharePoint",
        }),
      ]),
    );
  });

  it("answers deployment status questions from normalized Smartsheet status", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What is the deployment status?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", { name: /smartsheet project status/i });
    expect(screen.getByText(/state: source stale/i)).toBeVisible();
    expect(screen.getByText(/1 blocked task/i)).toBeVisible();
    expect(
      screen.getAllByText(/resolve deployment readiness blockers/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", {
        name: /^citation 1: smartsheet project status from smartsheet$/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-approved-smartsheet-status");
    expect(onAuditEventsRecorded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "answer.created",
          metadata: expect.objectContaining({
            answerId: "CARDIOMAX Launch-smartsheet-status",
            citedSourceIds: ["src-cardiomax-smartsheet-approved-status"],
          }),
        }),
        expect.objectContaining({
          eventType: "answer.source_cited",
          sourceSystem: "Smartsheet",
        }),
      ]),
    );
  });

  it("answers launch execution risk questions from normalized timeline and alerts", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Which risks are open?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", {
      name: /launch execution and risk status/i,
    });
    expect(screen.getByText(/state: source stale/i)).toBeVisible();
    expect(screen.getByText(/3 active risk alerts/i)).toBeVisible();
    expect(screen.getAllByText(/resolve deployment readiness blockers/i).length)
      .toBeGreaterThan(0);
    expect(screen.getByText(/inferred risk explanation/i)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /^citation 1: smartsheet launch task source from smartsheet$/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-approved-smartsheet-status");
    expect(onAuditEventsRecorded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "answer.created",
          metadata: expect.objectContaining({
            answerId: "CARDIOMAX Launch-launch-execution-risk",
            answerState: "source_stale",
            citedSourceIds: ["src-cardiomax-smartsheet-approved-status"],
          }),
        }),
        expect.objectContaining({
          eventType: "answer.source_cited",
          sourceSystem: "Smartsheet",
        }),
      ]),
    );
  });

  it("answers launch execution change-history questions with source and actor context", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What changed since the prior status check?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", {
      name: /launch execution change history/i,
    });
    expect(screen.getByText(/2026-05-22T15:45:00.000Z/i)).toBeVisible();
    expect(screen.getByText(/source-sync-service/i)).toBeVisible();
    expect(screen.getAllByText(/smartsheet/i).length).toBeGreaterThan(0);
  });

  it("supports keyboard submit while preserving follow-up context", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    const textbox = screen.getByRole("textbox", { name: /ask launchpad/i });
    await user.type(textbox, "What risks are open?{Enter}");

    await screen.findByRole("article", { name: /source-backed answer/i });
    await user.type(textbox, "What about the owner?{Enter}");

    expect(screen.getByText("What about the owner?")).toBeVisible();
    expect(screen.getByText(/follow-up context active/i)).toBeVisible();
    expect(screen.getByText(/using prior question/i)).toHaveTextContent(
      /what risks are open/i,
    );
  });

  it("uses prior context for pronoun-style follow-ups after an initial question", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    const textbox = screen.getByRole("textbox", { name: /ask launchpad/i });
    await user.type(textbox, "Who owns the deployment handoff?{Enter}");

    await screen.findByRole("article", { name: /source-backed answer/i });
    await user.type(textbox, "What about it?{Enter}");

    expect(screen.getByText("What about it?")).toBeVisible();
    expect(screen.getByText(/using prior question/i)).toHaveTextContent(
      /who owns the deployment handoff/i,
    );
    expect(screen.queryByText(/which launch item should i check/i))
      .not.toBeInTheDocument();
  });

  it("does not append a stale delayed answer after a newer question starts", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    const textbox = screen.getByRole("textbox", { name: /ask launchpad/i });
    await user.type(textbox, "Who owns the deployment handoff?{Enter}");
    await user.type(textbox, "What risks are open?{Enter}");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /answer ready for cardiomax launch/i,
      ),
    );

    expect(
      within(screen.getByRole("log", { name: /agent conversation/i })).getByText(
        /using prior question: "Who owns the deployment handoff\?"/i,
      ),
    ).toBeVisible();
    expect(
      screen.getAllByRole("article", { name: /source-backed answer/i }),
    ).toHaveLength(1);
  });

  it("asks for minimum clarification when required context is missing", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What about it?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /clarification needed/i,
    );
    expect(
      screen.getByText(/which launch item should i check/i),
    ).toBeVisible();
    expect(screen.queryByText(/the owner is/i)).not.toBeInTheDocument();
  });

  it("shows an accessible error state without losing the submitted question", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "simulate error for this question",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    expect(screen.getByText("simulate error for this question")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/agent error/i);
    expect(screen.getByText(/no launch facts were generated/i)).toBeVisible();
  });

  it("returns a no reliable source answer instead of fabricating facts", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What is the unverified launch rumor?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/state: no reliable source/i);
    expect(screen.getByText(/source gap/i)).toBeVisible();
    expect(screen.queryByText(/the rumor is true/i)).not.toBeInTheDocument();
  });

  it("records submitted answer feedback without disrupting the chat", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();
    const onFeedbackRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        onFeedbackRecorded={onFeedbackRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Which launch commitments are due this week?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));
    await screen.findByRole("article", { name: /source-backed answer/i });

    await user.click(
      screen.getByRole("radio", { name: /this answer needs work/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /source quality issue/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /submit answer feedback/i }),
    );

    expect(onFeedbackRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        answerId: "CARDIOMAX Launch-answered",
        categories: ["source_quality"],
        rating: "not_helpful",
      }),
    );
    expect(onAuditEventsRecorded).toHaveBeenLastCalledWith([
      expect.objectContaining({
        eventType: "feedback.submitted",
        metadata: expect.objectContaining({
          answerId: "CARDIOMAX Launch-answered",
          categories: ["source_quality"],
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
          rating: "not_helpful",
        }),
      }),
    ]);
    expect(screen.getByRole("article", { name: /source-backed answer/i }))
      .toBeVisible();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(
      /feedback received/i,
    );
  });

  it("returns no reliable source for unsupported factual questions", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What is the launch cafeteria menu?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/state: no reliable source/i);
    expect(screen.queryByText(/deployment handoff owner/i))
      .not.toBeInTheDocument();
  });

  it("answers approved content questions with approved training sources only", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What approved content is available for training?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", { name: /approved training content/i });
    expect(screen.getByText(/state: answered/i)).toBeVisible();
    expect(screen.getByText(/approved for training use/i)).toBeVisible();
    expect(
      screen.getAllByText(/cardiomax approved asset library/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/cardiomax approved message house/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/approval: approved/i).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText(/owner: learning solutions/i).length)
      .toBeGreaterThan(0);
    expect(
      screen.queryByRole("region", { name: /generated draft/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /^citation 1: cardiomax approved asset library from asset$/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-approved-assets");
    expect(onAuditEventsRecorded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "answer.created",
          metadata: expect.objectContaining({
            answerId: "CARDIOMAX Launch-approved-training-content",
            citedSourceIds: expect.arrayContaining([
              "src-cardiomax-approved-assets",
              "src-cardiomax-approved-message-house",
            ]),
          }),
        }),
      ]),
    );
  });

  it("routes training summary draft questions before approved-content discovery and records draft usage", async () => {
    const user = userEvent.setup();
    const onAuditEventsRecorded = vi.fn();

    render(
      <AgentChatShell
        onAuditEventsRecorded={onAuditEventsRecorded}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Draft a training summary from approved sources for Learning Solutions.",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", { name: /training summary draft/i });
    expect(
      screen.getByRole("region", { name: /generated draft/i }),
    ).toHaveTextContent(/requires human review before approval or publishing/i);
    expect(screen.queryByText(/no training draft was generated/i))
      .not.toBeInTheDocument();
    expect(onAuditEventsRecorded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "answer.created",
          metadata: expect.objectContaining({
            answerId: expect.stringMatching(
              /^CARDIOMAX Launch-training-summary-draft-[a-z0-9]+$/,
            ),
            citedSourceIds: expect.arrayContaining([
              "src-cardiomax-approved-assets",
              "src-cardiomax-approved-message-house",
            ]),
          }),
        }),
      ]),
    );

    await user.click(
      screen.getByRole("button", { name: /save draft for review/i }),
    );

    expect(onAuditEventsRecorded).toHaveBeenLastCalledWith([
      expect.objectContaining({
        eventType: "draft.usage_recorded",
        metadata: expect.objectContaining({
          answerId: expect.stringMatching(
            /^CARDIOMAX Launch-training-summary-draft-[a-z0-9]+$/,
          ),
          answerState: "answered",
          citedSourceIds: expect.arrayContaining([
            "src-cardiomax-approved-assets",
            "src-cardiomax-approved-message-house",
          ]),
          draftId: expect.stringMatching(
            /^cardiomax-launch-training-summary-draft-[a-z0-9]+$/,
          ),
          omittedTopics: [],
          usageAction: "saved_for_review",
        }),
      }),
    ]);
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(
      /draft saved for review/i,
    );
  });

  it("answers direct approved-asset training questions", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Which approved assets are available for training?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", { name: /approved training content/i });
    expect(
      screen.getByRole("link", {
        name: /^citation 1: cardiomax approved asset library from asset$/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-approved-assets");
    expect(screen.queryByText(/cardiomax approved message house/i))
      .not.toBeInTheDocument();
  });

  it("returns a missing approved-source answer for unavailable training content", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What approved training content exists for renal dosing?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("heading", { name: /missing approved source/i });
    expect(screen.getByText(/state: no reliable source/i)).toBeVisible();
    expect(screen.getByText(/source gap: missing approved source/i))
      .toBeVisible();
    expect(screen.queryByText(/renal dosing is approved/i))
      .not.toBeInTheDocument();
  });

  it("answers handoff readiness questions from the source-backed handoff artifact", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What is the handoff readiness status?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/handoff readiness needs attention/i);
    expect(screen.getByText(/state: missing information/i)).toBeVisible();
    expect(screen.getByText(/assumptions is stale/i)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /^citation 1: digital handoff artifact from handoff artifact$/i,
      }),
    ).toBeVisible();
  });

  it("keeps generic asset readiness questions out of the handoff route", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Are the launch assets ready?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByRole("link", {
      name: /^citation 1: cardiomax launch plan from sharepoint$/i,
    });
    expect(screen.queryByText(/handoff readiness needs attention/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/state: missing information/i))
      .not.toBeInTheDocument();
  });

  it("answers handoff change-history questions with timestamps and actors", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What changed since the prior handoff review?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/handoff change history/i);
    expect(screen.getByText(/state: partial confidence/i)).toBeVisible();
    expect(screen.getByText(/2026-05-21T09:00:00.000Z/i)).toBeVisible();
    expect(screen.getByText(/state: superseded/i)).toBeVisible();
    expect(screen.getAllByText(/by launch operations/i).length).toBeGreaterThan(
      0,
    );
  });

  it("redacts restricted handoff answers for non-admin sessions", async () => {
    const user = userEvent.setup();
    const restrictedSource: HandoffSupportingSource = {
      accessState: "restricted",
      approvalState: "restricted",
      freshnessState: "restricted",
      provenanceLabel: "Source Ledger",
      sourceId: "src-secret-scope",
      title: "Secret Scope Source",
    };
    const prototypeArtifact = createPrototypeHandoffArtifacts()[0];
    const restrictedArtifact: HandoffArtifact = {
      ...prototypeArtifact,
      structuredContent: {
        ...prototypeArtifact.structuredContent,
        scope: {
          ...prototypeArtifact.structuredContent.scope,
          supportingSources: [restrictedSource],
          text: "Secret scope text",
        },
      },
    };

    render(
      <AgentChatShell
        handoffArtifacts={[restrictedArtifact]}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What scope is in the handoff?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/state: access restricted/i);
    expect(screen.getByRole("heading", { name: /access restricted/i }))
      .toBeVisible();
    expect(screen.getByText(/restricted source details are hidden/i))
      .toBeVisible();
    expect(screen.queryByText(/secret scope source/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret scope text/i)).not.toBeInTheDocument();
  });

  it("returns no reliable source for unverified handoff claims", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "What is the unverified handoff rumor?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    await screen.findByText(/state: no reliable source/i);
    expect(screen.getByText(/no approved handoff artifact/i)).toBeVisible();
    expect(screen.queryByText(/the rumor is true/i)).not.toBeInTheDocument();
  });

  it("does not submit Enter while IME composition is active", () => {
    render(<AgentChatShell session={defaultWorkspaceSession} />);

    const textbox = screen.getByRole("textbox", { name: /ask launchpad/i });
    fireEvent.change(textbox, { target: { value: "期限" } });
    fireEvent.keyDown(textbox, {
      code: "Enter",
      isComposing: true,
      key: "Enter",
    });

    expect(
      within(screen.getByRole("log", { name: /agent conversation/i }))
        .queryByText("期限"),
    ).not.toBeInTheDocument();
    expect(textbox).toHaveValue("期限");
    expect(screen.getByRole("status")).toHaveTextContent(/ready/i);
  });

  it("renders suggested prompts for common launch questions", () => {
    render(<AgentChatShell session={defaultWorkspaceSession} />);

    const prompts = screen.getByRole("list", { name: /suggested questions/i });

    expect(
      within(prompts).getByRole("button", {
        name: /show commitments due this week/i,
      }),
    ).toBeVisible();
    expect(
      within(prompts).getByRole("button", {
        name: /review handoff readiness/i,
      }),
    ).toBeVisible();
    expect(
      within(prompts).getByRole("button", {
        name: /which assets are at risk/i,
      }),
    ).toBeVisible();
  });
});
