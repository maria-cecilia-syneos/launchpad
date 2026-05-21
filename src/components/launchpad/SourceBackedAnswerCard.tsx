"use client";

import { FormEvent, useId, useState } from "react";
import { AlertCircle, ExternalLink, Lock, Sparkles } from "lucide-react";

import {
  answerStateLabels,
  type AnswerNextAction,
  type SourceBackedAnswer,
  type SourceCitation,
} from "@/domain/answer";
import type {
  AnswerFeedbackCategory,
  AnswerFeedbackRating,
  AuditSourceReference,
} from "@/domain/audit";

import { SourceProvenanceChip } from "./SourceProvenanceChip";

type AnswerFeedbackSubmission = {
  answerId: string;
  citedSources: AuditSourceReference[];
  rating: AnswerFeedbackRating;
  categories: AnswerFeedbackCategory[];
};

type SourceBackedAnswerCardProps = {
  answer: SourceBackedAnswer;
  onFeedbackSubmit?: (feedback: AnswerFeedbackSubmission) => void;
};

const feedbackCategories: Array<{
  id: AnswerFeedbackCategory;
  label: string;
}> = [
  { id: "usefulness", label: "Usefulness issue" },
  { id: "accuracy", label: "Accuracy issue" },
  { id: "source_quality", label: "Source quality issue" },
  { id: "missing_context", label: "Missing context" },
];

function getCitationLabel(citation: SourceCitation) {
  return `Citation ${citation.marker}: ${citation.title} from ${citation.system}`;
}

