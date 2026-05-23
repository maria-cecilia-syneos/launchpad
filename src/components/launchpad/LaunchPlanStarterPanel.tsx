"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  PlayCircle,
} from "lucide-react";

import {
  createPrototypeLaunchPlanSources,
  generateLaunchPlanFromPlaybook,
  getPrototypeLaunchPlanStarterData,
  launchTaskStatusLabels,
  type GeneratedLaunchTask,
  type LaunchPlanGeneratedAuditEvent,
  type LaunchPlanSetupInput,
  type LaunchPlanValidationError,
} from "@/domain/launch-plan";
import type { SourceLedgerRecord } from "@/domain/source-ledger";
import type { WorkspaceSession } from "@/domain/workspace";

type LaunchPlanStarterPanelProps = {
  initialSources?: SourceLedgerRecord[];
  onAuditEvent?: (event: LaunchPlanGeneratedAuditEvent) => void;
  session: WorkspaceSession;
};

const defaultLaunchPlanSources = createPrototypeLaunchPlanSources();

export function LaunchPlanStarterPanel({
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
  const [statusMessage, setStatusMessage] = useState("");
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
      setLatestAuditEvent(undefined);
      setStatusMessage("");
      setValidationErrors(result.validationErrors);
      return;
    }

    setGeneratedTasks(result.tasks);
    setLatestAuditEvent(result.auditEvent);
    setValidationErrors([]);
    setStatusMessage(
      `Generated ${result.tasks.length} launch tasks for ${setup.launchName}.`,
    );
    onAuditEvent?.(result.auditEvent);
  }

  function clearGeneratedPlan() {
    setGeneratedTasks([]);
    setLatestAuditEvent(undefined);
    setStatusMessage("");
    setValidationErrors([]);
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
          then review the generated tasks with source provenance.
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

      <section
        aria-label="Generated launch tasks"
        className="rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
              <GitBranch aria-hidden="true" className="h-4 w-4" />
              Generated task list
            </p>
            <h3 className="mt-2 font-semibold">Launch execution tasks</h3>
          </div>
          <span className="w-fit rounded-md border border-border px-3 py-1 text-sm font-medium">
            Task count: {generatedTasks.length}
          </span>
        </div>

        {generatedTasks.length > 0 ? (
          <div className="grid gap-3">
            {generatedTasks.map((task) => (
              <TimelineTaskRow key={task.taskId} task={task} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No launch tasks have been generated yet.
          </p>
        )}
      </section>

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

export function TimelineTaskRow({ task }: { task: GeneratedLaunchTask }) {
  const provenance = task.sourceProvenance;

  return (
    <article
      aria-label={`Timeline task: ${task.taskName}`}
      className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-6"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-syneos-teal">
            Phase: {task.phase}
          </p>
          <h4 className="text-base font-semibold">{task.taskName}</h4>
          <p className="text-muted-foreground">Owner role: {task.ownerRole}</p>
        </div>
        <span className="w-fit rounded-md border border-border px-3 py-1 font-medium">
          Status: {launchTaskStatusLabels[task.status]}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <TaskTerm
          label="Due date logic"
          value={task.dueDateLogic ?? "Not provided by Playbook"}
        />
        <TaskTerm
          label="Dependencies"
          value={
            task.dependencyTaskIds.length > 0
              ? task.dependencyTaskIds.join(", ")
              : "None"
          }
        />
        <TaskTerm
          label="Handoff gate"
          value={task.handoffGate ?? "No handoff gate"}
        />
        <TaskTerm
          label="Critical path"
          value={task.criticalPath ? "Yes" : "No"}
        />
      </dl>

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
