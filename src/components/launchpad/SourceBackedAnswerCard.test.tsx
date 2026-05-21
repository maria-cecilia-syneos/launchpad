import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceBackedAnswerCard } from "./SourceBackedAnswerCard";
import {
  buildPrototypeAnswer,
  createRestrictedPrototypeAnswer,
  createStatePrototypeAnswer,
} from "@/domain/answer";

describe("SourceBackedAnswerCard", () => {
  it("renders source-backed facts with reachable citations and provenance", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      "CARDIOMAX Launch",
    );

    render(<SourceBackedAnswerCard answer={answer} />);

    expect(
      screen.getByRole("article", { name: /source-backed answer/i }),
    ).toBeVisible();
    expect(screen.getByText(/confidence: high/i)).toBeVisible();
    expect(screen.getByText(/freshness: refreshed/i)).toBeVisible();
    expect(screen.getByText(/source system: sharepoint/i)).toBeVisible();

    const citation = screen.getByRole("link", {
      name: /^citation 1: cardiomax launch plan from sharepoint$/i,
    });
    expect(citation).toHaveAttribute("href", "/sources#cardiomax-launch-plan");
    expect(
      screen.getByRole("link", {
        name: /citation 1: cardiomax launch plan from sharepoint referenced by retrieved fact/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-launch-plan");
    expect(
      screen.getByRole("link", {
        name: /next action: open cardiomax launch plan/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-launch-plan");
    expect(screen.getByText(/retrieved facts/i)).toBeVisible();
    expect(screen.getByText(/generated draft/i)).toBeVisible();
  });

  it("does not expose restricted source links or restricted content", () => {
    render(
      <SourceBackedAnswerCard
        answer={createRestrictedPrototypeAnswer("CARDIOMAX Launch")}
      />,
    );

    expect(screen.getByText(/state: access restricted/i)).toBeVisible();
    expect(screen.getByText(/restricted source details are hidden/i))
      .toBeVisible();
    expect(
      screen.queryByRole("link", {
        name: /restricted launch commitment source/i,
      }),
    )
      .not.toBeInTheDocument();
    expect(screen.queryByText(/restricted launch commitment source/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/source system: sharepoint/i))
      .not.toBeInTheDocument();
  });

  it("suppresses supporting content for restricted payloads", () => {
    const answer = createRestrictedPrototypeAnswer("CARDIOMAX Launch");

    render(
      <SourceBackedAnswerCard
        answer={{
          ...answer,
          generatedDraft: {
            id: "restricted-draft",
            reviewLabel: "Draft language requires human review.",
            text: "Sensitive restricted draft content.",
          },
          retrievedFacts: [
            {
              citationId: "restricted-launch-commitment",
              id: "restricted-fact",
              text: "Sensitive restricted fact.",
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/sensitive restricted fact/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/sensitive restricted draft/i))
      .not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /generated draft/i }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["no_reliable_source", /state: no reliable source/i],
    ["source_stale", /state: source stale/i],
    ["partial_confidence", /state: partial confidence/i],
    ["missing_information", /state: missing information/i],
    ["connector_unavailable", /state: connector unavailable/i],
  ] as const)("renders the %s state with next action text", (state, label) => {
    render(
      <SourceBackedAnswerCard
        answer={createStatePrototypeAnswer(state, "CARDIOMAX Launch")}
      />,
    );

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(/next actions/i)).toBeVisible();
  });

  it("keeps retrieved facts semantically separate from generated draft text", () => {
    const answer = buildPrototypeAnswer(
      "Which launch commitments are due this week?",
      "CARDIOMAX Launch",
    );

    render(<SourceBackedAnswerCard answer={answer} />);

    const retrievedFacts = screen.getByRole("list", {
      name: /retrieved facts/i,
    });
    const generatedDraft = screen.getByRole("region", {
      name: /generated draft/i,
    });

    expect(within(retrievedFacts).getAllByRole("listitem").length).toBeGreaterThan(
      0,
    );
    expect(generatedDraft).toHaveTextContent(/human review/i);
  });

  it("does not render broken markers for dangling fact citations", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      "CARDIOMAX Launch",
    );

    render(
      <SourceBackedAnswerCard
        answer={{
          ...answer,
          citations: [],
          retrievedFacts: [
            {
              id: "dangling-fact",
              text: "A fact references a source that is not available.",
              citationId: "missing-citation",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText(/a fact references a source that is not available/i),
    ).toBeVisible();
    expect(screen.queryByText(/\[undefined\]/i)).not.toBeInTheDocument();
  });

  it("constrains unsafe citation and action hrefs", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      "CARDIOMAX Launch",
    );

    render(
      <SourceBackedAnswerCard
        answer={{
          ...answer,
          citations: [
            {
              ...answer.citations[0],
              href: "javascript:alert(1)",
            },
          ],
          nextActions: [
            {
              ...answer.nextActions[0],
              href: "https://phishing.example/source",
            },
          ],
          retrievedFacts: [],
        }}
      />,
    );

    expect(
      screen.queryByRole("link", {
        name: /^citation 1: cardiomax launch plan from sharepoint$/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/source link unavailable/i)).toBeVisible();
    expect(
      screen.queryByRole("link", {
        name: /next action: open cardiomax launch plan/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("submits accessible answer feedback associated with answer sources", async () => {
    const user = userEvent.setup();
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      "CARDIOMAX Launch",
    );
    const onFeedbackSubmit = vi.fn();

    render(
      <SourceBackedAnswerCard
        answer={answer}
        onFeedbackSubmit={onFeedbackSubmit}
      />,
    );

    await user.click(
      screen.getByRole("radio", { name: /this answer was helpful/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /missing context/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /submit answer feedback/i }),
    );

    expect(onFeedbackSubmit).toHaveBeenCalledWith({
      answerId: answer.id,
      categories: ["missing_context"],
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
    });
    expect(onFeedbackSubmit.mock.calls[0][0]).not.toHaveProperty("answer");
    expect(screen.getByRole("status")).toHaveTextContent(
      /feedback received/i,
    );
    expect(
      screen.getByRole("article", { name: /source-backed answer/i }),
    ).toBeVisible();
  });

  it("does not render feedback submission controls without a recorder", () => {
    const answer = buildPrototypeAnswer(
      "Who owns the deployment handoff?",
      "CARDIOMAX Launch",
    );

    render(<SourceBackedAnswerCard answer={answer} />);

    expect(
      screen.queryByRole("button", { name: /submit answer feedback/i }),
    ).not.toBeInTheDocument();
  });
});
