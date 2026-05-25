import {
  getLaunchTimelineTaskDetails,
  type LaunchTimelineLinkedRecord,
  type LaunchTimelineTask,
} from "./launch-timeline";
import type { SourceFreshnessState } from "./source-ledger";

export type LaunchRiskAlertStatus =
  | "active"
  | "monitoring"
  | "snoozed"
  | "needs_follow_up"
  | "resolved";

export type LaunchRiskAlertCategory =
  | "delayed_task"
  | "dependency_change"
  | "handoff_risk"
  | "critical_milestone"
  | "source_stale";

export type LaunchRiskAlertSeverity = "watch" | "at_risk" | "critical";

export type LaunchRiskAlert = {
  affectedStakeholders: string[];
  affectedTasks: string[];
  alertId: string;
  category: LaunchRiskAlertCategory;
  confidenceLabel: string;
  dependencyContext: LaunchRiskDependencyContext[];
  dependencyTaskIds: string[];
  freshnessLabel: string;
  handoffLabel?: string;
  launchId: string;
  linkedRecords: LaunchTimelineLinkedRecord[];
  milestoneLabel?: string;
  recommendedAction: string;
  severity: LaunchRiskAlertSeverity;
  sourceSignal: LaunchRiskSourceSignal;
  status: LaunchRiskAlertStatus;
  taskId: string;
  taskName: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
};

export type LaunchRiskDependencyContext = {
  linkedRecords: LaunchTimelineLinkedRecord[];
  taskId: string;
  taskName: string;
  timelineStatusLabel: string;
};

export type LaunchRiskSourceSignal = {
  freshnessLabel: string;
  freshnessState: SourceFreshnessState;
  sourceId?: string;
  sourceName: string;
  sourceSystemLabel: string;
};

export type LaunchRiskAuditEventType =
  | "task.risk_detected"
  | "task.risk_status_updated";

export type LaunchRiskAuditEvent = {
  actorId?: string;
  correlationId: string;
  eventId: string;
  eventType: LaunchRiskAuditEventType;
  launchId: string;
  metadata: {
    alertId: string;
    alertStatus: LaunchRiskAlertStatus;
    category: LaunchRiskAlertCategory;
    confidenceLabel: string;
    dependencyTaskIds: string[];
    freshnessLabel: string;
    previousStatus?: LaunchRiskAlertStatus;
    severity: LaunchRiskAlertSeverity;
    sourceId?: string;
    taskId: string;
  };
  occurredAt: string;
  systemActor?: string;
};

type BuildLaunchRiskAlertsInput = {
  tasks: LaunchTimelineTask[];
};

type BuildLaunchRiskDetectedAuditEventInput = {
  actorId?: string;
  alert: LaunchRiskAlert;
  correlationId?: string;
  occurredAt?: string;
  systemActor?: string;
};

type ApplyLaunchRiskAlertActionInput = {
  actorId?: string;
  alert: LaunchRiskAlert;
  correlationId?: string;
  occurredAt?: string;
  status: Exclude<LaunchRiskAlertStatus, "active">;
  systemActor?: string;
};

export const launchRiskAlertStatusLabels: Record<
  LaunchRiskAlertStatus,
  string
> = {
  active: "Active",
  monitoring: "Monitoring",
  needs_follow_up: "Needs follow-up",
  resolved: "Resolved",
  snoozed: "Snoozed",
};

const severityRank: Record<LaunchRiskAlertSeverity, number> = {
  critical: 0,
  at_risk: 1,
  watch: 2,
};

