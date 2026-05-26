import {
  type AnswerConfidence,
  type SourceBackedAnswer,
  type SourceBackedAnswerState,
  type SourceCitation,
  type SourceSystem,
} from "./answer";
import type { NormalizedLaunchTaskRecord } from "./launch-artifact-ingestion";
import {
  buildLaunchRiskAlerts,
  type LaunchRiskAlert,
} from "./launch-risk-alerts";
import {
  buildLaunchTimelineReview,
  normalizeIngestedLaunchTimelineTasks,
  type LaunchTimelineTask,
  type LaunchTimelineTaskInput,
} from "./launch-timeline";
import {
  createPrototypeSmartsheetStatusTasks,
} from "./smartsheet-status";
import type { SourceFreshnessState } from "./source-ledger";
import type { WorkspaceRole } from "./workspace";

type BuildLaunchExecutionRiskAnswerInput = {
  launchId?: string;
  launchName: string;
  previousQuestion?: string | null;
  question: string;
  role?: WorkspaceRole;
  taskInputs?: LaunchTimelineTaskInput[];
  taskRecords?: NormalizedLaunchTaskRecord[];
};

type ExecutionAnswerContext = {
  alerts: LaunchRiskAlert[];
  citations: SourceCitation[];
  launchName: string;
  previousQuestion?: string | null;
  question: string;
  rawTaskRecords: NormalizedLaunchTaskRecord[];
  reviewTasks: LaunchTimelineTask[];
};

const riskSeverityRank: Record<LaunchRiskAlert["severity"], number> = {
  critical: 0,
  at_risk: 1,
  watch: 2,
};

const freshnessRank: Record<SourceFreshnessState, number> = {
  restricted: 3,
  stale: 2,
  watch: 1,
  fresh: 0,
};

export function isLaunchExecutionRiskQuestion(
  question: string,
  previousQuestion?: string | null,
) {
  const normalizedQuestion = question.trim().toLowerCase();

  if (
    previousQuestion &&
    isLaunchExecutionRiskQuestion(previousQuestion) &&
    /^(what about (it|this|that|them|those|the blocker|the blockers?|the risk|the risks?|the dependency|the dependencies)|that one|this one)\??$/i.test(
      normalizedQuestion,
    )
  ) {
    return true;
  }

  if (
    /\b(deployment status|project status|smartsheet status)\b/i.test(
      normalizedQuestion,
    ) &&
    !/\b(risk|risks|risk alerts?|blocked|blockers?|dependency|dependencies|critical path|changed|prior status check)\b/i.test(
      normalizedQuestion,
    )
  ) {
    return false;
  }

  return /\b(launch execution|execution risk|risk alerts?|risks?( are)? open|launch risks?|blocked work|blocked tasks?|blockers?|at risk|delayed?|critical path|dependency impact|dependencies|dependency|source[-\s]?stale|stale status|what changed since|changed since|prior status check|status check)\b/i.test(
    normalizedQuestion,
  );
}

