"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Filter,
  GitBranch,
  Link as LinkIcon,
  PlayCircle,
  SearchCheck,
  XCircle,
} from "lucide-react";

import {
  createPrototypeLaunchPlanSources,
  generateLaunchPlanFromPlaybook,
  getPrototypeLaunchPlanStarterData,
  type GeneratedLaunchTask,
  type LaunchPlanGeneratedAuditEvent,
  type LaunchPlanSetupInput,
  type LaunchPlanValidationError,
} from "@/domain/launch-plan";
import type { NormalizedLaunchTaskRecord } from "@/domain/launch-artifact-ingestion";
import {
  buildLaunchTimelineReview,
  defaultLaunchTimelineFilters,
  getLaunchTimelineTaskDetails,
  normalizeIngestedLaunchTimelineTasks,
  timelineTaskStatusLabels,
  type LaunchTimelineFilters,
  type LaunchTimelineSortKey,
  type LaunchTimelineTask,
  type LaunchTimelineTaskInput,
} from "@/domain/launch-timeline";
import {
  applyLaunchRiskAlertAction,
  buildLaunchRiskAlerts,
  buildLaunchRiskDetectedAuditEvent,
  launchRiskAlertStatusLabels,
  type LaunchRiskAlert,
  type LaunchRiskAlertStatus,
  type LaunchRiskAuditEvent,
} from "@/domain/launch-risk-alerts";
import {
  freshnessStateLabels,
  type SourceFreshnessState,
  type SourceLedgerRecord,
} from "@/domain/source-ledger";
import type { WorkspaceSession } from "@/domain/workspace";

type LaunchPlanStarterPanelProps = {
  initialIngestedTasks?: NormalizedLaunchTaskRecord[];
  initialSources?: SourceLedgerRecord[];
  onAuditEvent?: (event: LaunchPlanGeneratedAuditEvent) => void;
  session: WorkspaceSession;
};

const defaultLaunchPlanSources = createPrototypeLaunchPlanSources();
const defaultIngestedLaunchTasks: NormalizedLaunchTaskRecord[] = [];

const riskFilterOptions: Array<{
  label: string;
  value: LaunchTimelineFilters["risk"];
}> = [
  { label: "Any risk signal", value: "" },
  { label: "Needs attention", value: "attention" },
  { label: "Critical path", value: "critical_path" },
  { label: "Has blocker", value: "blocker" },
  { label: "Has dependency", value: "dependency" },
  { label: "Has handoff", value: "handoff" },
  { label: "Source-stale", value: "source_stale" },
];

const blockerFilterOptions: Array<{
  label: string;
  value: LaunchTimelineFilters["blocker"];
}> = [
  { label: "Any blocker state", value: "" },
  { label: "Has blocker", value: "has_blocker" },
  { label: "No blocker", value: "none" },
];

const handoffFilterOptions: Array<{
  label: string;
  value: LaunchTimelineFilters["handoffRelevance"];
}> = [
  { label: "Any handoff state", value: "" },
  { label: "Has handoff", value: "has_handoff" },
  { label: "No handoff", value: "none" },
];

const sortOptions: Array<{ label: string; value: LaunchTimelineSortKey }> = [
  { label: "Phase order", value: "phase" },
  { label: "Owner", value: "owner" },
  { label: "Status", value: "status" },
  { label: "Due date", value: "dueDate" },
  { label: "Source freshness", value: "sourceFreshness" },
];

const riskAlertCategoryLabels: Record<LaunchRiskAlert["category"], string> = {
  critical_milestone: "Critical milestone",
  delayed_task: "Delayed task",
  dependency_change: "Dependency impact",
  handoff_risk: "Handoff risk",
  source_stale: "Source freshness",
};

const riskAlertSeverityLabels: Record<LaunchRiskAlert["severity"], string> = {
  at_risk: "At risk",
  critical: "Critical",
  watch: "Watch",
};

