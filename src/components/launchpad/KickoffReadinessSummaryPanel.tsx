"use client";

import { AlertTriangle, ClipboardCheck, Save } from "lucide-react";
import { useState } from "react";

import {
  handoffKickoffReadinessStateLabels,
  handoffKickoffReadinessStateOrder,
  handoffReviewAreaLabels,
  handoffReviewAreaOrder,
  type HandoffKickoffReadinessDecisionInput,
  type HandoffKickoffReadinessState,
  type HandoffReviewArea,
} from "@/domain/handoff";
import type { KickoffReadinessSummary } from "@/domain/kickoff-readiness";

type KickoffReadinessSummaryPanelProps = {
  onSaveDecision: (input: HandoffKickoffReadinessDecisionInput) => void;
  summary: KickoffReadinessSummary;
};

export function KickoffReadinessSummaryPanel({
  onSaveDecision,
  summary,
}: KickoffReadinessSummaryPanelProps) {
  const [area, setArea] = useState<HandoffReviewArea>("kickoffContext");
  const [state, setState] = useState<HandoffKickoffReadinessState>("ready");
  const [note, setNote] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveDecision({
      area,
      note,
      state,
    });
    setNote("");
  }

  return (
    <section
      aria-label="Kickoff readiness summary"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-syneos-teal">
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
            Kickoff readiness
          </p>
          <h3 className="font-semibold">{summary.title}</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {summary.summary}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.freshnessLabel}
          </p>
        </div>
        <span className="w-fit rounded-md border border-border px-3 py-1 text-sm font-medium">
          Eligibility: {summary.eligible ? "Ready for kickoff prep" : "Needs handoff readiness"}
        </span>
      </div>

      <section aria-label="Kickoff summary facts" className="mt-4">
        <h4 className="text-sm font-semibold">Summary facts</h4>
        <ul className="mt-2 grid gap-2 lg:grid-cols-2">
          {summary.sections.map((section) => (
            <li
              className="rounded-md border border-border bg-background px-3 py-3 text-sm"
              key={section.id}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-semibold">{section.label}</p>
                <span className="font-medium">
                  State: {section.stateLabel}
                </span>
              </div>
              <p className="mt-2">{section.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated by: {section.updatedBy ?? "Not provided"}; Timestamp:{" "}
                {section.updatedAt ?? "Not provided"}
              </p>
              <ReferenceIdList referenceIds={section.referenceIds} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Kickoff readiness gaps" className="mt-4">
        <h4 className="text-sm font-semibold">Readiness gaps</h4>
        {summary.gaps.length > 0 ? (
          <ul className="mt-2 grid gap-2">
            {summary.gaps.map((gap) => (
              <li
                className="rounded-md border border-border bg-background px-3 py-3 text-sm"
                key={gap.id}
              >
                <p className="font-semibold">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mr-2 inline h-4 w-4 text-syneos-orange"
                  />
                  {gap.label}: {gap.stateLabel}
                </p>
                <p className="mt-2">{gap.reason}</p>
                <dl className="mt-2 grid gap-1 text-muted-foreground">
                  <GapTerm label="Owner route" value={gap.ownerRoute} />
                  <GapTerm label="Source route" value={gap.sourceRoute} />
                  <GapTerm label="Next action" value={gap.nextAction} />
                </dl>
                <ReferenceIdList referenceIds={gap.referenceIds} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No kickoff readiness gaps are currently open.
          </p>
        )}
      </section>

      <section aria-label="Kickoff source references" className="mt-4">
        <h4 className="text-sm font-semibold">Source references</h4>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {summary.references.map((reference) => (
            <li
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              key={reference.id}
            >
              {reference.href ? (
                <a className="font-medium underline-offset-4 hover:underline" href={reference.href}>
                  {reference.title}
                </a>
              ) : (
                <span className="font-medium">{reference.title}</span>
              )}
              <span className="block text-xs text-muted-foreground">
                Type: {reference.sourceType}; Access: {reference.accessState};
                {" "}
                {reference.freshnessLabel}; Reference ID: {reference.id}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Kickoff readiness decision history" className="mt-4">
        <h4 className="text-sm font-semibold">Decision history</h4>
        {summary.decisionHistory.length > 0 ? (
          <ol className="mt-2 grid gap-2 text-sm">
            {summary.decisionHistory.map((decision) => (
              <li
                className="rounded-md border border-border bg-background px-3 py-2"
                key={decision.correlationId}
              >
                <p className="font-medium">
                  {decision.areaLabel}: {decision.stateLabel}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Actor: {decision.actorId}; Timestamp: {decision.occurredAt};
                  Owner route: {decision.ownerRoute}; Source route:{" "}
                  {decision.sourceRoute ?? "No source route available"}
                </p>
                {decision.note ? <p className="mt-1">{decision.note}</p> : null}
                <ReferenceIdList referenceIds={decision.referenceIds} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No kickoff readiness decisions have been saved yet.
          </p>
        )}
      </section>

      {summary.eligible ? (
        <form
          aria-label="Save kickoff readiness decision"
          className="mt-4 grid gap-3 rounded-md border border-border bg-background p-4"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Readiness area
              <select
                className="min-h-10 rounded-md border border-input bg-card px-3 py-2 text-sm"
                onChange={(event) =>
                  setArea(event.target.value as HandoffReviewArea)
                }
                value={area}
              >
                {handoffReviewAreaOrder.map((option) => (
                  <option key={option} value={option}>
                    {handoffReviewAreaLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Readiness state
              <select
                className="min-h-10 rounded-md border border-input bg-card px-3 py-2 text-sm"
                onChange={(event) =>
                  setState(event.target.value as HandoffKickoffReadinessState)
                }
                value={state}
              >
                {handoffKickoffReadinessStateOrder.map((option) => (
                  <option key={option} value={option}>
                    {handoffKickoffReadinessStateLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Decision note
            <textarea
              className="min-h-20 rounded-md border border-input bg-card px-3 py-2 text-sm"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add follow-up context, blocker rationale, or readiness note."
              value={note}
            />
          </label>
          <button
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-syneos-teal px-3 py-2 text-sm font-semibold text-white hover:bg-syneos-dark-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-orange"
            type="submit"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            Save readiness decision
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          Kickoff readiness decisions can be saved after the handoff is ready
          for review or accepted.
        </p>
      )}
    </section>
  );
}

function ReferenceIdList({ referenceIds }: { referenceIds: string[] }) {
  return referenceIds.length > 0 ? (
    <p className="mt-2 text-xs text-muted-foreground">
      References: {referenceIds.join(", ")}
    </p>
  ) : null;
}

function GapTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        {label}: {value}
      </dd>
    </div>
  );
}
