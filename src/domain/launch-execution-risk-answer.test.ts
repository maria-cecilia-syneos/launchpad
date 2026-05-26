import { describe, expect, it } from "vitest";

import type { NormalizedLaunchTaskRecord } from "./launch-artifact-ingestion";
import type { LaunchTimelineTaskInput } from "./launch-timeline";
import {
  buildLaunchExecutionRiskSourceBackedAnswer,
  isLaunchExecutionRiskQuestion,
} from "./launch-execution-risk-answer";
import { createPrototypeSmartsheetStatusTasks } from "./smartsheet-status";

function buildRestrictedTaskRecord(): NormalizedLaunchTaskRecord {
  return {
    accessState: "restricted",
    approvalState: "approved",
    blockerState: "Client kickoff window not confirmed",
    criticalPath: false,
    dependencyIds: [],
    dueDateLabel: "2026-06-08",
    freshnessState: "restricted",
    handoffRelevance: "Deployment readiness",
    ingestionStatus: "restricted",
    launchId: "cardiomax",
    launchTaskRecordId: "launchtask-restricted-readiness",
    owningTeam: "Project Management",
    ownerName: "Deployment Lead",
    ownerRole: "Deployment Lead",
    phase: "Launch",
    refreshedAt: "2026-05-22T15:45:00.000Z",
    sourceId: "src-restricted-smartsheet-status",
    sourceLocationKey: "restricted-smartsheet-status",
    sourceObjectId: "restricted-sheet",
    sourceSystem: "smartsheet",
    sourceType: "smartsheet_sheet",
    sourceUrl: "/sources#restricted-smartsheet-status",
    taskId: "restricted-readiness-task",
    taskName: "Restricted readiness task",
    taskStatus: "blocked",
  };
}

function buildRestrictedTaskInput(): LaunchTimelineTaskInput {
  return {
    blockerState: "Secret blocker",
    criticalPath: false,
    dependencyTaskIds: [],
    dueDateLogic: "2026-06-08",
    handoffGate: "Secret handoff",
    launchId: "cardiomax",
    ownerRole: "Secret owner",
    phase: "Secret phase",
    sourceProvenance: {
      accessLabel: "Restricted",
      accessState: "restricted",
      approvalLabel: "Restricted",
      approvalState: "restricted",
      freshnessLabel: "Restricted",
      freshnessState: "restricted",
      ingestionLabel: "Restricted",
      ingestionStatus: "restricted",
      isRedacted: true,
      sourceName: "Secret execution source",
      sourceSystemLabel: "Smartsheet",
      sourceTypeLabel: "Smartsheet sheet",
      sourceUrl: "/sources#secret-execution-source",
    },
    status: "blocked",
    taskId: "secret-task",
    taskName: "Secret task",
  };
}

