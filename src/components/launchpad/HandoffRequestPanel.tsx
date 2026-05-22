"use client";

import { CheckCircle2, ClipboardCheck, History, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createPrototypeHandoffArtifacts,
  getHandoffResponsibleOwner,
  handoffHistoryStateLabels,
  handoffSectionLabels,
  handoffSectionOrder,
  handoffStatusLabels,
  markHandoffReadyForReview,
  prototypeHandoffSupportingSources,
  requestReusableHandoff,
  saveHandoffStructuredContent,
  validateHandoffRequest,
  validateHandoffReadiness,
  type HandoffArtifact,
  type HandoffAuditEvent,
  type HandoffContentInput,
  type HandoffHistoryEntry,
  type HandoffReadinessValidationError,
  type HandoffRequestInput,
  type HandoffSectionKey,
  type HandoffSectionState,
  type HandoffStructuredContent,
  type HandoffSupportingSource,
  type HandoffValidationError,
} from "@/domain/handoff";
import {
  accessStateLabels,
  approvalStateLabels,
  freshnessStateLabels,
} from "@/domain/source-ledger";
import type { WorkspaceSession } from "@/domain/workspace";

type HandoffRequestPanelProps = {
  initialArtifacts?: HandoffArtifact[];
  onHandoffAuditEvent?: (event: HandoffAuditEvent) => void;
  session: WorkspaceSession;
};

type FormState = {
  purpose: string;
  receivingTeam: string;
  requestedTiming: string;
  selectedSourceIds: string[];
  sendingTeam: string;
  workstreamId: string;
};

type SectionFormState = {
  selectedSourceIds: string[];
  state: HandoffSectionState;
  text: string;
};

type StructuredContentFormState = Record<HandoffSectionKey, SectionFormState>;

const initialFormState: FormState = {
  purpose: "",
  receivingTeam: "Deployment Solutions",
  requestedTiming: "",
  selectedSourceIds: [],
  sendingTeam: "Launch Operations",
  workstreamId: "deployment-readiness",
};

const sendingTeamOptions = [
  "Launch Operations",
  "Project Management",
  "Sales Operations",
  "Launch Excellence",
];

const receivingTeamOptions = [
  "Deployment Solutions",
  "Learning Solutions",
  "Patient Services",
  "Medical Affairs",
];

const sectionStateOptions: HandoffSectionState[] = [
  "current",
  "missing",
  "stale",
  "superseded",
  "conflicting",
];

