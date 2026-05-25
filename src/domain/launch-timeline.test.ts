import { describe, expect, it } from "vitest";

import {
  createPrototypeLaunchPlanSources,
  generateLaunchPlanFromPlaybook,
  type GeneratedLaunchTask,
  type LaunchPlanSetupInput,
} from "./launch-plan";
import type { NormalizedLaunchTaskRecord } from "./launch-artifact-ingestion";
import {
  buildLaunchTimelineReview,
  defaultLaunchTimelineFilters,
  filterLaunchTimelineTasks,
  getLaunchTimelineTaskDetails,
  normalizeIngestedLaunchTimelineTasks,
  sortLaunchTimelineTasks,
  timelineTaskStatusLabels,
  type LaunchTimelineTaskInput,
  type LaunchTimelineTask,
} from "./launch-timeline";

function getGeneratedTasks() {
  const setup: LaunchPlanSetupInput = {
    launchId: "cardiomax",
    launchName: "CARDIOMAX Launch",
    launchTier: "Tier 2",
    projectManager: "CeCe Rivera",
    selectedTemplateOptionId:
      "src-cardiomax-tier-2-playbook:tier-2-playbook:playbook-src-cardiomax-tier-2-playbook-playbook-cardiomax-tier-2-tier-2-playbook-0",
    targetKickoffDate: "2026-06-15",
  };
  const result = generateLaunchPlanFromPlaybook({
    actorId: "CeCe Rivera",
    setup,
    sources: createPrototypeLaunchPlanSources(),
  });

  if (result.status !== "generated") {
    throw new Error("Expected launch plan generation to succeed");
  }

  return result.tasks;
}

function buildTask(overrides: Partial<GeneratedLaunchTask>): GeneratedLaunchTask {
  const [baseTask] = getGeneratedTasks();

  return {
    ...baseTask,
    ...overrides,
    sourceProvenance: {
      ...baseTask.sourceProvenance,
      ...overrides.sourceProvenance,
    },
  };
}

function buildTimelineTaskInput(
  overrides: Partial<LaunchTimelineTaskInput>,
): LaunchTimelineTaskInput {
  const baseTask = buildTask({});

  return {
    ...baseTask,
    ...overrides,
    sourceProvenance: {
      ...baseTask.sourceProvenance,
      ...overrides.sourceProvenance,
    },
  };
}

function buildIngestedTaskRecord(
  overrides: Partial<NormalizedLaunchTaskRecord> = {},
): NormalizedLaunchTaskRecord {
  return {
    accessState: "authorized",
    approvalState: "approved",
    blockerState: "none",
    criticalPath: true,
    dependencyIds: [],
    dueDateLabel: "T-14",
    freshnessState: "fresh",
    handoffRelevance: "Deployment readiness",
    ingestionStatus: "complete",
    launchId: "cardiomax",
    launchTaskRecordId: "launchtask-cardiomax-readiness",
    owningTeam: "Project Management",
    ownerRole: "Project Manager",
    phase: "Launch",
    refreshedAt: "2026-05-21T16:00:00.000Z",
    sourceId: "src-cardiomax-launch-tasks",
    sourceLocationKey: "tasks-cardiomax-launch",
    sourceObjectId: "tasks-cardiomax-launch",
    sourceSystem: "task",
    sourceUrl: "/sources#cardiomax-launch-tasks",
    taskId: "task-readiness-review",
    taskName: "Run readiness review",
    ...overrides,
  };
}