describe("launch execution risk answer domain", () => {
  it("recognizes launch execution and risk questions without capturing unrelated status questions", () => {
    expect(isLaunchExecutionRiskQuestion("Which risks are open?")).toBe(true);
    expect(isLaunchExecutionRiskQuestion("What changed since the prior status check?"))
      .toBe(true);
    expect(isLaunchExecutionRiskQuestion("What about the blocker?", "Which risks are open?"))
      .toBe(true);
    expect(isLaunchExecutionRiskQuestion("What is the deployment status?"))
      .toBe(false);
  });

  it("answers blocked and risk status questions from normalized launch execution data", () => {
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "cardiomax",
      launchName: "CARDIOMAX Launch",
      question: "Which risks are open?",
      role: "project-manager",
    });

    expect(answer).toMatchObject({
      confidence: "medium",
      freshnessLabel: "Freshness: Stale",
      id: "CARDIOMAX Launch-launch-execution-risk",
      state: "source_stale",
      title: "Launch execution and risk status",
    });
    expect(answer.summary).toContain("1 blocked task");
    expect(answer.summary).toContain("3 active risk alerts");
    expect(answer.sourceGap).toMatch(/refresh/i);
    expect(answer.citations).toEqual([
      expect.objectContaining({
        accessState: "authorized",
        freshnessLabel: "Freshness: Stale",
        href: "/sources#cardiomax-approved-smartsheet-status",
        id: "src-cardiomax-smartsheet-approved-status",
        system: "Smartsheet",
      }),
    ]);
    expect(answer.retrievedFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringMatching(/Resolve deployment readiness blockers/),
        }),
        expect.objectContaining({
          text: expect.stringMatching(/Deployment Lead/),
        }),
        expect.objectContaining({
          text: expect.stringMatching(/Verify training asset deployment depends on Resolve deployment readiness blockers/),
        }),
      ]),
    );
    expect(answer.generatedDraft).toMatchObject({
      reviewLabel: expect.stringMatching(/inferred/i),
      text: expect.stringMatching(/Review handoff risk/),
    });
    expect(answer.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/timeline" }),
        expect.objectContaining({ href: "/sources#cardiomax-approved-smartsheet-status" }),
        expect.objectContaining({ href: "/handoff" }),
      ]),
    );
  });

  it("answers changed-since-prior status checks with source system and actor context", () => {
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "cardiomax",
      launchName: "CARDIOMAX Launch",
      previousQuestion: "Which risks are open?",
      question: "What changed since the prior status check?",
      role: "project-manager",
    });

    expect(answer.title).toBe("Launch execution change history");
    expect(answer.summary).toContain(
      'Prior question used for follow-up context: "Which risks are open?".',
    );
    expect(answer.retrievedFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringMatching(/2026-05-22T15:45:00.000Z/),
        }),
        expect.objectContaining({
          text: expect.stringMatching(/source-sync-service/),
        }),
        expect.objectContaining({
          text: expect.stringMatching(/Smartsheet/),
        }),
      ]),
    );
  });

  it("scopes change-history timestamps to visible launch execution records", () => {
    const [firstTask, ...remainingTasks] = createPrototypeSmartsheetStatusTasks();
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "cardiomax",
      launchName: "CARDIOMAX Launch",
      question: "What changed since the prior status check?",
      role: "project-manager",
      taskRecords: [
        firstTask,
        ...remainingTasks,
        {
          ...firstTask,
          launchId: "other-launch",
          refreshedAt: "2026-05-30T18:00:00.000Z",
          taskId: "other-launch-task",
          taskName: "Other launch task",
        },
      ],
    });

    expect(JSON.stringify(answer)).toContain("2026-05-22T15:45:00.000Z");
    expect(JSON.stringify(answer)).not.toContain("2026-05-30T18:00:00.000Z");
  });

  it("returns no reliable source when no scoped execution tasks are available", () => {
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "missing-launch",
      launchName: "Missing Launch",
      question: "Which blockers are open?",
      role: "project-manager",
      taskRecords: createPrototypeSmartsheetStatusTasks(),
    });

    expect(answer).toMatchObject({
      citations: [],
      confidence: "none",
      state: "no_reliable_source",
      title: "No reliable launch execution source found",
    });
    expect(answer.sourceGap).toContain("No approved launch execution source");
  });

  it("keeps restricted task and source details hidden for non-admin roles", () => {
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "cardiomax",
      launchName: "CARDIOMAX Launch",
      question: "Which blockers are open?",
      role: "project-manager",
      taskRecords: [buildRestrictedTaskRecord()],
    });

    expect(answer).toMatchObject({
      confidence: "low",
      state: "access_restricted",
      title: "Launch execution access restricted",
    });
    expect(answer.citations).toEqual([
      expect.objectContaining({
        accessState: "restricted",
        title: "Restricted launch execution source",
      }),
    ]);
    expect(JSON.stringify(answer)).not.toContain("Restricted readiness task");
    expect(JSON.stringify(answer)).not.toContain("src-restricted-smartsheet-status");
    expect(JSON.stringify(answer)).not.toContain("/sources#restricted-smartsheet-status");
  });

  it("keeps restricted task input override details hidden for non-admin roles", () => {
    const answer = buildLaunchExecutionRiskSourceBackedAnswer({
      launchId: "cardiomax",
      launchName: "CARDIOMAX Launch",
      question: "Which blockers are open?",
      role: "project-manager",
      taskInputs: [buildRestrictedTaskInput()],
    });

    expect(answer).toMatchObject({
      confidence: "low",
      state: "access_restricted",
      title: "Launch execution access restricted",
    });
    expect(JSON.stringify(answer)).not.toContain("Secret task");
    expect(JSON.stringify(answer)).not.toContain("Secret owner");
    expect(JSON.stringify(answer)).not.toContain("Secret execution source");
    expect(JSON.stringify(answer)).not.toContain("/sources#secret-execution-source");
  });
});