function getRestrictedCitationLabel(citation: SourceCitation) {
  return `Citation ${citation.marker}: restricted source`;
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

function getSourceReferences(answer: SourceBackedAnswer): AuditSourceReference[] {
  return answer.citations.map((citation) => ({
    accessState: citation.accessState,
    sourceId: citation.id,
    sourceSystem: citation.system,
  }));
}

function Citation({ citation }: { citation: SourceCitation }) {
  const label = getCitationLabel(citation);
  const safeHref = getSafeInternalHref(citation.href);

  if (citation.accessState === "restricted") {
    return (
      <li className="rounded-md border border-border bg-background px-3 py-2">
        <p className="font-medium">{getRestrictedCitationLabel(citation)}</p>
        <p className="text-muted-foreground">
          Restricted source details are hidden.
        </p>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
          <Lock aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Access: restricted</span>
        </span>
      </li>
    );
  }

  if (!safeHref) {
    return (
      <li className="rounded-md border border-border bg-background px-3 py-2">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">
          Source link unavailable.
        </p>
        <SourceProvenanceChip citation={citation} />
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border bg-background px-3 py-2">
      <a
        aria-label={label}
        className="inline-flex items-center gap-1 font-medium text-syneos-orange underline-offset-4 hover:underline"
        href={safeHref}
      >
        [{citation.marker}] {citation.title}
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
      <p className="text-muted-foreground">
        {citation.freshnessLabel.replace("Freshness:", "Updated:")}
      </p>
      <SourceProvenanceChip citation={citation} />
    </li>
  );
}

function CitationReference({ citation }: { citation: SourceCitation }) {
  const citationLabel =
    citation.accessState === "restricted"
      ? getRestrictedCitationLabel(citation)
      : getCitationLabel(citation);
  const label = `${citationLabel} referenced by retrieved fact`;
  const safeHref = getSafeInternalHref(citation.href);

  if (citation.accessState === "authorized" && safeHref) {
    return (
      <a
        aria-label={label}
        className="ml-1 font-medium text-syneos-orange underline-offset-4 hover:underline"
        href={safeHref}
      >
        [{citation.marker}]
      </a>
    );
  }

  return (
    <span
      aria-label={`${label}; source link unavailable`}
      className="ml-1 text-muted-foreground"
    >
      [{citation.marker}]
    </span>
  );
}

function NextActionLink({ action }: { action: AnswerNextAction }) {
  const safeHref = getSafeInternalHref(action.href);

  if (!safeHref) {
    return (
      <span
        aria-label={`Next action unavailable: ${action.label}`}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground"
      >
        {action.label}
      </span>
    );
  }

  return (
    <a
      aria-label={`Next action: ${action.label}`}
      className="inline-flex items-center gap-1 font-medium text-syneos-orange underline-offset-4 hover:underline"
      href={safeHref}
    >
      {action.label}
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
    </a>
  );
}

export function SourceBackedAnswerCard({
  answer,
  onFeedbackSubmit,
}: SourceBackedAnswerCardProps) {
  const generatedId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const factsTitleId = `${generatedId}-facts-title`;
  const sourcesTitleId = `${generatedId}-sources-title`;
  const actionsTitleId = `${generatedId}-actions-title`;
  const feedbackTitleId = `${generatedId}-feedback-title`;
  const [rating, setRating] = useState<AnswerFeedbackRating | "">("");
  const [categories, setCategories] = useState<AnswerFeedbackCategory[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const hasFeedbackRecorder = Boolean(onFeedbackSubmit);
  const hasRestrictedSource =
    answer.state === "access_restricted" ||
    answer.citations.some((citation) => citation.accessState === "restricted");
  const canShowSupportingContent = !hasRestrictedSource;
  const citationsById = new Map(
    answer.citations.map((citation) => [citation.id, citation]),
  );

  function toggleCategory(category: AnswerFeedbackCategory) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rating || !onFeedbackSubmit) {
      return;
    }

    onFeedbackSubmit({
      answerId: answer.id,
      categories,
      citedSources: getSourceReferences(answer),
      rating,
    });
    setFeedbackMessage(
      "Feedback received. It has been preserved for answer quality review.",
    );
  }

  return (
    <article
      aria-label="Source-backed answer"
      className="rounded-md border border-border bg-card p-4 text-sm leading-6 shadow-sm"
    >
      <div className="mb-3 flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-syneos-orange">
          <ShieldIcon />
          Source-backed answer
        </p>
        <div>
          <h3 className="text-base font-semibold">{answer.title}</h3>
          <p className="text-muted-foreground">{answer.summary}</p>
        </div>
      </div>

      <dl className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            State
          </dt>
          <dd>State: {answerStateLabels[answer.state]}</dd>
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Confidence
          </dt>
          <dd>Confidence: {answer.confidence}</dd>
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Freshness
          </dt>
          <dd>{answer.freshnessLabel}</dd>
        </div>
      </dl>

      {answer.sourceGap ? (
        <p className="mb-4 inline-flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-muted-foreground">
          <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <span>{answer.sourceGap}</span>
        </p>
      ) : null}

      {canShowSupportingContent && answer.retrievedFacts.length > 0 ? (
        <section className="mb-4" aria-labelledby={factsTitleId}>
          <h4
            className="mb-2 text-sm font-semibold"
            id={factsTitleId}
          >
            Retrieved facts
          </h4>
          <ul aria-label="Retrieved facts" className="space-y-2">
            {answer.retrievedFacts.map((fact) => (
              <li
                className="rounded-md border border-border bg-background px-3 py-2"
                key={fact.id}
              >
                <span>{fact.text}</span>
                {fact.citationId && citationsById.has(fact.citationId) ? (
                  <CitationReference
                    citation={citationsById.get(fact.citationId)!}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canShowSupportingContent && answer.generatedDraft ? (
        <section
          aria-label="Generated draft"
          className="mb-4 rounded-md border border-dashed border-border bg-background px-3 py-2"
          role="region"
        >
          <h4 className="mb-1 text-sm font-semibold">
            Generated draft
          </h4>
          <p>{answer.generatedDraft.text}</p>
          <p className="text-muted-foreground">
            {answer.generatedDraft.reviewLabel}
          </p>
        </section>
      ) : null}

      {answer.citations.length > 0 ? (
        <section className="mb-4" aria-labelledby={sourcesTitleId}>
          <h4
            className="mb-2 text-sm font-semibold"
            id={sourcesTitleId}
          >
            Sources
          </h4>
          <ul className="space-y-2">
            {answer.citations.map((citation) => (
              <Citation citation={citation} key={citation.id} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={actionsTitleId}>
        <h4
          className="mb-2 text-sm font-semibold"
          id={actionsTitleId}
        >
          Next actions
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          {answer.nextActions.map((action) => (
            <li key={action.id}>
              <NextActionLink action={action} />
            </li>
          ))}
        </ul>
      </section>

      {hasFeedbackRecorder ? (
        <section aria-labelledby={feedbackTitleId} className="mt-4 border-t border-border pt-4">
          <h4
            className="mb-2 text-sm font-semibold"
            id={feedbackTitleId}
          >
            Answer feedback
          </h4>
          <form className="space-y-3" onSubmit={handleFeedbackSubmit}>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                Usefulness
              </legend>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-syneos-orange">
                  <input
                    checked={rating === "helpful"}
                    name={`${generatedId}-feedback-rating`}
                    onChange={() => setRating("helpful")}
                    type="radio"
                  />
                  This answer was helpful
                </label>
                <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-syneos-orange">
                  <input
                    checked={rating === "not_helpful"}
                    name={`${generatedId}-feedback-rating`}
                    onChange={() => setRating("not_helpful")}
                    type="radio"
                  />
                  This answer needs work
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                Categories
              </legend>
              <div className="flex flex-wrap gap-3">
                {feedbackCategories.map((category) => (
                  <label
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-syneos-orange"
                    key={category.id}
                  >
                    <input
                      checked={categories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      type="checkbox"
                    />
                    {category.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-syneos-orange px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-syneos-orange"
              disabled={!rating || Boolean(feedbackMessage)}
              type="submit"
            >
              Submit answer feedback
            </button>
          </form>
          {feedbackMessage ? (
            <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground" role="status">
              {feedbackMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function ShieldIcon() {
  return <Sparkles aria-hidden="true" className="h-4 w-4" />;
}
