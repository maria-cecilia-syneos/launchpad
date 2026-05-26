import { describe, expect, it } from "vitest";

import {
  buildApprovedTrainingContentAnswer,
  isApprovedTrainingContentQuestion,
} from "./answer";

describe("approved training content answers", () => {
  it("constrains approved-content answers to the requested content type", () => {
    const answer = buildApprovedTrainingContentAnswer(
      "What approved claim language is available for training?",
      "CARDIOMAX Launch",
    );

    expect(answer.state).toBe("answered");
    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-clinical-claims",
    ]);
    expect(answer.citations[0]).toMatchObject({
      approvalState: "approved",
      owner: "Medical Review",
    });
    expect(answer.retrievedFacts).toEqual([
      expect.objectContaining({
        citationId: "src-cardiomax-approved-clinical-claims",
        text: expect.stringContaining("Approved Clinical Claim Set"),
      }),
    ]);
    expect(JSON.stringify(answer)).not.toContain("Approved Message House");
    expect(JSON.stringify(answer)).not.toContain("Value Proposition Brief");
  });

  it("returns a missing approved-source state for unsupported specific content requests", () => {
    const answer = buildApprovedTrainingContentAnswer(
      "What approved training content exists on onboarding workshop slides?",
      "CARDIOMAX Launch",
    );

    expect(answer).toMatchObject({
      state: "no_reliable_source",
      title: "Missing approved source",
      confidence: "none",
      citations: [],
      retrievedFacts: [],
    });
    expect(answer.sourceGap).toContain("missing approved source");
    expect(JSON.stringify(answer)).not.toContain("workshop slides are approved");
  });

  it("does not return approved sources for draft, stale, or superseded content requests", () => {
    for (const question of [
      "What draft claim language is available for training?",
      "What stale claim language is available for training?",
      "What superseded claim language is available for training?",
    ]) {
      const answer = buildApprovedTrainingContentAnswer(
        question,
        "CARDIOMAX Launch",
      );

      expect(answer).toMatchObject({
        state: "no_reliable_source",
        title: "Missing approved source",
        citations: [],
      });
    }
  });

  it("routes direct approved-asset questions to approved training content", () => {
    expect(
      isApprovedTrainingContentQuestion(
        "Which approved assets are available for training?",
      ),
    ).toBe(true);

    const answer = buildApprovedTrainingContentAnswer(
      "Which approved assets are available for training?",
      "CARDIOMAX Launch",
    );

    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-assets",
    ]);
  });

  it("does not route unrelated claim-status questions to approved content", () => {
    expect(isApprovedTrainingContentQuestion("Who owns the claims review?"))
      .toBe(false);
  });
});