export function HandoffRequestPanel({
  initialArtifacts = createPrototypeHandoffArtifacts(),
  onHandoffAuditEvent,
  session,
}: HandoffRequestPanelProps) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [formState, setFormState] = useState(initialFormState);
  const [contentState, setContentState] = useState<StructuredContentFormState>(
    () => buildContentFormState(initialArtifacts[0] ?? null),
  );
  const [validationErrors, setValidationErrors] = useState<
    HandoffValidationError[]
  >([]);
  const [readinessErrors, setReadinessErrors] = useState<
    HandoffReadinessValidationError[]
  >([]);
  const [readinessAlert, setReadinessAlert] = useState("");
  const [latestArtifact, setLatestArtifact] = useState<HandoffArtifact | null>(
    initialArtifacts[0] ?? null,
  );
  const [latestAuditEvent, setLatestAuditEvent] =
    useState<HandoffAuditEvent | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const errorByField = useMemo(
    () =>
      new Map(validationErrors.map((error) => [error.field, error.message])),
    [validationErrors],
  );
  const readinessErrorByField = useMemo(
    () =>
      new Map(readinessErrors.map((error) => [error.field, error.message])),
    [readinessErrors],
  );
  const sourceById = useMemo(
    () => new Map(collectKnownSources(latestArtifact).map((source) => [
      source.sourceId,
      source,
    ])),
    [latestArtifact],
  );
  const canViewRestrictedSources = session.user.role === "admin";

  function updateForm<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleSource(sourceId: string) {
    setFormState((current) => ({
      ...current,
      selectedSourceIds: current.selectedSourceIds.includes(sourceId)
        ? current.selectedSourceIds.filter((candidate) => candidate !== sourceId)
        : [...current.selectedSourceIds, sourceId],
    }));
  }

  function updateContentSection<Key extends keyof SectionFormState>(
    section: HandoffSectionKey,
    key: Key,
    value: SectionFormState[Key],
  ) {
    setContentState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  }

  function toggleSectionSource(section: HandoffSectionKey, sourceId: string) {
    setContentState((current) => {
      const selectedSourceIds = current[section].selectedSourceIds.includes(
        sourceId,
      )
        ? current[section].selectedSourceIds.filter(
            (candidate) => candidate !== sourceId,
          )
        : [...current[section].selectedSourceIds, sourceId];

      return {
        ...current,
        [section]: {
          ...current[section],
          selectedSourceIds,
        },
      };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = buildRequestInput(
      formState,
      session.launch.id,
      formState.selectedSourceIds
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source): source is HandoffSupportingSource => Boolean(source)),
    );
    const errors = validateHandoffRequest(input);

    setValidationErrors(errors);

    if (errors.length > 0) {
      setStatusMessage("");
      return;
    }

    const result = requestReusableHandoff(artifacts, input, {
      actorId: session.user.name,
    });

    setArtifacts(result.artifacts);
    setLatestArtifact(result.artifact);
    setContentState(buildContentFormState(result.artifact));
    setReadinessAlert("");
    setReadinessErrors([]);
    setLatestAuditEvent(result.auditEvent);
    setStatusMessage(
      `${formatActionLabel(result.action)} reusable Digital Handoff Artifact ${
        result.artifact.handoffId
      }.`,
    );
    onHandoffAuditEvent?.(result.auditEvent);
  }

  function handleSaveDraft() {
    if (!latestArtifact) {
      return;
    }

    const result = saveHandoffStructuredContent(
      artifacts,
      latestArtifact.handoffId,
      buildContentInput(contentState, sourceById),
      {
        actorId: session.user.name,
      },
    );

    setArtifacts(result.artifacts);
    setLatestArtifact(result.artifact);
    setContentState(buildContentFormState(result.artifact));
    setReadinessErrors(validateHandoffReadiness(result.artifact));
    setReadinessAlert("");
    setLatestAuditEvent(result.auditEvent);
    setStatusMessage(
      `Saved draft Digital Handoff Artifact ${result.artifact.handoffId}.`,
    );
    onHandoffAuditEvent?.(result.auditEvent);
  }

  function handleMarkReadyForReview() {
    if (!latestArtifact) {
      return;
    }

    const candidateArtifact: HandoffArtifact = {
      ...latestArtifact,
      structuredContent: buildStructuredContentPreview(contentState, sourceById),
    };
    const errors = validateHandoffReadiness(candidateArtifact);

    setReadinessErrors(errors);

    if (errors.length > 0) {
      setReadinessAlert(errors.map((error) => error.message).join(" "));
      setStatusMessage("");
      return;
    }

    const draft = saveHandoffStructuredContent(
      artifacts,
      latestArtifact.handoffId,
      buildContentInput(contentState, sourceById),
      {
        actorId: session.user.name,
      },
    );
    const ready = markHandoffReadyForReview(
      draft.artifacts,
      latestArtifact.handoffId,
      {
        actorId: session.user.name,
      },
    );

    setArtifacts(ready.artifacts);
    setLatestArtifact(ready.artifact);
    setContentState(buildContentFormState(ready.artifact));
    setReadinessAlert("");
    setReadinessErrors([]);
    setLatestAuditEvent(ready.auditEvent);
    setStatusMessage(
      `Marked Digital Handoff Artifact ready for review ${ready.artifact.handoffId}.`,
    );
    onHandoffAuditEvent?.(draft.auditEvent);
    onHandoffAuditEvent?.(ready.auditEvent);
  }

  return (
    <section aria-labelledby="handoff-title" className="grid gap-4">
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
          <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          Digital Handoff Artifact
        </p>
        <h2
          className="text-2xl font-semibold tracking-normal"
          id="handoff-title"
        >
          Handoff
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Request reusable handoff context for a receiving team while preserving
          source provenance, history, responsible ownership, and audit details.
        </p>
      </div>

      <form
        aria-label="Request reusable handoff"
        className="rounded-lg border border-border bg-card p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center gap-2">
          <Send aria-hidden="true" className="h-4 w-4 text-syneos-orange" />
          <h3 className="font-semibold">Request reusable handoff</h3>
        </div>

        {validationErrors.length > 0 ? (
          <div
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
            role="alert"
          >
            {validationErrors.map((error) => error.message).join(" ")}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Launch or workstream
            <input
              aria-describedby={
                errorByField.has("workstreamId")
                  ? "workstream-error"
                  : undefined
              }
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateForm("workstreamId", event.target.value)
              }
              value={formState.workstreamId}
            />
            <FieldError id="workstream-error" message={errorByField.get(
              "workstreamId",
            )} />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Sending team
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateForm("sendingTeam", event.target.value)
              }
              value={formState.sendingTeam}
            >
              {sendingTeamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Receiving team
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateForm("receivingTeam", event.target.value)
              }
              value={formState.receivingTeam}
            >
              {receivingTeamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Requested timing
            <input
              aria-describedby={
                errorByField.has("requestedTiming")
                  ? "requested-timing-error"
                  : undefined
              }
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                updateForm("requestedTiming", event.target.value)
              }
              placeholder="Before kickoff"
              value={formState.requestedTiming}
            />
            <FieldError
              id="requested-timing-error"
              message={errorByField.get("requestedTiming")}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Handoff purpose
            <textarea
              aria-describedby={
                errorByField.has("purpose") ? "purpose-error" : undefined
              }
              className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) => updateForm("purpose", event.target.value)}
              placeholder="Describe why the receiving team needs this handoff."
              value={formState.purpose}
            />
            <FieldError
              id="purpose-error"
              message={errorByField.get("purpose")}
            />
          </label>
        </div>

        <fieldset className="mt-4 grid gap-2">
          <legend className="text-sm font-semibold">Supporting sources</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {prototypeHandoffSupportingSources.map((source) => (
              <label
                className="flex min-h-11 items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                key={source.sourceId}
              >
                <input
                  checked={formState.selectedSourceIds.includes(
                    source.sourceId,
                  )}
                  className="mt-1"
                  onChange={() => toggleSource(source.sourceId)}
                  type="checkbox"
                />
                <span>
                  {getSourceDisplayName(source, canViewRestrictedSources)}
                  <SourceMetadata
                    canViewRestrictedSources={canViewRestrictedSources}
                    source={source}
                  />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-syneos-orange px-4 py-2 text-sm font-semibold text-white hover:bg-syneos-dark-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-teal"
          type="submit"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
          Request handoff
        </button>
      </form>

      {statusMessage ? (
        <div
          className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {statusMessage}
        </div>
      ) : null}

      {latestArtifact ? (
        <HandoffContentWorkspace
          canViewRestrictedSources={canViewRestrictedSources}
          contentState={contentState}
          onMarkReadyForReview={handleMarkReadyForReview}
          onSaveDraft={handleSaveDraft}
          onToggleSource={toggleSectionSource}
          onUpdateSection={updateContentSection}
          readinessAlert={readinessAlert}
          readinessErrorByField={readinessErrorByField}
        />
      ) : null}

      {latestArtifact ? (
        <HandoffArtifactSummary
          artifact={latestArtifact}
          canViewRestrictedSources={canViewRestrictedSources}
        />
      ) : null}

      {latestAuditEvent ? (
        <section
          aria-label="Latest audit event"
          className="rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <h3 className="font-semibold">Latest audit event</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <AuditTerm label="Action" value={formatActionLabel(
              latestAuditEvent.metadata.action,
            )} />
            <AuditTerm label="Actor" value={latestAuditEvent.actorId} />
            <AuditTerm label="Launch ID" value={latestAuditEvent.launchId} />
            <AuditTerm label="Workstream ID" value={
              latestAuditEvent.metadata.workstreamId
            } />
            <AuditTerm label="Handoff ID" value={latestAuditEvent.handoffId} />
            <AuditTerm
              label="Sending team"
              value={latestAuditEvent.metadata.sendingTeam}
            />
            <AuditTerm
              label="Receiving team"
              value={latestAuditEvent.metadata.receivingTeam}
            />
            <AuditTerm label="Timestamp" value={latestAuditEvent.occurredAt} />
            <AuditTerm
              label="Correlation ID"
              value={latestAuditEvent.correlationId}
            />
          </dl>
        </section>
      ) : null}
    </section>
  );
}

