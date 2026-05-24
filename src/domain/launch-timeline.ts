import {
  type NormalizedLaunchTaskRecord,
} from "./launch-artifact-ingestion";
import {
  type LaunchTaskStatus,
  type LaunchPlanSourceProvenance,
} from "./launch-plan";
import {
  accessStateLabels,
  approvalStateLabels,
  freshnessStateLabels,
  ingestionStatusLabels,
  sourceSystemLabels,
  sourceTypeLabels,
  type SourceFreshnessState,
} from "./source-ledger";
import type { WorkspaceRole } from "./workspace";

export type LaunchTimelineTaskStatus =
  | "on_track"
  | "watch"
  | "at_risk"
  | "blocked"
  | "complete"
  | "awaiting_input"
  | "source_stale";

export type LaunchTimelineRiskFilter =
  | ""
  | "attention"
  | "critical_path"
  | "blocker"
  | "dependency"
  | "handoff"
  | "source_stale";

export type LaunchTimelineBlockerFilter = "" | "has_blocker" | "none";
export type LaunchTimelineHandoffFilter = "" | "has_handoff" | "none";
export type LaunchTimelineSortKey =
  | "phase"
  | "owner"
  | "status"
  | "dueDate"
  | "sourceFreshness";

export type LaunchTimelineFilters = {
  blocker: LaunchTimelineBlockerFilter;
  dueDate: string;
  handoffRelevance: LaunchTimelineHandoffFilter;
  owner: string;
  phase: string;
  risk: LaunchTimelineRiskFilter;
  sourceFreshness: SourceFreshnessState | "";
  status: LaunchTimelineTaskStatus | "";
};

export type LaunchTimelineActiveFilter = {
  key: keyof LaunchTimelineFilters;
  label: string;
  value: string;
};

export type LaunchTimelineTaskInput = {
  blockerState?: string;
  criticalPath: boolean;
  dependencyTaskIds: string[];
  dueDateLogic?: string;
  handoffGate?: string;
  handoffRecordUrl?: string;
  launchId: string;
  ownerRole: string;
  phase: string;
  sourceProvenance: LaunchPlanSourceProvenance;
  status: LaunchTaskStatus;
  taskId: string;
  taskName: string;
};

export type LaunchTimelineTask = LaunchTimelineTaskInput & {
  attentionSignals: string[];
  blockerSummary: string;
  canOpenHandoffRecord: boolean;
  canOpenSourceRecord: boolean;
  criticalPathLabel: string;
  dependencySummary: string;
  dueDateLabel: string;
  hasBlocker: boolean;
  handoffRelevance: string;
  ownerLabel: string;
  sourceFreshnessLabel: string;
  timelineStatus: LaunchTimelineTaskStatus;
  timelineStatusLabel: string;
};

export type LaunchTimelinePhaseGroup = {
  phase: string;
  tasks: LaunchTimelineTask[];
};

export type LaunchTimelineFilterOptions = {
  dueDates: string[];
  owners: string[];
  phases: string[];
  sourceFreshnessStates: SourceFreshnessState[];
  statuses: LaunchTimelineTaskStatus[];
};

export type LaunchTimelineReview = {
  activeFilters: LaunchTimelineActiveFilter[];
  filteredTasks: LaunchTimelineTask[];
  filterOptions: LaunchTimelineFilterOptions;
  phaseGroups: LaunchTimelinePhaseGroup[];
  resultSummary: string;
  statusCounts: Record<LaunchTimelineTaskStatus, number>;
  tasks: LaunchTimelineTask[];
};

export type LaunchTimelineLinkedRecord = {
  label: string;
  url: string;
};

export type LaunchTimelineTaskDetail = {
  dependencyContext: Array<{
    taskId: string;
    taskName: string;
    timelineStatusLabel: string;
  }>;
  linkedRecords: LaunchTimelineLinkedRecord[];
  normalizedMetadata: Array<{
    label: string;
    value: string;
  }>;
  taskId: string;
  taskName: string;
};

type BuildLaunchTimelineReviewInput = {
  filters?: LaunchTimelineFilters;
  role?: WorkspaceRole;
  sortKey?: LaunchTimelineSortKey;
  tasks: LaunchTimelineTaskInput[];
};