export function buildLaunchRiskAlerts({
  tasks,
}: BuildLaunchRiskAlertsInput): LaunchRiskAlert[] {
  const primaryAlerts: LaunchRiskAlert[] = [];
  const dependencyAlerts: LaunchRiskAlert[] = [];
  const freshnessAlerts: LaunchRiskAlert[] = [];
  const watchAlerts: LaunchRiskAlert[] = [];

  for (const task of tasks) {
    if (task.timelineStatus === "complete") {
      continue;
    }

    if (task.timelineStatus === "blocked" || task.timelineStatus === "at_risk") {
      primaryAlerts.push(buildPrimaryRiskAlert(task, tasks));
      continue;
    }

    if (hasSourceFreshnessRisk(task)) {
      freshnessAlerts.push(buildSourceFreshnessAlert(task, tasks));
      continue;
    }

    if (task.criticalPath || hasHandoffGate(task)) {
      watchAlerts.push(buildWatchAlert(task, tasks));
    }
  }

  for (const task of tasks) {
    const riskyDependencies = task.dependencyTaskIds
      .map((dependencyTaskId) =>
        tasks.find((candidate) => candidate.taskId === dependencyTaskId),
      )
      .filter((dependency): dependency is LaunchTimelineTask => {
        if (!dependency) {
          return false;
        }

        return dependencyHasImpactRisk(dependency);
      });

    if (riskyDependencies.length > 0) {
      dependencyAlerts.push(
        buildDependencyImpactAlert(task, riskyDependencies, tasks),
      );
    }
  }

  return [
    ...primaryAlerts,
    ...dependencyAlerts,
    ...freshnessAlerts,
    ...watchAlerts,
  ];
}

export function buildLaunchRiskDetectedAuditEvent({
  actorId,
  alert,
  correlationId = createUniqueCorrelationId(alert.alertId),
  occurredAt = createTimestamp(),
  systemActor = actorId ? undefined : "risk-detection-service",
}: BuildLaunchRiskDetectedAuditEventInput): LaunchRiskAuditEvent {
  return buildLaunchRiskAuditEvent({
    actorId,
    alert,
    correlationId,
    eventType: "task.risk_detected",
    occurredAt,
    systemActor,
  });
}

export function applyLaunchRiskAlertAction({
  actorId,
  alert,
  correlationId = createUniqueCorrelationId(`${alert.alertId}-action`),
  occurredAt = createTimestamp(),
  status,
  systemActor,
}: ApplyLaunchRiskAlertActionInput): {
  alert: LaunchRiskAlert;
  auditEvent: LaunchRiskAuditEvent;
} {
  const updatedAlert: LaunchRiskAlert = {
    ...alert,
    status,
  };

  return {
    alert: updatedAlert,
    auditEvent: buildLaunchRiskAuditEvent({
      actorId,
      alert: updatedAlert,
      correlationId,
      eventType: "task.risk_status_updated",
      occurredAt,
      previousStatus: alert.status,
      systemActor,
    }),
  };
}

function buildPrimaryRiskAlert(
  task: LaunchTimelineTask,
  allTasks: LaunchTimelineTask[],
): LaunchRiskAlert {
  const category = getPrimaryRiskCategory(task);
  const severity = getPrimaryRiskSeverity(task);
  const dependentTasks = getDependentTasks(task, allTasks);

  return buildAlert({
    affectedTasks: dependentTasks.map((dependentTask) => dependentTask.taskName),
    category,
    severity,
    task,
    title: getPrimaryRiskTitle(task, category),
    whatChanged: `${task.timelineStatusLabel} signal on ${task.taskName}. ${task.blockerSummary}.`,
    whyItMatters: getPrimaryRiskImpact(task, dependentTasks),
    recommendedAction: getRecommendedAction(category),
    allTasks,
  });
}