describe("launch timeline domain", () => {
  it("derives phase groups, task states, scan signals, and status counts", () => {
    const review = buildLaunchTimelineReview({
      tasks: getGeneratedTasks(),
    });

    expect(timelineTaskStatusLabels).toMatchObject({
      at_risk: "At risk",
      awaiting_input: "Awaiting input",
      blocked: "Blocked",
      complete: "Complete",
      on_track: "On track",
      source_stale: "Source-stale",
      watch: "Watch",
    });
    expect(review.phaseGroups).toEqual([
      {
        phase: "Mobilize",
        tasks: [
          expect.objectContaining({
            attentionSignals: expect.arrayContaining([
              "Critical path",
              "Handoff gate",
              "Freshness watch",
            ]),
            criticalPathLabel: "Critical path: Yes",
            handoffRelevance: "Sales to Deployment readiness",
            timelineStatus: "watch",
            timelineStatusLabel: "Watch",
          }),
        ],
      },
      {
        phase: "Launch",
        tasks: [
          expect.objectContaining({
            dependencySummary: "Depends on Confirm launch tier and scope",
            timelineStatus: "on_track",
          }),
        ],
      },
    ]);
    expect(review.statusCounts).toMatchObject({
      on_track: 1,
      watch: 1,
    });
    expect(review.filterOptions.phases).toEqual(["Mobilize", "Launch"]);
    expect(review.filterOptions.owners).toEqual(["Launch PM", "Deployment Lead"]);
    expect(review.resultSummary).toBe("2 of 2 timeline tasks shown.");
  });

  it("supports deterministic filtering, active filter labels, and clearing filter defaults", () => {
    const review = buildLaunchTimelineReview({
      filters: {
        ...defaultLaunchTimelineFilters,
        handoffRelevance: "has_handoff",
        risk: "attention",
        sourceFreshness: "watch",
        status: "watch",
      },
      tasks: getGeneratedTasks(),
    });

    expect(review.filteredTasks).toHaveLength(1);
    expect(review.filteredTasks[0].taskName).toBe("Confirm launch tier and scope");
    expect(review.activeFilters).toEqual([
      { key: "status", label: "Status", value: "Watch" },
      { key: "risk", label: "Risk", value: "Needs attention" },
      { key: "handoffRelevance", label: "Handoff", value: "Has handoff" },
      { key: "sourceFreshness", label: "Source freshness", value: "Watch" },
    ]);
    expect(review.resultSummary).toBe("1 of 2 timeline tasks match current filters.");
  });

  it("filters and sorts review tasks without mutating the source task list", () => {
    const tasks = getGeneratedTasks();
    const review = buildLaunchTimelineReview({ tasks });
    const sortedByOwner = sortLaunchTimelineTasks(review.tasks, "owner");
    const filteredByPhase = filterLaunchTimelineTasks(review.tasks, {
      ...defaultLaunchTimelineFilters,
      phase: "Launch",
    });

    expect(sortedByOwner.map((task) => task.ownerLabel)).toEqual([
      "Deployment Lead",
      "Launch PM",
    ]);
    expect(filteredByPhase.map((task) => task.taskName)).toEqual([
      "Complete deployment handoff review",
    ]);
    expect(tasks.map((task) => task.status)).toEqual([
      "not_started",
      "not_started",
    ]);
  });

  it("builds selected task details with dependency context and source links", () => {
    const tasks = getGeneratedTasks();
    const review = buildLaunchTimelineReview({ tasks });
    const details = getLaunchTimelineTaskDetails(
      "task-cardiomax-pb-task-2",
      review.tasks,
    );

    expect(details).toMatchObject({
      dependencyContext: [
        {
          taskId: "task-cardiomax-pb-task-1",
          taskName: "Confirm launch tier and scope",
          timelineStatusLabel: "Watch",
        },
      ],
      linkedRecords: [
        {
          label: "Playbook source",
          url: "/sources#cardiomax-tier-2-playbook",
        },
      ],
      normalizedMetadata: expect.arrayContaining([
        { label: "Phase", value: "Launch" },
        { label: "Owner", value: "Deployment Lead" },
        { label: "Dependencies", value: "Depends on Confirm launch tier and scope" },
        { label: "Source system", value: "Playbook" },
        { label: "Source type", value: "Playbook" },
        { label: "Source approval", value: "Approved" },
        { label: "Source access", value: "Authorized" },
        { label: "Source ingestion", value: "Ready" },
        { label: "Source freshness", value: "Watch" },
      ]),
      taskName: "Complete deployment handoff review",
    });
  });

  it("adapts ingested launch task records into reviewable timeline tasks", () => {
    const ingestedTasks = normalizeIngestedLaunchTimelineTasks([
      buildIngestedTaskRecord({
        sourceUrl: undefined,
      }),
    ]);
    const review = buildLaunchTimelineReview({ tasks: ingestedTasks });
    const details = getLaunchTimelineTaskDetails(
      "task-readiness-review",
      review.tasks,
    );

    expect(review.tasks).toEqual([
      expect.objectContaining({
        dependencySummary: "No dependencies",
        dueDateLabel: "T-14",
        handoffRelevance: "Deployment readiness",
        ownerLabel: "Project Manager",
        sourceFreshnessLabel: "Fresh",
        timelineStatus: "watch",
      }),
    ]);
    expect(details?.linkedRecords).toEqual([
      {
        label: "Handoff workspace",
        url: "/handoff",
      },
    ]);
    expect(details?.normalizedMetadata).toEqual(
      expect.arrayContaining([
        { label: "Source", value: "Ingested launch task list" },
        { label: "Source system", value: "Launch task" },
        { label: "Source type", value: "Launch task" },
        { label: "Source approval", value: "Approved" },
        { label: "Source access", value: "Authorized" },
        { label: "Source ingestion", value: "Complete" },
      ]),
    );
  });

  it("scopes ingested task records by launch and hides restricted rows from non-admins", () => {
    const ingestedTasks = normalizeIngestedLaunchTimelineTasks(
      [
        buildIngestedTaskRecord(),
        buildIngestedTaskRecord({
          launchId: "other-launch",
          taskId: "task-other-launch",
          taskName: "Other launch task",
        }),
        buildIngestedTaskRecord({
          accessState: "restricted",
          approvalState: "restricted",
          launchTaskRecordId: "launchtask-restricted",
          sourceId: "src-restricted-launch-tasks",
          taskId: "task-restricted-ingested",
          taskName: "Restricted ingested task",
        }),
      ],
      {
        launchId: "cardiomax",
        role: "project-manager",
      },
    );
    const adminTasks = normalizeIngestedLaunchTimelineTasks(
      [
        buildIngestedTaskRecord({
          accessState: "restricted",
          approvalState: "restricted",
          taskId: "task-restricted-ingested",
          taskName: "Restricted ingested task",
        }),
      ],
      {
        launchId: "cardiomax",
        role: "admin",
      },
    );

    expect(ingestedTasks.map((task) => task.taskId)).toEqual([
      "task-readiness-review",
    ]);
    expect(JSON.stringify(ingestedTasks)).not.toContain("Restricted ingested task");
    expect(JSON.stringify(ingestedTasks)).not.toContain("Other launch task");
    expect(adminTasks).toEqual([
      expect.objectContaining({
        taskId: "task-restricted-ingested",
        taskName: "Restricted ingested task",
      }),
    ]);
  });

  it("preserves ingested task status and normalizes empty handoff values", () => {
    const ingestedTasks = normalizeIngestedLaunchTimelineTasks([
      buildIngestedTaskRecord({
        criticalPath: false,
        handoffRelevance: "No handoff",
        sourceUrl: undefined,
        taskId: "task-complete-from-status",
        taskName: "Complete from status",
        taskStatus: "complete",
      }),
    ]);
    const review = buildLaunchTimelineReview({
      filters: {
        ...defaultLaunchTimelineFilters,
        handoffRelevance: "has_handoff",
      },
      tasks: ingestedTasks,
    });
    const unfilteredReview = buildLaunchTimelineReview({ tasks: ingestedTasks });
    const details = getLaunchTimelineTaskDetails(
      "task-complete-from-status",
      unfilteredReview.tasks,
    );

    expect(unfilteredReview.tasks[0]).toMatchObject({
      handoffGate: undefined,
      handoffRelevance: "No handoff gate",
      timelineStatus: "complete",
    });
    expect(review.filteredTasks).toEqual([]);
    expect(details?.linkedRecords).toEqual([]);
  });

  it("normalizes linked record URLs before exposing task detail links", () => {
    const ingestedTasks = normalizeIngestedLaunchTimelineTasks([
      buildIngestedTaskRecord({
        handoffRelevance: "No handoff",
        sourceUrl: "javascript:alert(1)",
        taskId: "task-unsafe-link",
        taskName: "Unsafe source link",
      }),
    ]);
    const review = buildLaunchTimelineReview({ tasks: ingestedTasks });
    const details = getLaunchTimelineTaskDetails("task-unsafe-link", review.tasks);

    expect(details?.linkedRecords).toEqual([]);
    expect(JSON.stringify(details)).not.toContain("javascript:");
  });

  it("sorts T-offset due date labels by timeline order", () => {
    const review = buildLaunchTimelineReview({
      tasks: [
        buildTimelineTaskInput({
          dueDateLogic: "T-2",
          taskId: "task-t-minus-2",
          taskName: "T minus two",
        }),
        buildTimelineTaskInput({
          dueDateLogic: "T-14",
          taskId: "task-t-minus-14",
          taskName: "T minus fourteen",
        }),
        buildTimelineTaskInput({
          dueDateLogic: "T+1",
          taskId: "task-t-plus-1",
          taskName: "T plus one",
        }),
      ],
    });

    expect(
      sortLaunchTimelineTasks(review.tasks, "dueDate").map((task) => task.taskId),
    ).toEqual(["task-t-minus-14", "task-t-minus-2", "task-t-plus-1"]);
  });

  it("keeps missing dependency references visible without exposing raw IDs", () => {
    const task = buildTimelineTaskInput({
      dependencyTaskIds: ["raw-missing-dependency-id"],
      taskId: "task-with-missing-dependency",
      taskName: "Task with missing dependency",
    });
    const review = buildLaunchTimelineReview({ tasks: [task] });
    const details = getLaunchTimelineTaskDetails(
      "task-with-missing-dependency",
      review.tasks,
    );

    expect(review.tasks[0].dependencySummary).toBe(
      "Depends on Missing dependency reference",
    );
    expect(details?.dependencyContext).toEqual([
      {
        taskId: "missing-dependency-1",
        taskName: "Missing dependency reference",
        timelineStatusLabel: "Needs source review",
      },
    ]);
    expect(review.tasks[0].dependencySummary).not.toContain(
      "raw-missing-dependency-id",
    );
    expect(JSON.stringify(details)).not.toContain("raw-missing-dependency-id");
  });

  it("surfaces blocked, complete, awaiting-input, and source-stale states", () => {
    const tasks = [
      buildTask({
        status: "blocked",
        taskId: "task-blocked",
        taskName: "Blocked task",
      }),
      buildTask({
        status: "complete",
        taskId: "task-complete",
        taskName: "Complete task",
      }),
      buildTask({
        dueDateLogic: undefined,
        ownerRole: "",
        taskId: "task-awaiting-input",
        taskName: "Missing owner task",
      }),
      buildTask({
        taskId: "task-source-stale",
        taskName: "Stale source task",
        sourceProvenance: {
          freshnessLabel: "Stale",
          freshnessState: "stale",
        } as LaunchTimelineTask["sourceProvenance"],
      }),
    ];
    const review = buildLaunchTimelineReview({ tasks });

    expect(review.tasks.map((task) => task.timelineStatus)).toEqual([
      "blocked",
      "complete",
      "awaiting_input",
      "source_stale",
    ]);
  });

  it("keeps blocker state higher priority than ingested task status", () => {
    const ingestedTasks = normalizeIngestedLaunchTimelineTasks([
      buildIngestedTaskRecord({
        blockerState: "Client kickoff window not confirmed",
        taskStatus: "complete",
      }),
    ]);
    const review = buildLaunchTimelineReview({ tasks: ingestedTasks });

    expect(review.tasks[0]).toMatchObject({
      blockerSummary: "Blocked: Client kickoff window not confirmed",
      timelineStatus: "blocked",
      timelineStatusLabel: "Blocked",
    });
  });

  it("filters source-stale risk from provenance even when another status has precedence", () => {
    const tasks = [
      buildTask({
        status: "blocked",
        taskId: "task-blocked-stale",
        taskName: "Blocked stale source task",
        sourceProvenance: {
          freshnessLabel: "Stale",
          freshnessState: "stale",
        } as LaunchTimelineTask["sourceProvenance"],
      }),
      buildTask({
        status: "complete",
        taskId: "task-complete-stale",
        taskName: "Complete stale source task",
        sourceProvenance: {
          freshnessLabel: "Stale",
          freshnessState: "stale",
        } as LaunchTimelineTask["sourceProvenance"],
      }),
      buildTask({
        taskId: "task-fresh",
        taskName: "Fresh source task",
      }),
    ];
    const review = buildLaunchTimelineReview({
      filters: {
        ...defaultLaunchTimelineFilters,
        risk: "source_stale",
      },
      tasks,
    });

    expect(review.filteredTasks.map((task) => task.taskId)).toEqual([
      "task-blocked-stale",
      "task-complete-stale",
    ]);
  });

  it("filters blockers from structured blocker state instead of display text", () => {
    const review = buildLaunchTimelineReview({
      filters: {
        ...defaultLaunchTimelineFilters,
        blocker: "has_blocker",
      },
      tasks: [
        buildTimelineTaskInput({
          blockerState: "Waiting on client input",
          taskId: "task-structured-blocker",
          taskName: "Structured blocker task",
        }),
        buildTimelineTaskInput({
          blockerState: "none",
          taskId: "task-no-blocker",
          taskName: "No blocker task",
        }),
      ],
    });

    expect(review.filteredTasks).toEqual([
      expect.objectContaining({
        blockerSummary: "Blocker: Waiting on client input",
        hasBlocker: true,
        taskId: "task-structured-blocker",
      }),
    ]);
  });

  it("hides restricted linked source details from non-admin task details", () => {
    const restrictedTask = buildTask({
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
        sourceName: "Restricted source",
        sourceSystemLabel: "Restricted",
        sourceTypeLabel: "Restricted",
      },
      taskId: "task-restricted",
      taskName: "Restricted provenance task",
    });
    const review = buildLaunchTimelineReview({
      role: "project-manager",
      tasks: [restrictedTask],
    });
    const details = getLaunchTimelineTaskDetails("task-restricted", review.tasks);

    expect(details?.linkedRecords).toEqual([]);
    expect(JSON.stringify(details)).not.toContain("Restricted Tier 4 Launch Playbook");
    expect(JSON.stringify(details)).not.toContain("src-restricted-tier-4-playbook");
    expect(JSON.stringify(details)).not.toContain("Commercial Strategy");
  });
});