export const timelineTaskStatusLabels: Record<
  LaunchTimelineTaskStatus,
  string
> = {
  at_risk: "At risk",
  awaiting_input: "Awaiting input",
  blocked: "Blocked",
  complete: "Complete",
  on_track: "On track",
  source_stale: "Source-stale",
  watch: "Watch",
};

export const defaultLaunchTimelineFilters: LaunchTimelineFilters = {
  blocker: "",
  dueDate: "",
  handoffRelevance: "",
  owner: "",
  phase: "",
  risk: "",
  sourceFreshness: "",
  status: "",
};

export function normalizeIngestedLaunchTimelineTasks(
  records: NormalizedLaunchTaskRecord[],
  { role = "project-manager" }: { role?: WorkspaceRole } = {},
): LaunchTimelineTaskInput[] {
  return records.map((record) => ({
    blockerState: record.blockerState,
    criticalPath: record.criticalPath,
    dependencyTaskIds: record.dependencyIds,
    dueDateLogic: record.dueDateLabel ?? record.dueDateRule,
    handoffGate: record.handoffRelevance,
    handoffRecordUrl: record.handoffRelevance ? "/handoff" : undefined,
    launchId: record.launchId ?? "",
    ownerRole: record.ownerRole ?? record.ownerName ?? "",
    phase: record.phase,
    sourceProvenance: getIngestedTaskSourceProvenance(record, role),
    status: getIngestedLaunchTaskStatus(record),
    taskId: record.taskId,
    taskName: record.taskName,
  }));
}

const statusSortOrder: Record<LaunchTimelineTaskStatus, number> = {
  blocked: 0,
  at_risk: 1,
  source_stale: 2,
  awaiting_input: 3,
  watch: 4,
  on_track: 5,
  complete: 6,
};

export function buildLaunchTimelineReview({
  filters = defaultLaunchTimelineFilters,
  role = "project-manager",
  sortKey = "phase",
  tasks,
}: BuildLaunchTimelineReviewInput): LaunchTimelineReview {
  const timelineTasks = tasks.map((task) =>
    buildLaunchTimelineTask(task, tasks, role),
  );
  const filteredTasks = sortLaunchTimelineTasks(
    filterLaunchTimelineTasks(timelineTasks, filters),
    sortKey,
  );
  const activeFilters = getActiveLaunchTimelineFilters(filters);

  return {
    activeFilters,
    filteredTasks,
    filterOptions: getLaunchTimelineFilterOptions(timelineTasks),
    phaseGroups: groupLaunchTimelineTasksByPhase(filteredTasks),
    resultSummary: getTimelineResultSummary({
      activeFilterCount: activeFilters.length,
      filteredCount: filteredTasks.length,
      totalCount: timelineTasks.length,
    }),
    statusCounts: getLaunchTimelineStatusCounts(timelineTasks),
    tasks: timelineTasks,
  };
}

export function filterLaunchTimelineTasks(
  tasks: LaunchTimelineTask[],
  filters: LaunchTimelineFilters,
): LaunchTimelineTask[] {
  return tasks.filter((task) => {
    if (filters.phase && task.phase !== filters.phase) {
      return false;
    }

    if (filters.owner && task.ownerLabel !== filters.owner) {
      return false;
    }

    if (filters.status && task.timelineStatus !== filters.status) {
      return false;
    }

    if (
      filters.sourceFreshness &&
      task.sourceProvenance.freshnessState !== filters.sourceFreshness
    ) {
      return false;
    }

    if (filters.dueDate && task.dueDateLabel !== filters.dueDate) {
      return false;
    }

    if (filters.blocker === "has_blocker" && !taskHasBlocker(task)) {
      return false;
    }

    if (filters.blocker === "none" && taskHasBlocker(task)) {
      return false;
    }

    if (
      filters.handoffRelevance === "has_handoff" &&
      !task.handoffGate
    ) {
      return false;
    }

    if (filters.handoffRelevance === "none" && task.handoffGate) {
      return false;
    }

    return taskMatchesRiskFilter(task, filters.risk);
  });
}