export function buildLaunchExecutionRiskSourceBackedAnswer({
  launchId,
  launchName,
  previousQuestion,
  question,
  role = "project-manager",
  taskInputs,
  taskRecords,
}: BuildLaunchExecutionRiskAnswerInput): SourceBackedAnswer {
  const rawTaskRecords = taskRecords ?? createPrototypeSmartsheetStatusTasks();
  const scopedRawTaskRecords = rawTaskRecords.filter(
    (record) => !launchId || record.launchId === launchId,
  );
  const visibleRawTaskRecords = scopedRawTaskRecords.filter(
    (record) => role === "admin" || !isRestrictedTaskRecord(record),
  );
  const normalizedTaskInputs =
    taskInputs ??
    normalizeIngestedLaunchTimelineTasks(rawTaskRecords, {
      launchId,
      role,
    });
  const scopedTaskInputCandidates = taskInputs
    ? normalizedTaskInputs.filter(
        (task) => !launchId || task.launchId === launchId,
      )
    : normalizedTaskInputs;
  const scopedTaskInputs = taskInputs
    ? scopedTaskInputCandidates.filter(
        (task) => role === "admin" || !isRestrictedTaskInput(task),
      )
    : scopedTaskInputCandidates;
  const restrictedTaskInputOnly =
    role !== "admin" &&
    Boolean(taskInputs) &&
    scopedTaskInputCandidates.length > 0 &&
    scopedTaskInputs.length === 0 &&
    scopedTaskInputCandidates.every(isRestrictedTaskInput);
  const review = buildLaunchTimelineReview({
    role,
    tasks: scopedTaskInputs,
  });
  const alerts = buildLaunchRiskAlerts({ tasks: review.tasks });
  const citations = getSourceCitations(review.tasks);
  const context: ExecutionAnswerContext = {
    alerts,
    citations,
    launchName,
    previousQuestion,
    question,
    rawTaskRecords: taskInputs && !taskRecords ? [] : visibleRawTaskRecords,
    reviewTasks: review.tasks,
  };

  if (review.tasks.length === 0) {
    return buildEmptyExecutionAnswer({
      launchId,
      launchName,
      restrictedTaskInputOnly,
      rawTaskRecords,
      role,
    });
  }

  const state = getAnswerState(review.tasks);
  const confidence = getAnswerConfidence(state, alerts);
  const freshnessLabel = getAnswerFreshnessLabel(review.tasks);
  const priorContext = previousQuestion
    ? ` Prior question used for follow-up context: "${previousQuestion}".`
    : "";
  const riskCount = formatCount(alerts.length, "active risk alert");
  const summary =
    `${launchName} execution has ${getStatusCountSummary(
      review.tasks,
    )}. ${riskCount ?? "No active risk alerts"} are visible from normalized launch execution data.` +
    priorContext;

  return {
    citations,
    confidence,
    freshnessLabel: `Freshness: ${freshnessLabel}`,
    generatedDraft: getGeneratedRiskDraft(alerts),
    id: `${launchName}-launch-execution-risk`,
    nextActions: getNextActions(citations, alerts),
    retrievedFacts: getRetrievedFacts(context),
    sourceGap:
      state === "source_stale"
        ? "Source gap: refresh or confirm the stale launch execution source before treating status as final."
        : undefined,
    state,
    summary,
    title: isChangedSinceQuestion(question)
      ? "Launch execution change history"
      : "Launch execution and risk status",
  };
}

function buildEmptyExecutionAnswer({
  launchId,
  launchName,
  restrictedTaskInputOnly,
  rawTaskRecords,
  role,
}: {
  launchId?: string;
  launchName: string;
  restrictedTaskInputOnly: boolean;
  rawTaskRecords: NormalizedLaunchTaskRecord[];
  role: WorkspaceRole;
}): SourceBackedAnswer {
  const scopedRecords = rawTaskRecords.filter(
    (record) => !launchId || record.launchId === launchId,
  );
  const restrictedOnly =
    restrictedTaskInputOnly ||
    (role !== "admin" &&
      scopedRecords.length > 0 &&
      scopedRecords.every(isRestrictedTaskRecord));

  if (restrictedOnly) {
    return {
      citations: [
        {
          accessState: "restricted",
          freshnessLabel: "Freshness: restricted",
          id: "restricted-launch-execution-source",
          marker: "1",
          sourceType: "Restricted launch execution source",
          system: "Smartsheet",
          title: "Restricted launch execution source",
        },
      ],
      confidence: "low",
      freshnessLabel: "Freshness: hidden because access is restricted",
      id: `${launchName}-launch-execution-risk`,
      nextActions: [
        {
          href: "/sources",
          id: "request-execution-source-access",
          label: "Request access to the restricted launch execution source.",
        },
      ],
      retrievedFacts: [],
      sourceGap:
        "Source gap: launch execution status exists, but restricted details are hidden for this role.",
      state: "access_restricted",
      summary:
        "A matching launch execution source exists, but your current role cannot view its task or risk details.",
      title: "Launch execution access restricted",
    };
  }

  return {
    citations: [],
    confidence: "none",
    freshnessLabel: "Freshness: no reliable source available",
    id: `${launchName}-launch-execution-risk`,
    nextActions: [
      {
        href: "/sources",
        id: "check-source-ledger",
        label: "Check Source Ledger for launch execution source ingestion.",
      },
      {
        href: "/timeline",
        id: "review-timeline",
        label: "Review Timeline Control for available launch tasks.",
      },
    ],
    retrievedFacts: [],
    sourceGap:
      "No approved launch execution source is available for this launch. Attach or refresh Smartsheet, Playbook, or task data to answer this.",
    state: "no_reliable_source",
    summary:
      "LaunchPad did not find approved, accessible launch execution data for this launch.",
    title: "No reliable launch execution source found",
  };
}