function buildDependencyImpactAlert(
  task: LaunchTimelineTask,
  riskyDependencies: LaunchTimelineTask[],
  allTasks: LaunchTimelineTask[],
): LaunchRiskAlert {
  const severity = getHighestSeverity(
    riskyDependencies.map(getDependencyRiskSeverity),
  );
  const dependencyNames = riskyDependencies.map(
    (dependency) => dependency.taskName,
  );
  const signalTask = getHighestRiskTask(riskyDependencies);

  return buildAlert({
    affectedTasks: dependencyNames,
    category: "dependency_change",
    dependencyContext: riskyDependencies.map((dependency) =>
      getDependencyContext(dependency, allTasks),
    ),
    dependencyTaskIds: riskyDependencies.map((dependency) => dependency.taskId),
    severity,
    signalTask,
    task,
    title: `Review dependency impact for ${task.taskName}`,
    whatChanged: `${joinList(dependencyNames)} ${dependencyNames.length === 1 ? "has" : "have"} a risk signal.`,
    whyItMatters: `${task.taskName} depends on ${joinList(dependencyNames)}, so launch timing or receiving-team readiness may shift if the dependency is not cleared.`,
    recommendedAction:
      "Check the dependency owner and confirm whether the dependent task date or handoff plan needs to change.",
    allTasks,
  });
}

function buildSourceFreshnessAlert(
  task: LaunchTimelineTask,
  allTasks: LaunchTimelineTask[],
): LaunchRiskAlert {
  return buildAlert({
    affectedTasks: [task.taskName],
    category: "source_stale",
    severity: task.criticalPath || hasHandoffGate(task) ? "at_risk" : "watch",
    task,
    title: `Review source freshness for ${task.taskName}`,
    whatChanged: `${task.taskName} is using ${task.sourceFreshnessLabel.toLowerCase()} source data.`,
    whyItMatters:
      "Launch decisions may be based on older execution status until the source is refreshed or confirmed.",
    recommendedAction:
      "Open the source record if available and confirm whether the latest task status is still accurate.",
    allTasks,
  });
}

function buildWatchAlert(
  task: LaunchTimelineTask,
  allTasks: LaunchTimelineTask[],
): LaunchRiskAlert {
  const category = task.criticalPath ? "critical_milestone" : "handoff_risk";

  return buildAlert({
    affectedTasks: [task.taskName],
    category,
    severity: "watch",
    task,
    title: getPrimaryRiskTitle(task, category),
    whatChanged: `${task.taskName} is on the ${task.criticalPath ? "critical path" : "handoff path"}.`,
    whyItMatters: task.criticalPath
      ? "A change to this task can affect launch milestones or downstream task timing."
      : "A change to this task can affect the receiving team or handoff readiness.",
    recommendedAction: getRecommendedAction(category),
    allTasks,
  });
}

function buildAlert({
  affectedTasks,
  allTasks,
  category,
  dependencyContext = [],
  dependencyTaskIds = [],
  recommendedAction,
  severity,
  signalTask,
  task,
  title,
  whatChanged,
  whyItMatters,
}: {
  affectedTasks: string[];
  allTasks: LaunchTimelineTask[];
  category: LaunchRiskAlertCategory;
  dependencyContext?: LaunchRiskDependencyContext[];
  dependencyTaskIds?: string[];
  recommendedAction: string;
  severity: LaunchRiskAlertSeverity;
  signalTask?: LaunchTimelineTask;
  task: LaunchTimelineTask;
  title: string;
  whatChanged: string;
  whyItMatters: string;
}): LaunchRiskAlert {
  const sourceSignal = getSourceSignal(signalTask ?? task);
  const dependencyKey = dependencyTaskIds.length
    ? `-${dependencyTaskIds.join("-")}`
    : "";

  return {
    affectedStakeholders: getAffectedStakeholders(task),
    affectedTasks,
    alertId: createId(
      "risk",
      `${task.launchId}-${task.taskId}-${category}${dependencyKey}`,
    ),
    category,
    confidenceLabel: `Confidence: ${getConfidence(severity, category)}`,
    dependencyContext,
    dependencyTaskIds,
    freshnessLabel: `Freshness: ${sourceSignal.freshnessLabel}`,
    handoffLabel: hasHandoffGate(task) ? task.handoffRelevance : undefined,
    launchId: task.launchId,
    linkedRecords: getAlertLinkedRecords(task, dependencyContext, allTasks),
    milestoneLabel: task.phase,
    recommendedAction,
    severity,
    sourceSignal,
    status: "active",
    taskId: task.taskId,
    taskName: task.taskName,
    title,
    whatChanged,
    whyItMatters,
  };
}