export function sortLaunchTimelineTasks(
  tasks: LaunchTimelineTask[],
  sortKey: LaunchTimelineSortKey,
): LaunchTimelineTask[] {
  if (sortKey === "phase") {
    return [...tasks];
  }

  return [...tasks].sort((left, right) => {
    const primaryComparison = compareBySortKey(left, right, sortKey);

    if (primaryComparison !== 0) {
      return primaryComparison;
    }

    return left.taskName.localeCompare(right.taskName);
  });
}

export function getLaunchTimelineTaskDetails(
  taskId: string,
  tasks: LaunchTimelineTask[],
): LaunchTimelineTaskDetail | undefined {
  const task = tasks.find((candidate) => candidate.taskId === taskId);

  if (!task) {
    return undefined;
  }

  const dependencyContext = task.dependencyTaskIds
    .map((dependencyTaskId, index) => {
      const dependency = tasks.find(({ taskId }) => taskId === dependencyTaskId);

      if (!dependency) {
        return {
          taskId: `missing-dependency-${index + 1}`,
          taskName: "Missing dependency reference",
          timelineStatusLabel: "Needs source review",
        };
      }

      return {
        taskId: dependency.taskId,
        taskName: dependency.taskName,
        timelineStatusLabel: dependency.timelineStatusLabel,
      };
    });

  return {
    dependencyContext,
    linkedRecords: getLinkedRecords(task),
    normalizedMetadata: [
      { label: "Phase", value: task.phase },
      { label: "Owner", value: task.ownerLabel },
      { label: "Due date", value: task.dueDateLabel },
      { label: "Status", value: task.timelineStatusLabel },
      { label: "Dependencies", value: task.dependencySummary },
      { label: "Blocker", value: task.blockerSummary },
      { label: "Handoff relevance", value: task.handoffRelevance },
      { label: "Critical path", value: task.criticalPath ? "Yes" : "No" },
      {
        label: "Source",
        value: task.sourceProvenance.sourceName,
      },
      {
        label: "Source system",
        value: task.sourceProvenance.sourceSystemLabel,
      },
      {
        label: "Source type",
        value: task.sourceProvenance.sourceTypeLabel,
      },
      {
        label: "Source approval",
        value: task.sourceProvenance.approvalLabel,
      },
      {
        label: "Source access",
        value: task.sourceProvenance.accessLabel,
      },
      {
        label: "Source ingestion",
        value: task.sourceProvenance.ingestionLabel,
      },
      {
        label: "Source freshness",
        value: task.sourceProvenance.freshnessLabel,
      },
    ],
    taskId: task.taskId,
    taskName: task.taskName,
  };
}

function buildLaunchTimelineTask(
  task: LaunchTimelineTaskInput,
  allTasks: LaunchTimelineTaskInput[],
  role: WorkspaceRole,
): LaunchTimelineTask {
  const ownerLabel = task.ownerRole.trim() || "Unassigned";
  const dueDateLabel = task.dueDateLogic?.trim() || "No due date logic";
  const dependencySummary = getDependencySummary(task, allTasks);
  const hasBlocker = taskHasStructuredBlocker(task);
  const blockerSummary = getBlockerSummary(task);
  const timelineStatus = getTimelineStatus(task, ownerLabel, dueDateLabel);
  const handoffRelevance = task.handoffGate ?? "No handoff gate";
  const sourceFreshnessLabel =
    freshnessStateLabels[task.sourceProvenance.freshnessState];
  const canOpenLinkedRecord = canOpenLinkedTaskRecord(task.sourceProvenance, role);
  const canOpenSourceRecord =
    canOpenLinkedRecord && Boolean(task.sourceProvenance.sourceUrl);
  const timelineTask: LaunchTimelineTask = {
    ...task,
    attentionSignals: [],
    blockerSummary,
    canOpenHandoffRecord: canOpenLinkedRecord,
    canOpenSourceRecord,
    criticalPathLabel: `Critical path: ${task.criticalPath ? "Yes" : "No"}`,
    dependencySummary,
    dueDateLabel,
    hasBlocker,
    handoffRelevance,
    ownerLabel,
    sourceFreshnessLabel,
    timelineStatus,
    timelineStatusLabel: timelineTaskStatusLabels[timelineStatus],
  };

  return {
    ...timelineTask,
    attentionSignals: getAttentionSignals(timelineTask),
  };
}