function getAnswerState(
  tasks: LaunchTimelineTask[],
): SourceBackedAnswerState {
  if (
    tasks.some(
      (task) =>
        task.timelineStatus === "source_stale" ||
        task.sourceProvenance.freshnessState === "stale",
    )
  ) {
    return "source_stale";
  }

  if (tasks.some((task) => task.timelineStatus === "awaiting_input")) {
    return "missing_information";
  }

  return "answered";
}

function getAnswerConfidence(
  state: SourceBackedAnswerState,
  alerts: LaunchRiskAlert[],
): AnswerConfidence {
  if (state === "source_stale") {
    return "medium";
  }

  if (state === "missing_information") {
    return "low";
  }

  return alerts.length > 0 ? "high" : "medium";
}

function getRetrievedFacts({
  alerts,
  citations,
  previousQuestion,
  question,
  rawTaskRecords,
  reviewTasks,
}: ExecutionAnswerContext) {
  const primaryCitationId = citations[0]?.id;
  const facts: SourceBackedAnswer["retrievedFacts"] = [
    {
      citationId: primaryCitationId,
      id: "launch-execution-status-counts",
      text: `Launch execution status: ${getStatusCountSummary(reviewTasks)}.`,
    },
  ];
  const topAlert = getTopRiskAlert(alerts);
  const topAlertTask = topAlert
    ? reviewTasks.find((task) => task.taskId === topAlert.taskId)
    : undefined;
  const dependencyAlert = alerts.find(
    (alert) => alert.category === "dependency_change",
  );
  const staleTask = reviewTasks.find(
    (task) =>
      task.timelineStatus === "source_stale" ||
      task.sourceProvenance.freshnessState === "stale",
  );

  if (topAlert) {
    facts.push({
      citationId: getCitationIdForAlert(topAlert, citations),
      id: "launch-execution-top-risk",
      text: `Highest-priority risk alert: ${topAlert.title}. ${topAlert.whatChanged} ${topAlert.whyItMatters}`,
    });
  }

  if (topAlertTask) {
    facts.push({
      citationId: getCitationIdForTask(topAlertTask, citations),
      id: "launch-execution-task-owner",
      text: `${topAlertTask.taskName} is owned by ${topAlertTask.ownerLabel}, due ${topAlertTask.dueDateLabel}, in ${topAlertTask.phase} phase, with handoff context ${topAlertTask.handoffRelevance}.`,
    });
  }

  if (dependencyAlert?.dependencyContext[0]) {
    facts.push({
      citationId: getCitationIdForAlert(dependencyAlert, citations),
      id: "launch-execution-dependency-impact",
      text: `${dependencyAlert.taskName} depends on ${dependencyAlert.dependencyContext[0].taskName}; dependency status is ${dependencyAlert.dependencyContext[0].timelineStatusLabel}.`,
    });
  }

  if (staleTask) {
    facts.push({
      citationId: getCitationIdForTask(staleTask, citations),
      id: "launch-execution-source-freshness",
      text: `${staleTask.taskName} is using ${staleTask.sourceFreshnessLabel} source data from ${staleTask.sourceProvenance.sourceSystemLabel}.`,
    });
  }

  if (isChangedSinceQuestion(question)) {
    facts.push({
      citationId: primaryCitationId,
      id: "launch-execution-change-history",
      text: `Since the prior status check, source-sync-service refreshed ${getPrimarySourceSystemLabel(reviewTasks)} execution data at ${getLatestRefreshTimestamp(rawTaskRecords)} and ${formatCount(alerts.length, "risk alert signal") ?? "no risk alert signals"} are active.`,
    });
  }

  if (previousQuestion && !isChangedSinceQuestion(question)) {
    facts.push({
      id: "launch-execution-prior-context",
      text: `Prior question used for follow-up context: "${previousQuestion}".`,
    });
  }

  return facts;
}

