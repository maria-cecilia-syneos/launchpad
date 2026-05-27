import { describe, expect, it } from "vitest";

import {
  buildApprovedTrainingContentAnswer,
  buildTrainingImpactAnswer,
  buildTrainingSummaryDraftAnswer,
  isApprovedTrainingContentQuestion,
  isTrainingImpactQuestion,
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

describe("training impact answers", () => {
  it("detects impact-analysis prompts without stealing draft-summary prompts", () => {
    expect(
      isTrainingImpactQuestion("Which training assets contain this changed claim?"),
    ).toBe(true);
    expect(
      isTrainingImpactQuestion(
        "Find assets impacted by the updated value proposition.",
      ),
    ).toBe(true);
    expect(
      isTrainingImpactQuestion("What materials are mentioning the old message?"),
    ).toBe(true);
    expect(
      isTrainingImpactQuestion("Which approved source contains this claim?"),
    ).toBe(false);
    expect(
      isTrainingImpactQuestion(
        "Draft a training summary from approved sources for Learning Solutions.",
      ),
    ).toBe(false);
  });

  it("answers impacted-asset questions with affected assets and approved replacements", () => {
    const answer = buildTrainingImpactAnswer(
      "Which training assets contain this changed claim?",
      "CARDIOMAX Launch",
      undefined,
      "admin",
    );

    expect(answer).toMatchObject({
      id: expect.stringMatching(
        /^CARDIOMAX Launch-training-impact-[a-z0-9]+$/,
      ),
      state: "answered",
      title: "Impacted training assets",
      confidence: "high",
    });
    expect(answer.generatedDraft).toBeUndefined();
    expect(answer.citations.map((citation) => citation.id)).toEqual([
      "src-cardiomax-field-training-deck",
      "src-cardiomax-approved-clinical-claims",
    ]);
    expect(answer.retrievedFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          citationId: "src-cardiomax-field-training-deck",
          text: expect.stringContaining("Module 2 speaker notes"),
        }),
        expect.objectContaining({
          citationId: "src-cardiomax-approved-clinical-claims",
          text: expect.stringContaining("approved replacement"),
        }),
      ]),
    );
  });

  it("returns a missing-source impact state without inventing unsupported matches", () => {
    const answer = buildTrainingImpactAnswer(
      "Which training assets contain changed pricing language?",
      "CARDIOMAX Launch",
      undefined,
      "admin",
    );

    expect(answer).toMatchObject({
      id: expect.stringMatching(
        /^CARDIOMAX Launch-training-impact-no-match-[a-z0-9]+$/,
      ),
      state: "no_reliable_source",
      title: "No impacted training assets found",
      confidence: "none",
      citations: [],
      retrievedFacts: [],
    });
    expect(answer.sourceGap).toContain("no matching ingested training assets");
    expect(JSON.stringify(answer)).not.toContain("pricing language is impacted");
  });

  it("uses query-variant-safe IDs for unsupported impact answers", () => {
    const pricingAnswer = buildTrainingImpactAnswer(
      "Which training assets contain changed pricing language?",
      "CARDIOMAX Launch",
      undefined,
      "admin",
    );
    const onboardingAnswer = buildTrainingImpactAnswer(
      "Which training assets contain changed onboarding phrase?",
      "CARDIOMAX Launch",
      undefined,
      "admin",
    );

    expect(pricingAnswer.id).not.toBe(onboardingAnswer.id);
  });

  it("keeps source gaps when matched impact assets are unreliable", () => {
    const answer = buildTrainingImpactAnswer(
      "Which training assets mention renal dosing simplification?",
      "CARDIOMAX Launch",
      undefined,
      "admin",
    );

    expect(answer).toMatchObject({
      state: "missing_information",
      confidence: "medium",
    });
    expect(answer.summary).toContain(
      "no approved replacement source is available",
    );
    expect(answer.sourceGap).toContain("stale, incomplete");
  });

  it("does not expose restricted impacted asset details to non-admin answer viewers", () => {
    const answer = buildTrainingImpactAnswer(
      "Which training assets contain the restricted competitive displacement message?",
      "CARDIOMAX Launch",
      undefined,
      "project-manager",
    );

    expect(answer).toMatchObject({
      state: "access_restricted",
      title: "Access restricted",
      confidence: "low",
    });
    expect(answer.citations).toEqual([
      expect.objectContaining({
        accessState: "restricted",
        title: "Restricted training asset",
      }),
    ]);
    expect(JSON.stringify(answer)).not.toContain(
      "CARDIOMAX Restricted Objection Handling Guide",
    );
    expect(JSON.stringify(answer)).not.toContain(
      "restricted competitive displacement message",
    );
  });
});