function getTimelineStatus(
  task: LaunchTimelineTaskInput,
  ownerLabel: string,
  dueDateLabel: string,
): LaunchTimelineTaskStatus {
  if (task.status === "blocked") {
    return "blocked";
  }

  if (task.status === "complete") {
    return "complete";
  }

  if (
    task.sourceProvenance.freshnessState === "stale" ||
    task.sourceProvenance.freshnessState === "restricted"
  ) {
    return "source_stale";
  }

  if (ownerLabel === "Unassigned" || dueDateLabel === "No due date logic") {
    return "awaiting_input";
  }

  if (task.status === "in_progress" && task.criticalPath) {
    return "at_risk";
  }

  if (task.criticalPath || task.handoffGate) {
    return "watch";
  }

  return "on_track";
}

function getDependencySummary(
  task: LaunchTimelineTaskInput,
  allTasks: LaunchTimelineTaskInput[],
) {
  if (task.dependencyTaskIds.length === 0) {
    return "No dependencies";
  }

  const dependencyNames: string[] = [];
  let missingDependencyCount = 0;

  for (const dependencyTaskId of task.dependencyTaskIds) {
    const dependency = allTasks.find(({ taskId }) => taskId === dependencyTaskId);

    if (dependency) {
      dependencyNames.push(dependency.taskName);
    } else {
      missingDependencyCount += 1;
    }
  }

  if (missingDependencyCount > 0) {
    dependencyNames.push(getMissingDependencyLabel(missingDependencyCount));
  }

  return `Depends on ${joinList(dependencyNames)}`;
}

function getBlockerSummary(task: LaunchTimelineTaskInput) {
  const blockerState = task.blockerState?.trim();

  if (task.status === "blocked") {
    return blockerState && hasBlockingStateLabel(blockerState)
      ? `Blocked: ${blockerState}`
      : "Blocked status";
  }

  if (blockerState && hasBlockingStateLabel(blockerState)) {
    return `Blocker: ${blockerState}`;
  }

  return "No blocker";
}

function getMissingDependencyLabel(count: number) {
  return count === 1
    ? "Missing dependency reference"
    : `${count} missing dependency references`;
}

function taskHasStructuredBlocker(task: LaunchTimelineTaskInput) {
  return task.status === "blocked" || hasBlockingStateLabel(task.blockerState);
}

function hasBlockingStateLabel(blockerState?: string) {
  const normalizedState = blockerState?.trim().toLowerCase();

  if (!normalizedState) {
    return false;
  }

  return ![
    "clear",
    "none",
    "no",
    "no blocker",
    "not blocked",
    "n/a",
  ].includes(normalizedState);
}

function taskHasSourceFreshnessRisk(task: LaunchTimelineTask) {
  return (
    task.sourceProvenance.freshnessState === "stale" ||
    task.sourceProvenance.freshnessState === "restricted"
  );
}

function getAttentionSignals(task: LaunchTimelineTask) {
  const signals = [
    task.timelineStatus === "blocked" ? "Blocked" : undefined,
    task.timelineStatus === "at_risk" ? "At risk" : undefined,
    task.timelineStatus === "awaiting_input" ? "Awaiting input" : undefined,
    taskHasSourceFreshnessRisk(task) ? "Source-stale" : undefined,
    task.criticalPath ? "Critical path" : undefined,
    task.dependencyTaskIds.length > 0 ? "Dependency" : undefined,
    task.handoffGate ? "Handoff gate" : undefined,
    task.sourceProvenance.freshnessState === "watch"
      ? "Freshness watch"
      : undefined,
    task.sourceProvenance.freshnessState === "stale"
      ? "Freshness stale"
      : undefined,
  ].filter((signal): signal is string => Boolean(signal));

  return [...new Set(signals)];
}

function groupLaunchTimelineTasksByPhase(
  tasks: LaunchTimelineTask[],
): LaunchTimelinePhaseGroup[] {
  const phaseGroups: LaunchTimelinePhaseGroup[] = [];

  for (const task of tasks) {
    const existingGroup = phaseGroups.find((group) => group.phase === task.phase);

    if (existingGroup) {
      existingGroup.tasks.push(task);
    } else {
      phaseGroups.push({
        phase: task.phase,
        tasks: [task],
      });
    }
  }

  return phaseGroups;
}

