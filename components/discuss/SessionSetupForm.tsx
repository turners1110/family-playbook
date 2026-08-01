"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateSession } from "@/lib/actions";
import type { Category, LifeStageRecord, Outcome } from "@/lib/types/models";
import type { SessionLength } from "@/lib/constants/enums";

export function SessionSetupForm({
  lifeStages,
  categories,
  outcomes,
  babymoonDefault = false,
  preset,
}: {
  lifeStages: LifeStageRecord[];
  categories: Category[];
  outcomes: Outcome[];
  babymoonDefault?: boolean;
  preset?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [length, setLength] = useState<SessionLength>(
    preset === "fifteen_minutes" ? "quick" : "standard",
  );
  const [lifeStage, setLifeStage] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [title, setTitle] = useState(
    babymoonDefault ? "Babymoon discussion" : "Discussion session",
  );
  const [filters, setFilters] = useState({
    only_unanswered: true,
    include_answered: false,
    review_changed: false,
    review_undecided: false,
    review_due: false,
    include_unresolved: false,
    include_research: false,
    include_separate: false,
    include_high_priority: babymoonDefault,
    include_practical: preset === "practical",
    include_philosophical: preset === "philosophical",
    include_evidence: false,
  });

  function toggle(key: keyof typeof filters) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  return (
    <form
      className="surface space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const result = await actionCreateSession({
              title,
              description: "Guided parenting discussion",
              length,
              babymoon_mode: babymoonDefault || Boolean(preset),
              filters: {
                ...filters,
                life_stage: (lifeStage || undefined) as never,
                category: category || undefined,
                outcome: outcome || undefined,
                preset:
                  preset ||
                  (filters.include_philosophical
                    ? "philosophical"
                    : filters.include_practical
                      ? "practical"
                      : undefined),
              },
            });
            router.push(`/discuss/${result.sessionId}`);
          } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : "Could not start session");
          }
        });
      }}
    >
      <div className="field">
        <label htmlFor="title">Session title</label>
        <input
          id="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Session length</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["quick", "Quick · 3–5"],
              ["standard", "Standard · 8–12"],
              ["deep", "Deep · 15–25"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn ${length === value ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setLength(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="field">
          <label htmlFor="lifeStage">Life stage</label>
          <select
            id="lifeStage"
            className="select"
            value={lifeStage}
            onChange={(e) => setLifeStage(e.target.value)}
          >
            <option value="">Any / recommended</option>
            {lifeStages.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Topic</label>
          <select
            id="category"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Any topic</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="outcome">Outcome</label>
          <select
            id="outcome"
            className="select"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="">Any outcome</option>
            {outcomes.map((o) => (
              <option key={o.id} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">
          Interview status
        </legend>
        <p className="mb-2 text-xs text-ink-subtle">
          Fully answered questions are skipped by default.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["include_answered", "Include answered questions"],
              ["review_changed", "Review changed answers"],
              ["review_undecided", "Review undecided questions"],
              ["review_due", "Review due questions"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Filters</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["only_unanswered", "Prefer unanswered"],
              ["include_unresolved", "Include unresolved"],
              ["include_research", "Needing research"],
              ["include_separate", "Separate-answer questions"],
              ["include_high_priority", "High priority"],
              ["include_practical", "Practical"],
              ["include_philosophical", "Philosophical"],
              ["include_evidence", "Evidence-focused"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Starting…" : "Start discussion"}
      </button>
    </form>
  );
}
