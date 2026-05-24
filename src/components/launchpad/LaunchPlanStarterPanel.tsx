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
        role: session.user.role,
      }),
    [initialIngestedTasks, session.user.role],
  );
  const timelineTasks: LaunchTimelineTaskInput[] =
    generatedTasks.length > 0 ? generatedTasks : ingestedTimelineTasks;
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
    ? getLaunchTimelineTaskDetails(selectedTask.taskId, timelineReview.filteredTasks)
    : undefined;

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