function getLaunchTimelineStatusCounts(tasks: LaunchTimelineTask[]) {
  const counts: Record<LaunchTimelineTaskStatus, number> = {
    at_risk: 0,
    awaiting_input: 0,
    blocked: 0,
    complete: 0,
    on_track: 0,
    source_stale: 0,
    watch: 0,
  };

  for (const task of tasks) {
    counts[task.timelineStatus] += 1;
  }

  return counts;
}

function getLaunchTimelineFilterOptions(
  tasks: LaunchTimelineTask[],
): LaunchTimelineFilterOptions {
  return {
    dueDates: uniqueValues(tasks.map((task) => task.dueDateLabel)),
    owners: uniqueValues(tasks.map((task) => task.ownerLabel)),
    phases: uniqueValues(tasks.map((task) => task.phase)),
    sourceFreshnessStates: uniqueValues(
      tasks.map((task) => task.sourceProvenance.freshnessState),
    ),
    statuses: uniqueValues(tasks.map((task) => task.timelineStatus)),
  };
}

function getActiveLaunchTimelineFilters(
  filters: LaunchTimelineFilters,
): LaunchTimelineActiveFilter[] {
  return [
    filters.phase
      ? { key: "phase" as const, label: "Phase", value: filters.phase }
      : undefined,
    filters.owner
      ? { key: "owner" as const, label: "Owner", value: filters.owner }
      : undefined,
    filters.status
      ? {
          key: "status" as const,
          label: "Status",
          value: timelineTaskStatusLabels[filters.status],
        }
      : undefined,
    filters.risk
      ? { key: "risk" as const, label: "Risk", value: riskFilterLabels[filters.risk] }
      : undefined,
    filters.blocker
      ? {
          key: "blocker" as const,
          label: "Blocker",
          value: blockerFilterLabels[filters.blocker],
        }
      : undefined,
    filters.handoffRelevance
      ? {
          key: "handoffRelevance" as const,
          label: "Handoff",
          value: handoffFilterLabels[filters.handoffRelevance],
        }
      : undefined,
    filters.dueDate
      ? { key: "dueDate" as const, label: "Due date", value: filters.dueDate }
      : undefined,
    filters.sourceFreshness
      ? {
          key: "sourceFreshness" as const,
          label: "Source freshness",
          value: freshnessStateLabels[filters.sourceFreshness],
        }
      : undefined,
  ].filter((filter): filter is LaunchTimelineActiveFilter => Boolean(filter));
}

const riskFilterLabels: Record<Exclude<LaunchTimelineRiskFilter, "">, string> = {
  attention: "Needs attention",
  blocker: "Has blocker",
  critical_path: "Critical path",
  dependency: "Has dependency",
  handoff: "Has handoff",
  source_stale: "Source-stale",
};

const blockerFilterLabels: Record<Exclude<LaunchTimelineBlockerFilter, "">, string> = {
  has_blocker: "Has blocker",
  none: "No blocker",
};

const handoffFilterLabels: Record<Exclude<LaunchTimelineHandoffFilter, "">, string> = {
  has_handoff: "Has handoff",
  none: "No handoff",
};

function getTimelineResultSummary({
  activeFilterCount,
  filteredCount,
  totalCount,
}: {
  activeFilterCount: number;
  filteredCount: number;
  totalCount: number;
}) {
  if (activeFilterCount === 0) {
    return `${filteredCount} of ${totalCount} timeline tasks shown.`;
  }

  return `${filteredCount} of ${totalCount} timeline tasks match current filters.`;
}

function taskMatchesRiskFilter(
  task: LaunchTimelineTask,
  riskFilter: LaunchTimelineRiskFilter,
) {
  if (!riskFilter) {
    return true;
  }

  if (riskFilter === "attention") {
    return task.attentionSignals.length > 0;
  }

  if (riskFilter === "critical_path") {
    return task.criticalPath;
  }

  if (riskFilter === "blocker") {
    return taskHasBlocker(task);
  }

  if (riskFilter === "dependency") {
    return task.dependencyTaskIds.length > 0;
  }

  if (riskFilter === "handoff") {
    return Boolean(task.handoffGate);
  }

  return taskHasSourceFreshnessRisk(task);
}