function getGeneratedRiskDraft(alerts: LaunchRiskAlert[]) {
  const topAlert = getTopRiskAlert(alerts);

  if (!topAlert) {
    return undefined;
  }

  return {
    id: "launch-execution-risk-explanation",
    reviewLabel:
      "Inferred risk explanation from source-backed task and dependency signals; confirm before escalation.",
    text: `${topAlert.title}: ${topAlert.whyItMatters} Recommended action: ${topAlert.recommendedAction}`,
  };
}

function getNextActions(
  citations: SourceCitation[],
  alerts: LaunchRiskAlert[],
) {
  const actions = [
    {
      href: "/timeline",
      id: "review-launch-timeline",
      label: "Review Timeline Control for affected tasks.",
    },
  ];
  const firstSourceHref = citations.find((citation) => citation.href)?.href;

  if (firstSourceHref) {
    actions.push({
      href: firstSourceHref,
      id: "open-execution-source",
      label: "Open the cited launch execution source.",
    });
  } else {
    actions.push({
      href: "/sources",
      id: "check-source-ledger",
      label: "Check Source Ledger for execution source freshness.",
    });
  }

  if (alerts.some((alert) => alert.handoffLabel)) {
    actions.push({
      href: "/handoff",
      id: "review-handoff-context",
      label: "Review the related handoff workspace.",
    });
  }

  return actions;
}

function getSourceCitations(tasks: LaunchTimelineTask[]): SourceCitation[] {
  const citationBySource = new Map<string, LaunchTimelineTask>();

  for (const task of tasks) {
    if (task.sourceProvenance.isRedacted) {
      continue;
    }

    const sourceKey =
      task.sourceProvenance.sourceId ??
      `${task.sourceProvenance.sourceName}-${task.sourceProvenance.sourceSystemLabel}`;
    const existingTask = citationBySource.get(sourceKey);

    if (
      !existingTask ||
      freshnessRank[task.sourceProvenance.freshnessState] >
        freshnessRank[existingTask.sourceProvenance.freshnessState]
    ) {
      citationBySource.set(sourceKey, task);
    }
  }

  return [...citationBySource.values()].map((task, index) => ({
    accessState: task.sourceProvenance.accessState,
    freshnessLabel: `Freshness: ${task.sourceProvenance.freshnessLabel}`,
    href: getSafeInternalHref(task.sourceProvenance.sourceUrl),
    id:
      task.sourceProvenance.sourceId ??
      `launch-execution-source-${index + 1}`,
    marker: String(index + 1),
    sourceType: task.sourceProvenance.sourceTypeLabel,
    system: getCitationSystem(task.sourceProvenance.sourceSystemLabel),
    title: task.sourceProvenance.sourceName,
  }));
}

function getTopRiskAlert(alerts: LaunchRiskAlert[]) {
  return alerts.reduce<LaunchRiskAlert | undefined>((topAlert, alert) => {
    if (!topAlert) {
      return alert;
    }

    return riskSeverityRank[alert.severity] < riskSeverityRank[topAlert.severity]
      ? alert
      : topAlert;
  }, undefined);
}

function getCitationIdForAlert(
  alert: LaunchRiskAlert,
  citations: SourceCitation[],
) {
  return citations.find((citation) => citation.id === alert.sourceSignal.sourceId)
    ?.id;
}

function getCitationIdForTask(
  task: LaunchTimelineTask,
  citations: SourceCitation[],
) {
  return citations.find(
    (citation) => citation.id === task.sourceProvenance.sourceId,
  )?.id;
}