function buildLaunchRiskAuditEvent({
  actorId,
  alert,
  correlationId,
  eventType,
  occurredAt,
  previousStatus,
  systemActor,
}: {
  actorId?: string;
  alert: LaunchRiskAlert;
  correlationId: string;
  eventType: LaunchRiskAuditEventType;
  occurredAt: string;
  previousStatus?: LaunchRiskAlertStatus;
  systemActor?: string;
}): LaunchRiskAuditEvent {
  return {
    actorId,
    correlationId,
    eventId: createId("evt", `${correlationId}-${eventType}-${alert.alertId}`),
    eventType,
    launchId: alert.launchId,
    metadata: {
      alertId: alert.alertId,
      alertStatus: alert.status,
      category: alert.category,
      confidenceLabel: alert.confidenceLabel,
      dependencyTaskIds: alert.dependencyTaskIds,
      freshnessLabel: alert.freshnessLabel,
      previousStatus,
      severity: alert.severity,
      sourceId: alert.sourceSignal.sourceId,
      taskId: alert.taskId,
    },
    occurredAt,
    systemActor,
  };
}

function getPrimaryRiskCategory(
  task: LaunchTimelineTask,
): LaunchRiskAlertCategory {
  if (hasHandoffGate(task)) {
    return "handoff_risk";
  }

  if (task.criticalPath) {
    return "critical_milestone";
  }

  return "delayed_task";
}

function getPrimaryRiskSeverity(task: LaunchTimelineTask): LaunchRiskAlertSeverity {
  if (task.timelineStatus === "blocked" && (task.criticalPath || hasHandoffGate(task))) {
    return "critical";
  }

  if (task.timelineStatus === "blocked" || task.timelineStatus === "at_risk") {
    return "at_risk";
  }

  return "watch";
}

function getDependencyRiskSeverity(
  task: LaunchTimelineTask,
): LaunchRiskAlertSeverity {
  if (task.timelineStatus === "blocked") {
    return task.criticalPath || hasHandoffGate(task) ? "critical" : "at_risk";
  }

  if (task.timelineStatus === "at_risk" || hasSourceFreshnessRisk(task)) {
    return "at_risk";
  }

  return "watch";
}

function getHighestSeverity(severities: LaunchRiskAlertSeverity[]) {
  return [...severities].sort(
    (left, right) => severityRank[left] - severityRank[right],
  )[0] ?? "watch";
}

function getHighestRiskTask(tasks: LaunchTimelineTask[]) {
  return [...tasks].sort(
    (left, right) =>
      severityRank[getDependencyRiskSeverity(left)] -
        severityRank[getDependencyRiskSeverity(right)] ||
      left.taskName.localeCompare(right.taskName),
  )[0];
}

function getPrimaryRiskTitle(
  task: LaunchTimelineTask,
  category: LaunchRiskAlertCategory,
) {
  if (category === "handoff_risk") {
    return `Review handoff risk for ${task.taskName}`;
  }

  if (category === "critical_milestone") {
    return `Review critical milestone risk for ${task.taskName}`;
  }

  return `Review delayed task risk for ${task.taskName}`;
}

function getPrimaryRiskImpact(
  task: LaunchTimelineTask,
  dependentTasks: LaunchTimelineTask[],
) {
  if (hasHandoffGate(task)) {
    return `This task supports the ${task.handoffRelevance} handoff, so a delay can affect the receiving team or launch readiness.`;
  }

  if (task.criticalPath) {
    return "This task is on the critical path, so a delay can affect launch milestones or downstream timing.";
  }

  if (dependentTasks.length > 0) {
    return `${joinList(dependentTasks.map((dependentTask) => dependentTask.taskName))} depends on this task.`;
  }

  return "This task may affect launch execution timing if it is not cleared.";
}