function taskHasBlocker(task: LaunchTimelineTask) {
  return task.hasBlocker;
}

function compareBySortKey(
  left: LaunchTimelineTask,
  right: LaunchTimelineTask,
  sortKey: LaunchTimelineSortKey,
) {
  if (sortKey === "owner") {
    return left.ownerLabel.localeCompare(right.ownerLabel);
  }

  if (sortKey === "status") {
    return statusSortOrder[left.timelineStatus] - statusSortOrder[right.timelineStatus];
  }

  if (sortKey === "dueDate") {
    return left.dueDateLabel.localeCompare(right.dueDateLabel);
  }

  if (sortKey === "sourceFreshness") {
    return left.sourceFreshnessLabel.localeCompare(right.sourceFreshnessLabel);
  }

  return 0;
}

function getLinkedRecords(task: LaunchTimelineTask): LaunchTimelineLinkedRecord[] {
  const records: LaunchTimelineLinkedRecord[] = [];

  if (task.canOpenSourceRecord && task.sourceProvenance.sourceUrl) {
    records.push({
      label: `${task.sourceProvenance.sourceSystemLabel} source`,
      url: task.sourceProvenance.sourceUrl,
    });
  }

  if (task.handoffGate && task.canOpenHandoffRecord) {
    records.push({
      label: "Handoff workspace",
      url: task.handoffRecordUrl ?? "/handoff",
    });
  }

  return records;
}

function canOpenLinkedTaskRecord(
  provenance: LaunchPlanSourceProvenance,
  role: WorkspaceRole,
) {
  if (provenance.isRedacted || provenance.accessState === "restricted") {
    return false;
  }

  return role === "admin" || !provenance.isRedacted;
}

function getIngestedLaunchTaskStatus(
  record: NormalizedLaunchTaskRecord,
): LaunchTaskStatus {
  return hasBlockingStateLabel(record.blockerState) ? "blocked" : "not_started";
}

function getIngestedTaskSourceProvenance(
  record: NormalizedLaunchTaskRecord,
  role: WorkspaceRole,
): LaunchPlanSourceProvenance {
  const isRedacted = role !== "admin" && isRestrictedIngestedTaskSource(record);

  if (isRedacted) {
    return {
      accessLabel: accessStateLabels.restricted,
      accessState: "restricted",
      approvalLabel: approvalStateLabels.restricted,
      approvalState: "restricted",
      freshnessLabel: freshnessStateLabels.restricted,
      freshnessState: "restricted",
      ingestionLabel: ingestionStatusLabels.restricted,
      ingestionStatus: "restricted",
      isRedacted: true,
      sourceName: "Restricted source",
      sourceSystemLabel: "Restricted",
      sourceTypeLabel: "Restricted",
    };
  }

  return {
    accessLabel: accessStateLabels[record.accessState],
    accessState: record.accessState,
    approvalLabel: approvalStateLabels[record.approvalState],
    approvalState: record.approvalState,
    freshnessLabel: freshnessStateLabels[record.freshnessState],
    freshnessState: record.freshnessState,
    ingestionLabel: ingestionStatusLabels[record.ingestionStatus],
    ingestionStatus: record.ingestionStatus,
    isRedacted: false,
    sourceId: record.sourceId,
    sourceName: getIngestedTaskSourceName(record),
    sourceSystemLabel: sourceSystemLabels[record.sourceSystem],
    sourceTypeLabel: sourceTypeLabels.launch_task,
    sourceUrl: record.sourceUrl,
  };
}

function isRestrictedIngestedTaskSource(record: NormalizedLaunchTaskRecord) {
  return (
    record.accessState === "restricted" ||
    record.approvalState === "restricted" ||
    record.freshnessState === "restricted" ||
    record.ingestionStatus === "restricted"
  );
}

function getIngestedTaskSourceName(record: NormalizedLaunchTaskRecord) {
  return record.sourceSystem === "task"
    ? "Ingested launch task list"
    : `${sourceSystemLabels[record.sourceSystem]} launch task source`;
}

function uniqueValues<T extends string>(values: T[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function joinList(values: string[]) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