function getStatusCountSummary(tasks: LaunchTimelineTask[]) {
  const counts = tasks.reduce<Record<string, number>>((statusCounts, task) => {
    statusCounts[task.timelineStatus] =
      (statusCounts[task.timelineStatus] ?? 0) + 1;
    return statusCounts;
  }, {});
  const segments = [
    formatCount(counts.blocked ?? 0, "blocked task"),
    formatCount(counts.at_risk ?? 0, "at-risk task"),
    formatCount(counts.source_stale ?? 0, "source-stale task"),
    formatCount(counts.awaiting_input ?? 0, "task awaiting input"),
    formatCount(counts.watch ?? 0, "watch task"),
    formatCount(counts.on_track ?? 0, "on-track task"),
    formatCount(counts.complete ?? 0, "complete task"),
  ].filter((segment): segment is string => Boolean(segment));

  return joinSegments(segments);
}

function getAnswerFreshnessLabel(tasks: LaunchTimelineTask[]) {
  const worstTask = [...tasks].sort(
    (left, right) =>
      freshnessRank[right.sourceProvenance.freshnessState] -
      freshnessRank[left.sourceProvenance.freshnessState],
  )[0];

  return worstTask?.sourceProvenance.freshnessLabel ?? "No reliable source";
}

function getPrimarySourceSystemLabel(tasks: LaunchTimelineTask[]) {
  return tasks[0]?.sourceProvenance.sourceSystemLabel ?? "launch execution";
}

function getLatestRefreshTimestamp(records: NormalizedLaunchTaskRecord[]) {
  return (
    [...records]
      .map((record) => record.refreshedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "refresh timestamp unavailable"
  );
}

function isChangedSinceQuestion(question: string) {
  return /\b(what changed since|changed since|prior status check|status check)\b/i.test(
    question,
  );
}

function isRestrictedTaskRecord(record: NormalizedLaunchTaskRecord) {
  return (
    record.accessState === "restricted" ||
    record.approvalState === "restricted" ||
    record.freshnessState === "restricted" ||
    record.ingestionStatus === "restricted"
  );
}

function isRestrictedTaskInput(task: LaunchTimelineTaskInput) {
  return (
    task.sourceProvenance.isRedacted ||
    task.sourceProvenance.accessState === "restricted" ||
    task.sourceProvenance.approvalState === "restricted" ||
    task.sourceProvenance.freshnessState === "restricted" ||
    task.sourceProvenance.ingestionStatus === "restricted"
  );
}

function getCitationSystem(label: string): SourceSystem {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("smartsheet")) {
    return "Smartsheet";
  }

  if (normalizedLabel.includes("playbook")) {
    return "Playbook";
  }

  if (normalizedLabel.includes("handoff")) {
    return "Handoff artifact";
  }

  if (
    normalizedLabel.includes("salesforce") ||
    normalizedLabel.includes("ecrm")
  ) {
    return "ECRM/Salesforce";
  }

  if (normalizedLabel.includes("teams")) {
    return "Teams";
  }

  if (normalizedLabel.includes("email")) {
    return "Email";
  }

  return "SharePoint";
}

function getSafeInternalHref(href?: string) {
  const trimmedHref = href?.trim();

  if (!trimmedHref) {
    return undefined;
  }

  if (trimmedHref.startsWith("/") && !trimmedHref.startsWith("//")) {
    return trimmedHref;
  }

  if (trimmedHref.startsWith("#")) {
    return trimmedHref;
  }

  return undefined;
}

function formatCount(count: number, singularNoun: string) {
  if (count <= 0) {
    return undefined;
  }

  return `${count} ${singularNoun}${count === 1 ? "" : "s"}`;
}

function joinSegments(segments: string[]) {
  if (segments.length === 0) {
    return "no visible launch execution tasks";
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (segments.length === 2) {
    return `${segments[0]} and ${segments[1]}`;
  }

  return `${segments.slice(0, -1).join(", ")}, and ${segments.at(-1)}`;
}
