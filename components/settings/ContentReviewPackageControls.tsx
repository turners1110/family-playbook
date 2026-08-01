"use client";

import { useMemo, useState, useTransition } from "react";
import { actionGenerateContentReviewPackage } from "@/lib/actions/content-review";
import type {
  AnswerExportMode,
  ContentReviewScope,
} from "@/lib/content-review";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-ink-muted">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-ink-subtle">{hint}</span> : null}
      </span>
    </label>
  );
}

export function ContentReviewPackageControls() {
  const [scope, setScope] = useState<ContentReviewScope>("full");
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [answerDetail, setAnswerDetail] =
    useState<AnswerExportMode>("statuses_only");
  const [includeFreeTextAnswers, setIncludeFreeTextAnswers] = useState(false);
  const [includeArchivedQuestions, setIncludeArchivedQuestions] = useState(false);
  const [includeTestData, setIncludeTestData] = useState(false);
  const [includeCustomTasks, setIncludeCustomTasks] = useState(true);
  const [includeResearchMetadata, setIncludeResearchMetadata] = useState(false);
  const [includeResearchSummaries, setIncludeResearchSummaries] = useState(false);
  const [includeTechnicalHealthData, setIncludeTechnicalHealthData] =
    useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () => ({
      scope,
      includeAnswers,
      answerDetail: includeAnswers ? answerDetail : ("excluded" as const),
      includeFreeTextAnswers: includeAnswers && includeFreeTextAnswers,
      includeArchivedQuestions,
      includeTestData,
      includeCustomTasks,
      includeResearchMetadata,
      includeResearchSummaries,
      includeTechnicalHealthData,
    }),
    [
      scope,
      includeAnswers,
      answerDetail,
      includeFreeTextAnswers,
      includeArchivedQuestions,
      includeTestData,
      includeCustomTasks,
      includeResearchMetadata,
      includeResearchSummaries,
      includeTechnicalHealthData,
    ],
  );

  function generate() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await actionGenerateContentReviewPackage(options);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      download(result.jsonFilename, result.json, "application/json");
      download(result.markdownFilename, result.markdown, "text/markdown");
      setMessage(
        `Downloaded ${result.jsonFilename} and ${result.markdownFilename} (${result.questionCount} questions, ${result.taskCount} tasks).`,
      );
    });
  }

  return (
    <section className="surface space-y-5 p-5">
      <div>
        <h2 className="font-display text-xl">Generate Content Review Package</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Export a package for ChatGPT or Claude to review question design, topic
          coverage, and the Before Baby checklist. Family answers are secondary and
          excluded by default.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Package scope</legend>
        {(
          [
            ["full", "Full content review"],
            ["questions_only", "Questions only"],
            ["before_baby_only", "Before Baby only"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="radio"
              name="content-review-scope"
              checked={scope === value}
              onChange={() => setScope(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Family answers</legend>
        <Toggle
          label="Include family answers"
          checked={includeAnswers}
          onChange={setIncludeAnswers}
          hint="Off by default. When on, statuses-only is the recommended mode."
        />
        {includeAnswers ? (
          <>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="radio"
                name="answer-detail"
                checked={answerDetail === "statuses_only"}
                onChange={() => setAnswerDetail("statuses_only")}
              />
              Statuses only
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="radio"
                name="answer-detail"
                checked={answerDetail === "full"}
                onChange={() => setAnswerDetail("full")}
              />
              Full answers
            </label>
            <Toggle
              label="Include free-text answers"
              checked={includeFreeTextAnswers}
              onChange={setIncludeFreeTextAnswers}
              disabled={answerDetail !== "full"}
              hint="Privacy-sensitive. Off by default."
            />
          </>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Export toggles</legend>
        <Toggle
          label="Include archived questions"
          checked={includeArchivedQuestions}
          onChange={setIncludeArchivedQuestions}
        />
        <Toggle
          label="Include test data"
          checked={includeTestData}
          onChange={setIncludeTestData}
        />
        <Toggle
          label="Include custom tasks"
          checked={includeCustomTasks}
          onChange={setIncludeCustomTasks}
        />
        <Toggle
          label="Include research metadata"
          checked={includeResearchMetadata}
          onChange={setIncludeResearchMetadata}
        />
        <Toggle
          label="Include research summaries"
          checked={includeResearchSummaries}
          onChange={setIncludeResearchSummaries}
          hint="Off by default. Book text is never exported."
        />
        <Toggle
          label="Include technical health data"
          checked={includeTechnicalHealthData}
          onChange={setIncludeTechnicalHealthData}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={generate}
        >
          {pending ? "Generating…" : "Generate Content Review Package"}
        </button>
      </div>

      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-bg-muted/40 px-3 py-3 text-sm text-ink-muted">
        <p className="font-medium text-ink">Files downloaded</p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <code>turner-family-content-review.json</code>
          </li>
          <li>
            <code>turner-family-content-review.md</code>
          </li>
        </ul>
        <p className="mt-3">
          Open the Markdown file, copy the prompt at the bottom, paste into ChatGPT
          or Claude, then attach the JSON.
        </p>
      </div>
    </section>
  );
}
