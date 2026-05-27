import { describe, expect, it } from "vitest";

import {
  buildApprovedTrainingContentAnswer,
  buildTrainingSummaryDraftAnswer,
  isApprovedTrainingContentQuestion,
  isTrainingSummaryDraftQuestion,
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

describe("training summary draft answers", () => {
  it("detects draft-summary intent without stealing approved-content discovery", () => {
    expect(
      isTrainingSummaryDraftQuestion(
        "Draft a training summary from approved sources for Learning Solutions.",
      ),
    ).toBe(true);
    expect(
      isTrainingSummaryDraftQuestion("Summarize approved content for training."),
    ).toBe(true);
    expect(
      isTrainingSummaryDraftQuestion("Draft a training summary about renal dosing."),
    ).toBe(true);
    expect(
      isTrainingSummaryDraftQuestion(
        "What approved content is available for training?",
      ),
    ).toBe(false);
  });

  it("drafts a training summary only from approved source-backed content", () => {
    const answer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary from approved sources for Learning Solutions.",
      "CARDIOMAX Launch",
    );

    expect(answer).toMatchObject({
      id: expect.stringMatching(
        /^CARDIOMAX Launch-training-summary-draft-[a-z0-9]+$/,
      ),
      state: "answered",
      title: "Training summary draft",
      confidence: "high",
    });
    expect(answer.generatedDraft).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(
          /^cardiomax-launch-training-summary-draft-[a-z0-9]+$/,
        ),
        omittedTopics: [],
        reviewActionLabel: "Save draft for review",
        reviewLabel:
          "Draft language requires human review before approval or publishing.",
      }),
    );
    expect(answer.generatedDraft?.text).toContain("[1]");
    expect(answer.generatedDraft?.text).toContain("[2]");
    expect(answer.generatedDraft?.text).toContain("[3]");
    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-assets",
      "src-cardiomax-approved-message-house",
      "src-cardiomax-approved-clinical-claims",
      "src-cardiomax-value-proposition-brief",
    ]);
    expect(answer.citations[0]).toMatchObject({
      approvalState: "approved",
      owner: "Learning Solutions",
    });
    expect(answer.retrievedFacts.every((fact) => Boolean(fact.citationId)))
      .toBe(true);
    expect(JSON.stringify(answer)).not.toContain("Draft Claim Language");
    expect(JSON.stringify(answer)).not.toContain("Superseded Positioning Claims");
  });

  it("returns a partial draft with source gaps for unsupported sections", () => {
    const answer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary with approved messaging and renal dosing.",
      "CARDIOMAX Launch",
    );

    expect(answer.state).toBe("missing_information");
    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-message-house",
    ]);
    expect(answer.generatedDraft?.text).toContain("Approved Message House");
    expect(answer.sourceGap).toContain("renal dosing");
    expect(answer.generatedDraft?.omittedTopics).toEqual(["renal dosing"]);
    expect(answer.generatedDraft?.text).not.toContain("renal dosing is approved");
  });

  it.each([
    "Draft a training summary including renal dosing.",
    "Draft a training summary for renal dosing.",
    "Draft a training summary regarding renal dosing.",
  ])("returns missing-source gaps for natural topic clauses: %s", (question) => {
    const answer = buildTrainingSummaryDraftAnswer(
      question,
      "CARDIOMAX Launch",
    );

    expect(answer).toMatchObject({
      state: "no_reliable_source",
      title: "Missing approved source",
      confidence: "none",
      citations: [],
    });
    expect(answer.generatedDraft).toBeUndefined();
    expect(answer.sourceGap).toContain("renal dosing");
  });

  it("does not treat unsupported qualified topics as source-backed by broad aliases", () => {
    const unsupportedQualifiedAnswer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary about renal dosing claims.",
      "CARDIOMAX Launch",
    );

    expect(unsupportedQualifiedAnswer).toMatchObject({
      state: "no_reliable_source",
      citations: [],
      retrievedFacts: [],
    });
    expect(unsupportedQualifiedAnswer.generatedDraft).toBeUndefined();
    expect(JSON.stringify(unsupportedQualifiedAnswer)).not.toContain(
      "Approved Clinical Claim Set",
    );

    const mixedAnswer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary covering clinical claims and renal dosing.",
      "CARDIOMAX Launch",
    );

    expect(mixedAnswer.state).toBe("missing_information");
    expect(mixedAnswer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-clinical-claims",
    ]);
    expect(mixedAnswer.sourceGap).toContain("renal dosing");
  });

  it("keeps supported sections when mixed with stale or otherwise ineligible topics", () => {
    const answer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary covering approved messaging and stale claims.",
      "CARDIOMAX Launch",
    );

    expect(answer.state).toBe("missing_information");
    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-approved-message-house",
    ]);
    expect(answer.generatedDraft?.text).toContain("Approved Message House");
    expect(answer.generatedDraft?.text).not.toContain(
      "Approved Clinical Claim Set",
    );
    expect(answer.generatedDraft?.omittedTopics).toEqual(["stale claims"]);
    expect(answer.sourceGap).toContain("stale claims");
  });

  it("returns a missing approved-source state instead of drafting unsupported topics", () => {
    const answer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary about renal dosing.",
      "CARDIOMAX Launch",
    );

    expect(answer).toMatchObject({
      state: "no_reliable_source",
      title: "Missing approved source",
      confidence: "none",
      citations: [],
      retrievedFacts: [],
    });
    expect(answer.generatedDraft).toBeUndefined();
    expect(answer.sourceGap).toContain("renal dosing");
  });

  it("does not use draft, stale, superseded, or restricted sources for generated draft language", () => {
    for (const question of [
      "Draft a training summary from draft claim language.",
      "Draft a training summary from stale claims.",
      "Draft a training summary from superseded claims.",
      "Draft a training summary from restricted claims.",
      "Draft a training summary from unapproved claims.",
      "Draft a training summary from not approved claims.",
    ]) {
      const answer = buildTrainingSummaryDraftAnswer(
        question,
        "CARDIOMAX Launch",
      );

      expect(answer.generatedDraft).toBeUndefined();
      expect(JSON.stringify(answer)).not.toContain("Approved Clinical Claim Set");
      expect(JSON.stringify(answer)).not.toContain("Draft Claim Language");
      expect(JSON.stringify(answer)).not.toContain("Superseded Positioning Claims");
    }
  });

  it("uses distinct draft IDs for different training summary variants", () => {
    const broadAnswer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary from approved sources for Learning Solutions.",
      "CARDIOMAX Launch",
    );
    const messagingAnswer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary covering approved messaging.",
      "CARDIOMAX Launch",
    );
    const partialAnswer = buildTrainingSummaryDraftAnswer(
      "Draft a training summary covering approved messaging and renal dosing.",
      "CARDIOMAX Launch",
    );
    const draftIds = [
      broadAnswer.generatedDraft!.id,
      messagingAnswer.generatedDraft!.id,
      partialAnswer.generatedDraft!.id,
    ];

    expect(new Set(draftIds).size).toBe(draftIds.length);
    expect(draftIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^cardiomax-launch-training-summary-draft-[a-z0-9]+$/,
        ),
      ]),
    );
  });
});
