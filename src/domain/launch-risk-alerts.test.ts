import { describe, expect, it } from "vitest";

import {
  createPrototypeLaunchPlanSources,
  generateLaunchPlanFromPlaybook,
  type GeneratedLaunchTask,
  type LaunchPlanSetupInput,
} from "./launch-plan";
import {
  buildLaunchTimelineReview,
  normalizeIngestedLaunchTimelineTasks,
  type LaunchTimelineTaskInput,
} from "./launch-timeline";
import {
  applyLaunchRiskAlertAction,
  buildLaunchRiskAlerts,
  buildLaunchRiskDetectedAuditEvent,
  launchRiskAlertStatusLabels,
} from "./launch-risk-alerts";
import { createPrototypeSmartsheetStatusTasks } from "./smartsheet-status";

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

function buildReviewTasks(tasks: LaunchTimelineTaskInput[]) {
  return buildLaunchTimelineReview({
    tasks,
  }).tasks;
}

describe("launch risk alert domain", () => {
  it("detects blocked, dependency-impact, and source-stale alerts from timeline tasks", () => {
    const smartsheetTasks = normalizeIngestedLaunchTimelineTasks(
      createPrototypeSmartsheetStatusTasks(),
      {
        launchId: "cardiomax",
        role: "project-manager",
      },
    );
    const alerts = buildLaunchRiskAlerts({
      tasks: buildReviewTasks(smartsheetTasks),
    });

    expect(launchRiskAlertStatusLabels).toMatchObject({
      active: "Active",
      monitoring: "Monitoring",
      needs_follow_up: "Needs follow-up",
      resolved: "Resolved",
      snoozed: "Snoozed",
    });
    expect(alerts.map((alert) => alert.category)).toEqual([
      "handoff_risk",
      "dependency_change",
      "source_stale",
    ]);
    expect(alerts[0]).toMatchObject({
      affectedStakeholders: ["Deployment Lead"],
      category: "handoff_risk",
      confidenceLabel: "Confidence: high",
      freshnessLabel: "Freshness: Watch",
      recommendedAction:
        "Confirm the blocker owner, expected unblock date, and handoff readiness before the next launch checkpoint.",
      severity: "critical",
      sourceSignal: {
        freshnessLabel: "Watch",
        sourceId: "src-cardiomax-smartsheet-approved-status",
        sourceSystemLabel: "Smartsheet",
      },
      status: "active",
      taskId: "smartsheet-task-readiness-review",
      taskName: "Resolve deployment readiness blockers",
    });
    expect(alerts[0].title).toBe(
      "Review handoff risk for Resolve deployment readiness blockers",
    );
    expect(alerts[0].whatChanged).toContain("Blocked");
    expect(alerts[0].whyItMatters).toContain("handoff");
    expect(alerts[0].linkedRecords).toEqual(
      expect.arrayContaining([
        {
          label: "Smartsheet source",
          url: "/sources#cardiomax-approved-smartsheet-status",
        },
        {
          label: "Handoff workspace",
          url: "/handoff",
        },
      ]),
    );

    expect(alerts[1]).toMatchObject({
      affectedTasks: ["Resolve deployment readiness blockers"],
      category: "dependency_change",
      dependencyContext: [
        expect.objectContaining({
          taskName: "Resolve deployment readiness blockers",
          timelineStatusLabel: "Blocked",
        }),
      ],
      dependencyTaskIds: ["smartsheet-task-readiness-review"],
      freshnessLabel: "Freshness: Watch",
      sourceSignal: {
        freshnessLabel: "Watch",
        sourceId: "src-cardiomax-smartsheet-approved-status",
        sourceSystemLabel: "Smartsheet",
      },
      taskId: "smartsheet-task-training-assets",
    });
    expect(alerts[1].whyItMatters).toContain("depends on");

    expect(alerts[2]).toMatchObject({
      category: "source_stale",
      freshnessLabel: "Freshness: Stale",
      taskId: "smartsheet-task-training-assets",
    });
  });

  it("uses the risky dependency source as dependency-impact alert provenance", () => {
    const tasks = buildReviewTasks([
      buildTask({
        criticalPath: false,
        dependencyTaskIds: [],
        handoffGate: undefined,
        sourceProvenance: {
          freshnessLabel: "Watch",
          freshnessState: "watch",
          sourceId: "src-risky-dependency",
          sourceName: "Risky dependency source",
        } as GeneratedLaunchTask["sourceProvenance"],
        status: "blocked",
        taskId: "task-risky-dependency",
        taskName: "Risky dependency",
      }),
      buildTask({
        criticalPath: false,
        dependencyTaskIds: ["task-risky-dependency"],
        handoffGate: undefined,
        sourceProvenance: {
          freshnessLabel: "Fresh",
          freshnessState: "fresh",
          sourceId: "src-dependent-work",
          sourceName: "Dependent work source",
        } as GeneratedLaunchTask["sourceProvenance"],
        status: "not_started",
        taskId: "task-dependent-work",
        taskName: "Dependent work",
      }),
    ]);
    const dependencyAlert = buildLaunchRiskAlerts({ tasks }).find(
      (alert) => alert.category === "dependency_change",
    );
    const event = buildLaunchRiskDetectedAuditEvent({
      alert: dependencyAlert!,
      correlationId: "corr-dependency-risk-1",
      occurredAt: "2026-05-25T13:00:00.000Z",
    });

    expect(dependencyAlert).toMatchObject({
      category: "dependency_change",
      dependencyContext: [
        expect.objectContaining({
          taskName: "Risky dependency",
          timelineStatusLabel: "Blocked",
        }),
      ],
      freshnessLabel: "Freshness: Watch",
      sourceSignal: {
        freshnessLabel: "Watch",
        sourceId: "src-risky-dependency",
        sourceName: "Risky dependency source",
      },
      taskId: "task-dependent-work",
    });
    expect(event.metadata).toMatchObject({
      dependencyTaskIds: ["task-risky-dependency"],
      sourceId: "src-risky-dependency",
      taskId: "task-dependent-work",
    });
  });

  it("creates deterministic audit events for detected and actioned risk alerts", () => {
    const [alert] = buildLaunchRiskAlerts({
      tasks: buildReviewTasks([
        buildTask({
          status: "blocked",
          taskId: "task-blocked-critical",
          taskName: "Confirm launch readiness",
        }),
      ]),
    });
    const detectedEvent = buildLaunchRiskDetectedAuditEvent({
      alert,
      correlationId: "corr-risk-1",
      occurredAt: "2026-05-25T12:00:00.000Z",
      systemActor: "risk-detection-service",
    });
    const actionResult = applyLaunchRiskAlertAction({
      actorId: "CeCe Rivera",
      alert,
      correlationId: "corr-risk-action-1",
      occurredAt: "2026-05-25T12:10:00.000Z",
      status: "monitoring",
    });

    expect(detectedEvent).toMatchObject({
      correlationId: "corr-risk-1",
      eventType: "task.risk_detected",
      launchId: "cardiomax",
      metadata: {
        alertId: alert.alertId,
        alertStatus: "active",
        category: alert.category,
        confidenceLabel: alert.confidenceLabel,
        freshnessLabel: alert.freshnessLabel,
        severity: alert.severity,
        sourceId: "src-cardiomax-tier-2-playbook",
        taskId: "task-blocked-critical",
      },
      occurredAt: "2026-05-25T12:00:00.000Z",
      systemActor: "risk-detection-service",
    });
    expect(actionResult.alert).toMatchObject({
      alertId: alert.alertId,
      status: "monitoring",
      sourceSignal: alert.sourceSignal,
    });
    expect(actionResult.auditEvent).toMatchObject({
      actorId: "CeCe Rivera",
      correlationId: "corr-risk-action-1",
      eventType: "task.risk_status_updated",
      metadata: {
        alertStatus: "monitoring",
        previousStatus: "active",
        taskId: "task-blocked-critical",
      },
      occurredAt: "2026-05-25T12:10:00.000Z",
    });
  });

  it("surfaces critical-path watch risk without generic alerts for routine tasks", () => {
    const criticalPathAlerts = buildLaunchRiskAlerts({
      tasks: buildReviewTasks([
        buildTask({
          criticalPath: true,
          handoffGate: undefined,
          sourceProvenance: {
            freshnessLabel: "Fresh",
            freshnessState: "fresh",
          } as GeneratedLaunchTask["sourceProvenance"],
          status: "not_started",
          taskId: "task-critical-watch",
          taskName: "Confirm critical milestone",
        }),
      ]),
    });
    const routineAlerts = buildLaunchRiskAlerts({
      tasks: buildReviewTasks([
        buildTask({
          criticalPath: false,
          dependencyTaskIds: [],
          handoffGate: undefined,
          sourceProvenance: {
            freshnessLabel: "Fresh",
            freshnessState: "fresh",
          } as GeneratedLaunchTask["sourceProvenance"],
          status: "not_started",
          taskId: "task-routine",
          taskName: "Routine task",
        }),
      ]),
    });

    expect(criticalPathAlerts).toEqual([
      expect.objectContaining({
        category: "critical_milestone",
        severity: "watch",
        taskId: "task-critical-watch",
      }),
    ]);
    expect(routineAlerts).toEqual([]);
  });

  it("keeps restricted linked source details out of alert details", () => {
    const alerts = buildLaunchRiskAlerts({
      tasks: buildLaunchTimelineReview({
        role: "project-manager",
        tasks: [
          buildTask({
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
              sourceUrl: "javascript:alert(1)",
            },
            status: "blocked",
            taskId: "task-restricted-risk",
            taskName: "Restricted provenance task",
          }),
        ],
      }).tasks,
    });

    expect(alerts[0].linkedRecords).toEqual([]);
    expect(JSON.stringify(alerts)).not.toContain("javascript:");
    expect(JSON.stringify(alerts)).not.toContain("Commercial Strategy");
    expect(JSON.stringify(alerts)).not.toContain("src-restricted-tier-4-playbook");
  });
});