function getRecommendedAction(category: LaunchRiskAlertCategory) {
  if (category === "handoff_risk") {
    return "Confirm the blocker owner, expected unblock date, and handoff readiness before the next launch checkpoint.";
  }

  if (category === "critical_milestone") {
    return "Confirm owner, date confidence, and downstream milestone impact before the next launch checkpoint.";
  }

  if (category === "source_stale") {
    return "Refresh or confirm the source status before making timing decisions.";
  }

  return "Confirm the current task owner, blocker, and expected completion timing.";
}

function dependencyHasImpactRisk(task: LaunchTimelineTask) {
  return (
    task.timelineStatus === "blocked" ||
    task.timelineStatus === "at_risk" ||
    hasSourceFreshnessRisk(task)
  );
}

function hasSourceFreshnessRisk(task: LaunchTimelineTask) {
  return (
    task.timelineStatus === "source_stale" ||
    task.sourceProvenance.freshnessState === "stale" ||
    task.sourceProvenance.freshnessState === "restricted"
  );
}

function hasHandoffGate(task: LaunchTimelineTask) {
  return task.handoffRelevance !== "No handoff gate";
}

function getDependentTasks(
  task: LaunchTimelineTask,
  allTasks: LaunchTimelineTask[],
) {
  return allTasks.filter((candidate) =>
    candidate.dependencyTaskIds.includes(task.taskId),
  );
}

function getDependencyContext(
  task: LaunchTimelineTask,
  allTasks: LaunchTimelineTask[],
): LaunchRiskDependencyContext {
  return {
    linkedRecords:
      getLaunchTimelineTaskDetails(task.taskId, allTasks)?.linkedRecords ?? [],
    taskId: task.taskId,
    taskName: task.taskName,
    timelineStatusLabel: task.timelineStatusLabel,
  };
}

function getAlertLinkedRecords(
  task: LaunchTimelineTask,
  dependencyContext: LaunchRiskDependencyContext[],
  allTasks: LaunchTimelineTask[],
) {
  const records = [
    ...(getLaunchTimelineTaskDetails(task.taskId, allTasks)?.linkedRecords ?? []),
    ...dependencyContext.flatMap((dependency) => dependency.linkedRecords),
  ];
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = `${record.label}:${record.url}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getAffectedStakeholders(task: LaunchTimelineTask) {
  return task.ownerLabel === "Unassigned" ? [] : [task.ownerLabel];
}

function getSourceSignal(task: LaunchTimelineTask): LaunchRiskSourceSignal {
  return {
    freshnessLabel: task.sourceProvenance.freshnessLabel,
    freshnessState: task.sourceProvenance.freshnessState,
    sourceId: task.sourceProvenance.sourceId,
    sourceName: task.sourceProvenance.sourceName,
    sourceSystemLabel: task.sourceProvenance.sourceSystemLabel,
  };
}

function getConfidence(
  severity: LaunchRiskAlertSeverity,
  category: LaunchRiskAlertCategory,
) {
  if (severity === "critical" || category === "dependency_change") {
    return "high";
  }

  if (category === "source_stale" || severity === "at_risk") {
    return "medium";
  }

  return "low";
}

function createTimestamp() {
  return new Date().toISOString();
}

function createId(prefix: string, seed: string) {
  const normalizedSeed =
    seed
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "id";

  return `${prefix}-${normalizedSeed}-${createSeedHash(seed)}`;
}

function createSeedHash(seed: string) {
  let hash = 5381;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function createUniqueSeed() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createUniqueCorrelationId(seed: string) {
  return createId("corr", `${seed}-${createUniqueSeed()}`);
}

function joinList(items: string[]) {
  if (items.length === 0) {
    return "No linked tasks";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