function HandoffContentWorkspace({
  canViewRestrictedSources,
  contentState,
  onMarkReadyForReview,
  onSaveDraft,
  onToggleSource,
  onUpdateSection,
  readinessAlert,
  readinessErrorByField,
}: {
  canViewRestrictedSources: boolean;
  contentState: StructuredContentFormState;
  onMarkReadyForReview: () => void;
  onSaveDraft: () => void;
  onToggleSource: (section: HandoffSectionKey, sourceId: string) => void;
  onUpdateSection: <Key extends keyof SectionFormState>(
    section: HandoffSectionKey,
    key: Key,
    value: SectionFormState[Key],
  ) => void;
  readinessAlert: string;
  readinessErrorByField: Map<HandoffSectionKey, string>;
}) {
  return (
    <section
      aria-label="Structured handoff content"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">Complete handoff content</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-teal"
            onClick={onSaveDraft}
            type="button"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            Save draft
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-syneos-teal px-3 py-2 text-sm font-semibold text-white hover:bg-syneos-dark-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-orange"
            onClick={onMarkReadyForReview}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Mark ready for review
          </button>
        </div>
      </div>

      {readinessAlert ? (
        <div
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
          role="alert"
        >
          {readinessAlert}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {handoffSectionOrder.map((section) => {
          const label = handoffSectionLabels[section];
          const error = readinessErrorByField.get(section);
          const errorId = `${section}-content-error`;

          return (
            <fieldset
              className="rounded-md border border-border bg-background p-4"
              key={section}
            >
              <legend className="px-1 text-sm font-semibold">{label}</legend>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <label className="grid gap-1 text-sm font-medium">
                  {label} content
                  <textarea
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? "true" : undefined}
                    className="min-h-24 rounded-md border border-input bg-card px-3 py-2 text-sm"
                    onChange={(event) =>
                      onUpdateSection(section, "text", event.target.value)
                    }
                    value={contentState[section].text}
                  />
                  <FieldError id={errorId} message={error} />
                </label>
                <label className="grid content-start gap-1 text-sm font-medium">
                  {label} state
                  <select
                    className="min-h-10 rounded-md border border-input bg-card px-3 py-2 text-sm"
                    onChange={(event) =>
                      onUpdateSection(
                        section,
                        "state",
                        event.target.value as HandoffSectionState,
                      )
                    }
                    value={contentState[section].state}
                  >
                    {sectionStateOptions.map((state) => (
                      <option key={state} value={state}>
                        {handoffHistoryStateLabels[state]}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-normal text-muted-foreground">
                    Current state:{" "}
                    {handoffHistoryStateLabels[contentState[section].state]}
                  </span>
                </label>
              </div>

              <fieldset className="mt-3 grid gap-2">
                <legend className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {label} source links
                </legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {prototypeHandoffSupportingSources.map((source) => (
                    <label
                      className="flex min-h-11 items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                      key={source.sourceId}
                    >
                      <input
                        aria-label={`Link ${getSourceDisplayName(
                          source,
                          canViewRestrictedSources,
                        )} to ${label}`}
                        checked={contentState[
                          section
                        ].selectedSourceIds.includes(source.sourceId)}
                        className="mt-1"
                        onChange={() =>
                          onToggleSource(section, source.sourceId)
                        }
                        type="checkbox"
                      />
                      <span>
                        {getSourceDisplayName(source, canViewRestrictedSources)}
                        <SourceMetadata
                          canViewRestrictedSources={canViewRestrictedSources}
                          source={source}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function HandoffArtifactSummary({
  artifact,
  canViewRestrictedSources,
}: {
  artifact: HandoffArtifact;
  canViewRestrictedSources: boolean;
}) {
  return (
    <article
      aria-label="Digital Handoff Artifact"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
            <History aria-hidden="true" className="h-4 w-4" />
            Reusable artifact
          </p>
          <h3 className="text-xl font-semibold tracking-normal">
            {artifact.receivingTeam} handoff
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-md border border-border px-3 py-1 font-medium">
            Status: {handoffStatusLabels[artifact.status]}
          </span>
          <span className="rounded-md border border-border px-3 py-1 font-medium">
            Responsible owner: {getHandoffResponsibleOwner(artifact)}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <ArtifactTerm label="Launch ID" value={artifact.launchId} />
        <ArtifactTerm label="Workstream ID" value={artifact.workstreamId} />
        <ArtifactTerm label="Sending team" value={artifact.sendingTeam} />
        <ArtifactTerm label="Receiving team" value={artifact.receivingTeam} />
        <ArtifactTerm label="Requested timing" value={artifact.requestedTiming} />
        <ArtifactTerm label="Purpose" value={artifact.purpose} />
      </dl>

      <section aria-label="Structured content summary" className="mt-5">
        <h4 className="text-sm font-semibold">Structured content</h4>
        <ul className="mt-2 grid gap-2 text-sm lg:grid-cols-2">
          {handoffSectionOrder.map((section) => (
            <li
              className="rounded-md border border-border bg-background px-3 py-3"
              key={section}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <h5 className="font-semibold">
                  {handoffSectionLabels[section]}
                </h5>
                <span className="font-medium">
                  State:{" "}
                  {
                    handoffHistoryStateLabels[
                      artifact.structuredContent[section].state
                    ]
                  }
                </span>
              </div>
              <p className="mt-2">
                {artifact.structuredContent[section].text ||
                  "Missing section content."}
              </p>
              <SectionSourceList
                canViewRestrictedSources={canViewRestrictedSources}
                sources={artifact.structuredContent[section].supportingSources}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Supporting source references" className="mt-5">
        <h4 className="text-sm font-semibold">Supporting sources</h4>
        {artifact.supportingSources.length > 0 ? (
          <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            {artifact.supportingSources.map((source) => (
              <li
                className="rounded-md border border-border bg-background px-3 py-2"
                key={source.sourceId}
              >
                {getSourceDisplayName(source, canViewRestrictedSources)}
                <SourceMetadata
                  canViewRestrictedSources={canViewRestrictedSources}
                  source={source}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No supporting sources attached yet.
          </p>
        )}
      </section>

      <section aria-label="Handoff history" className="mt-5">
        <h4 className="text-sm font-semibold">Handoff history</h4>
        <ol className="mt-2 divide-y divide-border rounded-md border border-border">
          {artifact.history.map((entry, index) => (
            <HandoffHistoryRow
              canViewRestrictedSources={canViewRestrictedSources}
              entry={entry}
              isLatest={index === artifact.history.length - 1}
              key={entry.historyId}
            />
          ))}
        </ol>
      </section>
    </article>
  );
}

function HandoffHistoryRow({
  canViewRestrictedSources,
  entry,
  isLatest,
}: {
  canViewRestrictedSources: boolean;
  entry: HandoffHistoryEntry;
  isLatest: boolean;
}) {
  return (
    <li className="grid gap-2 bg-background px-3 py-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">
          {isLatest ? "New request update" : "Previously handed-off context"}
        </p>
        <span className="text-sm font-medium">
          State: {handoffHistoryStateLabels[entry.state]}
        </span>
      </div>
      <p>{entry.purpose}</p>
      <dl className="grid gap-1 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <HistoryTerm label="Actor" value={entry.actorId} />
        <HistoryTerm label="Timestamp" value={entry.occurredAt} />
        <HistoryTerm label="Sending team" value={entry.sendingTeam} />
        <HistoryTerm label="Receiving team" value={entry.receivingTeam} />
        <HistoryTerm label="Timing" value={entry.requestedTiming} />
        <HistoryTerm label="Provenance" value={entry.provenanceLabel} />
      </dl>
      {entry.supportingSources.length > 0 ? (
        <p className="text-muted-foreground">
          Sources:{" "}
          {entry.supportingSources
            .map((source) =>
              getSourceDisplayName(source, canViewRestrictedSources),
            )
            .join(", ")}
        </p>
      ) : (
        <p className="text-muted-foreground">Sources: Missing source link</p>
      )}
      {entry.structuredContent ? (
        <PriorStructuredContentSnapshot content={entry.structuredContent} />
      ) : null}
    </li>
  );
}

function PriorStructuredContentSnapshot({
  content,
}: {
  content: HandoffStructuredContent;
}) {
  return (
    <section
      aria-label="Prior structured content snapshot"
      className="rounded-md border border-border bg-card px-3 py-2"
    >
      <p className="font-semibold">Prior structured content snapshot</p>
      <ul className="mt-2 grid gap-2">
        {handoffSectionOrder
          .filter((section) => content[section].text.trim())
          .map((section) => (
            <li key={section}>
              <span className="font-medium">
                {handoffSectionLabels[section]}:{" "}
              </span>
              {content[section].text}
              <span className="block text-xs text-muted-foreground">
                State: {handoffHistoryStateLabels[content[section].state]}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}

function SectionSourceList({
  canViewRestrictedSources,
  sources,
}: {
  canViewRestrictedSources: boolean;
  sources: HandoffSupportingSource[];
}) {
  if (sources.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Sources: Missing source link
      </p>
    );
  }

  return (
    <ul className="mt-2 grid gap-2">
      {sources.map((source) => (
        <li
          className="rounded-md border border-border bg-card px-3 py-2"
          key={source.sourceId}
        >
          {getSourceDisplayName(source, canViewRestrictedSources)}
          <SourceMetadata
            canViewRestrictedSources={canViewRestrictedSources}
            source={source}
          />
        </li>
      ))}
    </ul>
  );
}

function SourceMetadata({
  canViewRestrictedSources,
  source,
}: {
  canViewRestrictedSources: boolean;
  source: HandoffSupportingSource;
}) {
  const isRestricted = source.accessState === "restricted";

  return (
    <span className="block text-xs text-muted-foreground">
      {isRestricted && !canViewRestrictedSources
        ? "Restricted source details are hidden. "
        : null}
      Provenance: {source.provenanceLabel}; Freshness:{" "}
      {source.freshnessState
        ? freshnessStateLabels[source.freshnessState]
        : "Not provided"}
      ; Approval:{" "}
      {source.approvalState
        ? approvalStateLabels[source.approvalState]
        : "Not provided"}
      ; Access:{" "}
      {source.accessState ? accessStateLabels[source.accessState] : "Not provided"}
    </span>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  return message ? (
    <span className="text-sm font-normal text-destructive" id={id}>
      {message}
    </span>
  ) : null;
}

function ArtifactTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd>
        {label}: {value}
      </dd>
    </div>
  );
}

function AuditTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd>
        {label}: {value}
      </dd>
    </div>
  );
}

function HistoryTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        {label}: {value}
      </dd>
    </div>
  );
}

function buildRequestInput(
  formState: FormState,
  launchId: string,
  supportingSources: HandoffSupportingSource[],
): HandoffRequestInput {
  return {
    launchId,
    purpose: formState.purpose,
    receivingTeam: formState.receivingTeam,
    requestedTiming: formState.requestedTiming,
    sendingTeam: formState.sendingTeam,
    supportingSources,
    workstreamId: formState.workstreamId,
  };
}

function buildContentFormState(
  artifact: HandoffArtifact | null,
): StructuredContentFormState {
  return handoffSectionOrder.reduce((state, section) => {
    const content = artifact?.structuredContent[section];

    state[section] = {
      selectedSourceIds:
        content?.supportingSources.map((source) => source.sourceId) ?? [],
      state: content?.state ?? "missing",
      text: content?.text ?? "",
    };

    return state;
  }, {} as StructuredContentFormState);
}

function buildContentInput(
  contentState: StructuredContentFormState,
  sourceById: Map<string, HandoffSupportingSource>,
): HandoffContentInput {
  return handoffSectionOrder.reduce((input, section) => {
    input[section] = {
      state: contentState[section].state,
      supportingSources: contentState[section].selectedSourceIds
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source): source is HandoffSupportingSource => Boolean(source)),
      text: contentState[section].text,
    };

    return input;
  }, {} as HandoffContentInput);
}

function buildStructuredContentPreview(
  contentState: StructuredContentFormState,
  sourceById: Map<string, HandoffSupportingSource>,
): HandoffStructuredContent {
  const input = buildContentInput(contentState, sourceById);

  return handoffSectionOrder.reduce((content, section) => {
    content[section] = {
      state: input[section].state,
      supportingSources: input[section].supportingSources,
      text: input[section].text.trim(),
    };

    return content;
  }, {} as HandoffStructuredContent);
}

function collectKnownSources(artifact: HandoffArtifact | null) {
  const sourceById = new Map<string, HandoffSupportingSource>();

  for (const source of prototypeHandoffSupportingSources) {
    sourceById.set(source.sourceId, source);
  }

  if (artifact) {
    for (const source of artifact.supportingSources) {
      sourceById.set(source.sourceId, source);
    }

    for (const section of handoffSectionOrder) {
      for (const source of artifact.structuredContent[section]
        .supportingSources) {
        sourceById.set(source.sourceId, source);
      }
    }
  }

  return [...sourceById.values()];
}

function getSourceDisplayName(
  source: HandoffSupportingSource,
  canViewRestrictedSources: boolean,
) {
  if (source.accessState === "restricted" && !canViewRestrictedSources) {
    return "Restricted source";
  }

  return source.title;
}

function formatActionLabel(value: string) {
  const [firstPart, ...remainingParts] = value.split("_");

  return [
    `${firstPart.charAt(0).toUpperCase()}${firstPart.slice(1)}`,
    ...remainingParts,
  ].join(" ");
}