export function LaunchPlanStarterPanel({
  initialIngestedTasks = defaultIngestedLaunchTasks,
  initialSources = defaultLaunchPlanSources,
  onAuditEvent,
  session,
}: LaunchPlanStarterPanelProps) {
  const starterData = useMemo(
    () =>
      getPrototypeLaunchPlanStarterData({
        session,
        sources: initialSources,
      }),
    [initialSources, session],
  );
  const [setup, setSetup] = useState<LaunchPlanSetupInput>(
    starterData.defaultSetup,
  );
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedLaunchTask[]>([]);
  const [latestAuditEvent, setLatestAuditEvent] =
    useState<LaunchPlanGeneratedAuditEvent>();
  const [latestRiskAuditEvent, setLatestRiskAuditEvent] =
    useState<LaunchRiskAuditEvent>();
  const [riskAlertStatuses, setRiskAlertStatuses] = useState<
    Partial<Record<string, LaunchRiskAlertStatus>>
  >({});
  const [selectedRiskAlertId, setSelectedRiskAlertId] = useState<string>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [sortKey, setSortKey] = useState<LaunchTimelineSortKey>("phase");
  const [statusMessage, setStatusMessage] = useState("");
  const [timelineFilters, setTimelineFilters] =
    useState<LaunchTimelineFilters>(defaultLaunchTimelineFilters);
  const [validationErrors, setValidationErrors] = useState<
    LaunchPlanValidationError[]
  >([]);
  const selectedTemplate = starterData.templateOptions.find(
    (option) => option.optionId === setup.selectedTemplateOptionId,
  );
  const launchTierOptions =
    selectedTemplate?.supportedLaunchTiers.length
      ? selectedTemplate.supportedLaunchTiers
      : starterData.launchTierOptions;
  const unavailableTemplates = starterData.templateOptions.filter(
    (option) => !option.isAvailable,
  );
  const ingestedTimelineTasks = useMemo(
    () =>
      normalizeIngestedLaunchTimelineTasks(initialIngestedTasks, {
        launchId: setup.launchId,
        role: session.user.role,
      }),
    [initialIngestedTasks, session.user.role, setup.launchId],
  );
  const timelineTasks: LaunchTimelineTaskInput[] = useMemo(
    () => mergeTimelineTaskInputs(generatedTasks, ingestedTimelineTasks),
    [generatedTasks, ingestedTimelineTasks],
  );
  const timelineReview = useMemo(
    () =>
      buildLaunchTimelineReview({
        filters: timelineFilters,
        role: session.user.role,
        sortKey,
        tasks: timelineTasks,
      }),
    [session.user.role, sortKey, timelineFilters, timelineTasks],
  );
  const selectedTask = timelineReview.filteredTasks.find(
    (task) => task.taskId === selectedTaskId,
  );
  const selectedTaskDetails = selectedTask
    ? getLaunchTimelineTaskDetails(selectedTask.taskId, timelineReview.tasks)
    : undefined;
  const detectedRiskAlerts = useMemo(
    () => buildLaunchRiskAlerts({ tasks: timelineReview.tasks }),
    [timelineReview.tasks],
  );
  const riskAlerts = useMemo(
    () =>
      detectedRiskAlerts.map((alert) => ({
        ...alert,
        status: riskAlertStatuses[alert.alertId] ?? alert.status,
      })),
    [detectedRiskAlerts, riskAlertStatuses],
  );
  const detectedRiskAuditEvent = useMemo(
    () =>
      riskAlerts[0]
        ? buildLaunchRiskDetectedAuditEvent({
            alert: riskAlerts[0],
            systemActor: "risk-detection-service",
          })
        : undefined,
    [riskAlerts],
  );
  const displayedRiskAuditEvent =
    latestRiskAuditEvent ?? detectedRiskAuditEvent;

  function updateSetupField<Key extends keyof LaunchPlanSetupInput>(
    key: Key,
    value: LaunchPlanSetupInput[Key],
  ) {
    clearGeneratedPlan();
    setSetup((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTimelineFilter<Key extends keyof LaunchTimelineFilters>(
    key: Key,
    value: LaunchTimelineFilters[Key],
  ) {
    setTimelineFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleTemplateChange(optionId: string) {
    const nextTemplate = starterData.templateOptions.find(
      (option) => option.optionId === optionId,
    );

    clearGeneratedPlan();
    setSetup((current) => ({
      ...current,
      launchTier:
        nextTemplate?.supportedLaunchTiers.includes(current.launchTier)
          ? current.launchTier
          : nextTemplate?.supportedLaunchTiers[0] ?? current.launchTier,
      selectedTemplateOptionId: optionId,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = generateLaunchPlanFromPlaybook({
      actorId: session.user.name,
      role: session.user.role,
      setup,
      sources: initialSources,
    });

    if (result.status === "invalid") {
      setGeneratedTasks([]);
      resetTimelineReviewState();
      setLatestAuditEvent(undefined);
      setStatusMessage("");
      setValidationErrors(result.validationErrors);
      return;
    }

    setGeneratedTasks(result.tasks);
    resetTimelineReviewState();
    setLatestAuditEvent(result.auditEvent);
    setValidationErrors([]);
    setStatusMessage(
      `Generated ${result.tasks.length} launch tasks for ${setup.launchName}.`,
    );
    onAuditEvent?.(result.auditEvent);
  }

  function clearGeneratedPlan() {
    setGeneratedTasks([]);
    resetTimelineReviewState();
    setLatestAuditEvent(undefined);
    setStatusMessage("");
    setValidationErrors([]);
  }

  function resetTimelineReviewState() {
    setTimelineFilters(defaultLaunchTimelineFilters);
    setSortKey("phase");
    setSelectedTaskId(undefined);
    setRiskAlertStatuses({});
    setSelectedRiskAlertId(undefined);
    setLatestRiskAuditEvent(undefined);
  }

  function handleRiskAlertAction(
    alert: LaunchRiskAlert,
    status: Exclude<LaunchRiskAlertStatus, "active">,
  ) {
    const result = applyLaunchRiskAlertAction({
      actorId: session.user.name,
      alert,
      status,
    });

    setRiskAlertStatuses((current) => ({
      ...current,
      [alert.alertId]: result.alert.status,
    }));
    setLatestRiskAuditEvent(result.auditEvent);
  }

  return (
    <section aria-labelledby="timeline-title" className="grid gap-4">
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          Timeline
        </p>
        <h2 className="text-2xl font-semibold tracking-normal" id="timeline-title">
          Timeline
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Start a launch execution plan from an approved Playbook template,
          then review generated task status, dependencies, handoffs, and source
          freshness.
        </p>
      </div>

      <form
        aria-label="Start launch from Playbook"
        className="rounded-lg border border-border bg-card p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-syneos-orange">
              <ClipboardList aria-hidden="true" className="h-4 w-4" />
              Launch plan starter
            </p>
            <h3 className="mt-2 font-semibold">Approved Playbook setup</h3>
          </div>
          <span className="w-fit rounded-md border border-border px-3 py-1 text-sm font-medium">
            Role-filtered: {session.user.roleLabel}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Playbook template
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) => handleTemplateChange(event.target.value)}
              value={setup.selectedTemplateOptionId}
            >
              {starterData.templateOptions.map((option) => (
                <option
                  disabled={!option.isAvailable}
                  key={option.optionId}
                  value={option.optionId}
                >
                  {option.templateName}
                  {option.isAvailable
                    ? ` - ${option.supportedLaunchTiers.join(", ")}`
                    : ` - Unavailable: ${option.unavailableReason}`}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Launch tier
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateSetupField("launchTier", event.target.value)
              }
              value={setup.launchTier}
            >
              {launchTierOptions.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Target kickoff date
            <input
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateSetupField("targetKickoffDate", event.target.value)
              }
              type="date"
              value={setup.targetKickoffDate}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Launch ID
            <input
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateSetupField("launchId", event.target.value)
              }
              value={setup.launchId}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Launch name
            <input
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateSetupField("launchName", event.target.value)
              }
              value={setup.launchName}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Project manager
            <input
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateSetupField("projectManager", event.target.value)
              }
              value={setup.projectManager}
            />
          </label>
        </div>

        {selectedTemplate ? (
          <TemplateProvenanceSummary
            optionName={selectedTemplate.templateName}
            provenance={selectedTemplate.sourceProvenance}
          />
        ) : null}

        {unavailableTemplates.length > 0 ? (
          <section
            aria-label="Unavailable Playbook templates"
            className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm"
          >
            <h4 className="font-semibold">Unavailable Playbook templates</h4>
            <ul className="mt-2 grid gap-2">
              {unavailableTemplates.map((option) => (
                <li key={option.optionId}>
                  <AlertTriangle
                    aria-hidden="true"
                    className="mr-2 inline h-4 w-4 text-syneos-orange"
                  />
                  {option.templateName}: Unavailable -{" "}
                  {option.unavailableReason} Approval:{" "}
                  {option.sourceProvenance.approvalLabel}; Freshness:{" "}
                  {option.sourceProvenance.freshnessLabel}; Access:{" "}
                  {option.sourceProvenance.accessLabel}; Ingestion:{" "}
                  {option.sourceProvenance.ingestionLabel}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {validationErrors.length > 0 ? (
          <div
            className="mt-4 rounded-md border border-destructive bg-background px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <p className="font-semibold">Launch plan could not be generated.</p>
            <ul className="mt-2 grid gap-1">
              {validationErrors.map((error) => (
                <li key={`${error.field}-${error.message}`}>
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {statusMessage ? (
          <div
            className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
            role="status"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mr-2 inline h-4 w-4 text-syneos-teal"
            />
            {statusMessage}
          </div>
        ) : null}

        <button
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-syneos-orange px-3 py-2 text-sm font-semibold text-white hover:bg-syneos-dark-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-orange"
          type="submit"
        >
          <PlayCircle aria-hidden="true" className="h-4 w-4" />
          Generate launch plan
        </button>
      </form>

      <TimelineTaskFilters
        filters={timelineFilters}
        onClearFilters={() => setTimelineFilters(defaultLaunchTimelineFilters)}
        onFilterChange={updateTimelineFilter}
        onSortChange={setSortKey}
        review={timelineReview}
        sortKey={sortKey}
      />

      <TimelineRiskAlerts
        alerts={riskAlerts}
        latestAuditEvent={displayedRiskAuditEvent}
        onAction={handleRiskAlertAction}
        onSelectAlert={(alertId) =>
          setSelectedRiskAlertId((current) =>
            current === alertId ? undefined : alertId,
          )
        }
        selectedAlertId={selectedRiskAlertId}
      />

      <section
        aria-label="Launch timeline tasks"
        className="rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
              <GitBranch aria-hidden="true" className="h-4 w-4" />
              Timeline review
            </p>
            <h3 className="mt-2 font-semibold">Launch execution tasks</h3>
          </div>
          <span className="w-fit rounded-md border border-border px-3 py-1 text-sm font-medium">
            Task count: {timelineTasks.length}
          </span>
        </div>

        {timelineTasks.length > 0 ? (
          <div className="grid gap-4">
            <TimelineStatusSummary statusCounts={timelineReview.statusCounts} />
            <p className="text-sm text-muted-foreground">
              {timelineReview.resultSummary}
            </p>
            {timelineReview.phaseGroups.map((group) => (
              <section
                aria-label={`Phase: ${group.phase}`}
                className="grid gap-3"
                key={group.phase}
              >
                <h4 className="text-sm font-semibold text-syneos-teal">
                  Phase: {group.phase}
                </h4>
                {group.tasks.map((task) => (
                  <TimelineTaskRow
                    isSelected={task.taskId === selectedTaskId}
                    key={task.taskId}
                    onSelect={() => setSelectedTaskId(task.taskId)}
                    task={task}
                  />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No generated or ingested launch tasks are available yet.
          </p>
        )}
      </section>

      <TimelineTaskDetails
        selectedTask={selectedTask}
        selectedTaskDetails={selectedTaskDetails}
      />

      <section
        aria-label="Latest launch generation audit event"
        className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm"
      >
        <h3 className="font-semibold">Latest launch generation audit event</h3>
        {latestAuditEvent ? (
          <dl className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <AuditTerm label="Action" value="Launch plan generated" />
            <AuditTerm label="Event type" value={latestAuditEvent.eventType} />
            <AuditTerm label="Actor" value={latestAuditEvent.actorId} />
            <AuditTerm label="Launch ID" value={latestAuditEvent.launchId} />
            <AuditTerm
              label="Playbook source ID"
              value={latestAuditEvent.metadata.playbookSourceId}
            />
            <AuditTerm
              label="Selected launch tier"
              value={latestAuditEvent.metadata.selectedLaunchTier}
            />
            <AuditTerm
              label="Generated task count"
              value={String(latestAuditEvent.metadata.generatedTaskCount)}
            />
            <AuditTerm label="Timestamp" value={latestAuditEvent.occurredAt} />
            <AuditTerm
              label="Correlation ID"
              value={latestAuditEvent.correlationId}
            />
          </dl>
        ) : (
          <p className="mt-2 text-muted-foreground">
            No launch generation audit event has been recorded yet.
          </p>
        )}
      </section>
    </section>
  );
}

function TimelineRiskAlerts({
  alerts,
  latestAuditEvent,
  onAction,
  onSelectAlert,
  selectedAlertId,
}: {
  alerts: LaunchRiskAlert[];
  latestAuditEvent?: LaunchRiskAuditEvent;
  onAction: (
    alert: LaunchRiskAlert,
    status: Exclude<LaunchRiskAlertStatus, "active">,
  ) => void;
  onSelectAlert: (alertId: string) => void;
  selectedAlertId?: string;
}) {
  return (
    <>
      <section
        aria-label="Proactive launch risk alerts"
        className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 font-medium text-syneos-orange">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              Risk radar
            </p>
            <h3 className="mt-2 font-semibold">Proactive launch risk alerts</h3>
          </div>
          <span className="w-fit rounded-md border border-border px-3 py-1 font-medium">
            Alert count: {alerts.length}
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <TimelineRiskAlertCard
                alert={alert}
                isSelected={alert.alertId === selectedAlertId}
                key={alert.alertId}
                onAction={onAction}
                onSelect={() => onSelectAlert(alert.alertId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No proactive risk alerts are active for the current timeline.
          </p>
        )}
      </section>

      <section
        aria-label="Latest risk alert audit event"
        className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm"
      >
        <h3 className="font-semibold">Latest risk alert audit event</h3>
        {latestAuditEvent ? (
          <dl className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <AuditTerm
              label="Action"
              value={
                latestAuditEvent.eventType === "task.risk_status_updated"
                  ? "Risk status updated"
                  : "Risk detected"
              }
            />
            <AuditTerm label="Event type" value={latestAuditEvent.eventType} />
            <AuditTerm
              label="Actor"
              value={
                latestAuditEvent.actorId ??
                latestAuditEvent.systemActor ??
                "System"
              }
            />
            <AuditTerm label="Launch ID" value={latestAuditEvent.launchId} />
            <AuditTerm
              label="Task ID"
              value={latestAuditEvent.metadata.taskId}
            />
            <AuditTerm
              label="Source ID"
              value={latestAuditEvent.metadata.sourceId ?? "No source ID"}
            />
            <AuditTerm
              label="Alert status"
              value={
                launchRiskAlertStatusLabels[
                  latestAuditEvent.metadata.alertStatus
                ]
              }
            />
            <AuditTerm
              label="Freshness"
              value={latestAuditEvent.metadata.freshnessLabel}
            />
            <AuditTerm
              label="Correlation ID"
              value={latestAuditEvent.correlationId}
            />
          </dl>
        ) : (
          <p className="mt-2 text-muted-foreground">
            No risk alert audit event has been recorded yet.
          </p>
        )}
      </section>
    </>
  );
}

function TimelineRiskAlertCard({
  alert,
  isSelected,
  onAction,
  onSelect,
}: {
  alert: LaunchRiskAlert;
  isSelected: boolean;
  onAction: (
    alert: LaunchRiskAlert,
    status: Exclude<LaunchRiskAlertStatus, "active">,
  ) => void;
  onSelect: () => void;
}) {
  const detailsId = `${alert.alertId}-details`;

  return (
    <article
      aria-label={`Risk alert: ${alert.title}`}
      className="rounded-md border border-border bg-background px-4 py-3 leading-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-syneos-orange">
            {riskAlertCategoryLabels[alert.category]}
          </p>
          <h4 className="text-base font-semibold">{alert.title}</h4>
          <p className="text-muted-foreground">{alert.whyItMatters}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border px-3 py-1 font-medium">
            Status: {launchRiskAlertStatusLabels[alert.status]}
          </span>
          <span className="rounded-md border border-border px-3 py-1 font-medium">
            Severity: {riskAlertSeverityLabels[alert.severity]}
          </span>
          <button
            aria-controls={detailsId}
            aria-expanded={isSelected}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
            onClick={onSelect}
            type="button"
          >
            <SearchCheck aria-hidden="true" className="h-4 w-4" />
            View details for {alert.title}
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        <TaskTerm label="Freshness" value={alert.sourceSignal.freshnessLabel} />
        <TaskTerm label="Confidence" value={stripTermPrefix(alert.confidenceLabel)} />
        <TaskTerm label="Source" value={alert.sourceSignal.sourceName} />
        <TaskTerm
          label="Affected stakeholders"
          value={formatList(alert.affectedStakeholders)}
        />
        <TaskTerm
          label="Affected tasks"
          value={formatList(alert.affectedTasks)}
        />
        <TaskTerm label="Recommended action" value={alert.recommendedAction} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          aria-label={`Mark monitoring for ${alert.title}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
          onClick={() => onAction(alert, "monitoring")}
          type="button"
        >
          <SearchCheck aria-hidden="true" className="h-4 w-4" />
          Monitor
        </button>
        <button
          aria-label={`Snooze ${alert.title}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
          onClick={() => onAction(alert, "snoozed")}
          type="button"
        >
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          Snooze
        </button>
        <button
          aria-label={`Mark needs follow-up for ${alert.title}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
          onClick={() => onAction(alert, "needs_follow_up")}
          type="button"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          Needs follow-up
        </button>
        <button
          aria-label={`Resolve ${alert.title}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
          onClick={() => onAction(alert, "resolved")}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Resolve
        </button>
      </div>

      {isSelected ? (
        <section
          aria-label={`Risk alert details: ${alert.title}`}
          className="mt-3 rounded-md border border-border bg-card px-3 py-3"
          id={detailsId}
        >
          <dl className="grid gap-2 md:grid-cols-2">
            <TaskTerm label="What changed" value={alert.whatChanged} />
            <TaskTerm label="Why it matters" value={alert.whyItMatters} />
            <TaskTerm
              label="Recommended action"
              value={alert.recommendedAction}
            />
            <TaskTerm
              label="Handoff"
              value={alert.handoffLabel ?? "No handoff impact"}
            />
            <TaskTerm
              label="Milestone"
              value={alert.milestoneLabel ?? "No milestone label"}
            />
          </dl>

          <section
            aria-label={`Dependency context for ${alert.title}`}
            className="mt-3"
          >
            <h5 className="font-semibold">Dependency context</h5>
            {alert.dependencyContext.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {alert.dependencyContext.map((dependency) => (
                  <li
                    className="rounded-md border border-border bg-background px-3 py-2"
                    key={dependency.taskId}
                  >
                    Dependency task: {dependency.taskName}; Status:{" "}
                    {dependency.timelineStatusLabel}
                    {dependency.linkedRecords.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {dependency.linkedRecords.map((record) => (
                          <li key={`${dependency.taskId}-${record.label}-${record.url}`}>
                            <a
                              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
                              href={record.url}
                            >
                              <LinkIcon aria-hidden="true" className="h-4 w-4" />
                              {record.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                No dependency context is linked to this alert.
              </p>
            )}
          </section>

          <section aria-label={`Linked records for ${alert.title}`} className="mt-3">
            <h5 className="font-semibold">Linked records</h5>
            {alert.linkedRecords.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {alert.linkedRecords.map((record) => (
                  <li key={`${record.label}-${record.url}`}>
                    <a
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-background"
                      href={record.url}
                    >
                      <LinkIcon aria-hidden="true" className="h-4 w-4" />
                      {record.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                No authorized linked records are available for this alert.
              </p>
            )}
          </section>
        </section>
      ) : null}
    </article>
  );
}

function TimelineTaskFilters({
  filters,
  onClearFilters,
  onFilterChange,
  onSortChange,
  review,
  sortKey,
}: {
  filters: LaunchTimelineFilters;
  onClearFilters: () => void;
  onFilterChange: <Key extends keyof LaunchTimelineFilters>(
    key: Key,
    value: LaunchTimelineFilters[Key],
  ) => void;
  onSortChange: (sortKey: LaunchTimelineSortKey) => void;
  review: ReturnType<typeof buildLaunchTimelineReview>;
  sortKey: LaunchTimelineSortKey;
}) {
  return (
    <section
      aria-label="Timeline task filters"
      className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm"
    >
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 font-medium text-syneos-purple">
            <Filter aria-hidden="true" className="h-4 w-4" />
            Task filters
          </p>
          <h3 className="mt-2 font-semibold">Scan launch work by signal</h3>
        </div>
        <label className="grid gap-1 font-medium">
          Sort by
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onSortChange(event.target.value as LaunchTimelineSortKey)
            }
            value={sortKey}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 font-medium">
          Phase
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) => onFilterChange("phase", event.target.value)}
            value={filters.phase}
          >
            <option value="">All phases</option>
            {review.filterOptions.phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Owner
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) => onFilterChange("owner", event.target.value)}
            value={filters.owner}
          >
            <option value="">All owners</option>
            {review.filterOptions.owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Status
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onFilterChange(
                "status",
                event.target.value as LaunchTimelineFilters["status"],
              )
            }
            value={filters.status}
          >
            <option value="">All statuses</option>
            {Object.entries(timelineTaskStatusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Risk
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onFilterChange(
                "risk",
                event.target.value as LaunchTimelineFilters["risk"],
              )
            }
            value={filters.risk}
          >
            {riskFilterOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Blocker
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onFilterChange(
                "blocker",
                event.target.value as LaunchTimelineFilters["blocker"],
              )
            }
            value={filters.blocker}
          >
            {blockerFilterOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Handoff
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onFilterChange(
                "handoffRelevance",
                event.target.value as LaunchTimelineFilters["handoffRelevance"],
              )
            }
            value={filters.handoffRelevance}
          >
            {handoffFilterOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Due date
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) => onFilterChange("dueDate", event.target.value)}
            value={filters.dueDate}
          >
            <option value="">All due dates</option>
            {review.filterOptions.dueDates.map((dueDate) => (
              <option key={dueDate} value={dueDate}>
                {dueDate}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 font-medium">
          Source freshness
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            onChange={(event) =>
              onFilterChange(
                "sourceFreshness",
                event.target.value as SourceFreshnessState | "",
              )
            }
            value={filters.sourceFreshness}
          >
            <option value="">All freshness states</option>
            {review.filterOptions.sourceFreshnessStates.map((freshnessState) => (
              <option key={freshnessState} value={freshnessState}>
                {freshnessStateLabels[freshnessState]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section
        aria-label="Active timeline filters"
        className="mt-4 rounded-md border border-border bg-background px-4 py-3"
      >
        {review.activeFilters.length > 0 ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap gap-2">
              {review.activeFilters.map((filter) => (
                <li
                  className="rounded-md border border-border px-3 py-1 font-medium"
                  key={filter.key}
                >
                  {filter.label}: {filter.value}
                </li>
              ))}
            </ul>
            <button
              className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-background"
              onClick={onClearFilters}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Clear timeline filters
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground">No active timeline filters.</p>
        )}
      </section>
    </section>
  );
}

function TimelineStatusSummary({
  statusCounts,
}: {
  statusCounts: Record<keyof typeof timelineTaskStatusLabels, number>;
}) {
  return (
    <dl
      aria-label="Timeline status summary"
      className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"
    >
      {Object.entries(timelineTaskStatusLabels).map(([status, label]) => (
        <div
          className="rounded-md border border-border bg-background px-3 py-2"
          key={status}
        >
          <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            {label}
          </dt>
          <dd className="text-lg font-semibold">
            {statusCounts[status as keyof typeof timelineTaskStatusLabels]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TimelineTaskRow({
  isSelected = false,
  onSelect,
  task,
}: {
  isSelected?: boolean;
  onSelect?: () => void;
  task: LaunchTimelineTask;
}) {
  const provenance = task.sourceProvenance;

  return (
    <article
      aria-label={`Timeline task: ${task.taskName}`}
      className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-syneos-teal">
            Phase: {task.phase}
          </p>
          <h5 className="text-base font-semibold">{task.taskName}</h5>
          <p className="text-muted-foreground">Owner role: {task.ownerLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border px-3 py-1 font-medium">
            Status: {task.timelineStatusLabel}
          </span>
          <button
            aria-controls="timeline-task-details"
            aria-expanded={isSelected}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-card"
            onClick={onSelect}
            type="button"
          >
            <SearchCheck aria-hidden="true" className="h-4 w-4" />
            Review details for {task.taskName}
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        <TaskTerm label="Due date" value={task.dueDateLabel} />
        <TaskTerm label="Dependencies" value={task.dependencySummary} />
        <TaskTerm label="Blocker" value={task.blockerSummary} />
        <TaskTerm label="Handoff relevance" value={task.handoffRelevance} />
        <TaskTerm
          label="Critical path"
          value={task.criticalPath ? "Yes" : "No"}
        />
        <TaskTerm label="Source freshness" value={task.sourceFreshnessLabel} />
      </dl>

      {task.attentionSignals.length > 0 ? (
        <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
          <AlertTriangle
            aria-hidden="true"
            className="mr-2 inline h-4 w-4 text-syneos-orange"
          />
          Signals: {task.attentionSignals.join(", ")}
        </p>
      ) : null}

      <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground">
        <FileText aria-hidden="true" className="mr-2 inline h-4 w-4" />
        Source: {provenance.sourceName}; Source system:{" "}
        {provenance.sourceSystemLabel}; Approval: {provenance.approvalLabel};
        Freshness: {provenance.freshnessLabel}; Access:{" "}
        {provenance.accessLabel}; Ingestion: {provenance.ingestionLabel}
      </p>
    </article>
  );
}

function TimelineTaskDetails({
  selectedTask,
  selectedTaskDetails,
}: {
  selectedTask?: LaunchTimelineTask;
  selectedTaskDetails?: ReturnType<typeof getLaunchTimelineTaskDetails>;
}) {
  return (
    <section
      aria-label="Timeline task details"
      className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm"
      id="timeline-task-details"
    >
      <p className="inline-flex items-center gap-2 font-medium text-syneos-teal">
        <SearchCheck aria-hidden="true" className="h-4 w-4" />
        Task details
      </p>
      <h3 className="mt-2 font-semibold">Normalized task metadata</h3>
      {selectedTask && selectedTaskDetails ? (
        <div className="mt-4 grid gap-4">
          <div>
            <h4 className="text-base font-semibold">
              {selectedTaskDetails.taskName}
            </h4>
            <p className="text-muted-foreground">
              Status: {selectedTask.timelineStatusLabel}; Source freshness:{" "}
              {selectedTask.sourceFreshnessLabel}
            </p>
          </div>

          <dl className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {selectedTaskDetails.normalizedMetadata.map((item) => (
              <TaskTerm key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>

          <section aria-label="Dependency context">
            <h4 className="font-semibold">Dependency context</h4>
            {selectedTaskDetails.dependencyContext.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {selectedTaskDetails.dependencyContext.map((dependency) => (
                  <li
                    className="rounded-md border border-border bg-background px-3 py-2"
                    key={dependency.taskId}
                  >
                    Dependency task: {dependency.taskName}; Status:{" "}
                    {dependency.timelineStatusLabel}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                No dependency context is linked to this task.
              </p>
            )}
          </section>

          <section aria-label="Linked task records">
            <h4 className="font-semibold">Linked records</h4>
            {selectedTaskDetails.linkedRecords.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {selectedTaskDetails.linkedRecords.map((record) => (
                  <li key={`${record.label}-${record.url}`}>
                    <a
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-background"
                      href={record.url}
                    >
                      <LinkIcon aria-hidden="true" className="h-4 w-4" />
                      {record.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                No authorized linked records are available for this task.
              </p>
            )}
          </section>
        </div>
      ) : (
        <p className="mt-4 text-muted-foreground">
          Select a timeline task to review normalized metadata.
        </p>
      )}
    </section>
  );
}

function TemplateProvenanceSummary({
  optionName,
  provenance,
}: {
  optionName: string;
  provenance: GeneratedLaunchTask["sourceProvenance"];
}) {
  return (
    <section
      aria-label="Selected Playbook provenance"
      className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm"
    >
      <h4 className="font-semibold">{optionName}</h4>
      <p className="mt-2 text-muted-foreground">
        Source: {provenance.sourceName}; Source system:{" "}
        {provenance.sourceSystemLabel}; Approval: {provenance.approvalLabel};
        Freshness: {provenance.freshnessLabel}; Access:{" "}
        {provenance.accessLabel}; Ingestion: {provenance.ingestionLabel}
      </p>
    </section>
  );
}

function TaskTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="[overflow-wrap:anywhere]">
        {label}: {value}
      </dd>
    </div>
  );
}

function formatList(items: string[]) {
  if (items.length === 0) {
    return "None";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function stripTermPrefix(value: string) {
  return value.replace(/^[^:]+:\s*/, "");
}

function AuditTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="[overflow-wrap:anywhere]">
        {label}: {value}
      </dd>
    </div>
  );
}

function mergeTimelineTaskInputs(
  generatedTasks: GeneratedLaunchTask[],
  ingestedTimelineTasks: LaunchTimelineTaskInput[],
): LaunchTimelineTaskInput[] {
  const taskIds = new Set<string>();
  const mergedTasks: LaunchTimelineTaskInput[] = [];

  for (const task of [...generatedTasks, ...ingestedTimelineTasks]) {
    if (taskIds.has(task.taskId)) {
      continue;
    }

    taskIds.add(task.taskId);
    mergedTasks.push(task);
  }

  return mergedTasks;
}
