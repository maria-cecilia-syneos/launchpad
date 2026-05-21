import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentChatShell } from "./AgentChatShell";
import { defaultWorkspaceSession } from "@/domain/workspace";

describe("AgentChatShell", () => {
  it("accepts a launch question with visible submit and announces retrieval", async () => {
    const user = userEvent.setup();

    render(<AgentChatShell session={defaultWorkspaceSession} />);

    await user.type(
      screen.getByRole("textbox", { name: /ask launchpad/i }),
      "Who owns the deployment handoff?",
    );
    await user.click(screen.getByRole("button", { name: /ask launchpad/i }));

    expect(screen.getByText("Who owns the deployment handoff?")).toBeVisible();
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
      "Who owns the deployment handoff?",
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
      "Who owns the deployment handoff?",
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
        name: /which assets are at risk/i,
      }),
    ).toBeVisible();
  });
});
