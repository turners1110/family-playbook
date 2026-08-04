import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge, ConfidenceBadge, StatCard } from "@/components/shared/ui";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { readStore } from "@/lib/db/store";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import type { LifeStage, QuestionPriority } from "@/lib/constants/enums";
import {
  buildQuestionStatusIndex,
  filterCounts,
  matchesStatusFilter,
  sortQuestionsByStatus,
  summarizeQuestionProgress,
  type QuestionStatusFilter,
  type QuestionStatusSort,
} from "@/lib/services/question-status";
import {
  discussionModeIcon,
  resolveEffectiveDiscussionMode,
} from "@/lib/discussions/discussion-mode";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { key: QuestionStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "partial", label: "Partially answered" },
  { key: "both", label: "Answered by both" },
  { key: "shared_complete", label: "Shared decision complete" },
  { key: "undecided", label: "Undecided" },
  { key: "needs_review", label: "Needs review" },
  { key: "cooling_off", label: "Cooling off" },
];

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = await readStore();
  const statusIndex = buildQuestionStatusIndex(store);
  const progress = summarizeQuestionProgress(store, statusIndex);
  const bookmarks = new Set(store.bookmarks.map((b) => b.question_id));

  let questions = store.questions.filter((q) => q.active);

  if (params.q) {
    const q = params.q.toLowerCase();
    questions = questions.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.short_title.toLowerCase().includes(q),
    );
  }
  if (params.life_stage) {
    questions = questions.filter(
      (item) =>
        item.life_stages.includes(params.life_stage as LifeStage) ||
        item.life_stages.includes("all_stages"),
    );
  }
  if (params.category) {
    questions = questions.filter((item) => item.categories.includes(params.category!));
  }
  if (params.outcome) {
    questions = questions.filter((item) => item.outcomes.includes(params.outcome!));
  }
  if (params.priority) {
    questions = questions.filter((item) => item.priority === params.priority);
  }
  if (params.type) {
    questions = questions.filter((item) => item.question_type === params.type);
  }
  if (params.evidence === "1") {
    questions = questions.filter((item) => item.evidence_available || item.evidence_summary);
  }
  if (params.separate === "1") {
    questions = questions.filter((item) => item.separate_answers_recommended);
  }
  if (params.cooling === "1") {
    questions = questions.filter((item) => item.cooling_off_recommended);
  }

  const answerFilter = (params.answer_status ?? "all") as QuestionStatusFilter;
  const counts = filterCounts(questions, statusIndex);
  questions = questions.filter((item) => {
    const status = statusIndex.get(item.id);
    if (!status) return false;
    return matchesStatusFilter(status, answerFilter);
  });

  const sort = (params.sort ?? "unanswered_first") as QuestionStatusSort;
  questions = sortQuestionsByStatus(questions, statusIndex, sort);

  return (
    <AppShell
      title="Questions"
      subtitle={`${questions.length} questions in view · browse, filter, and revisit anytime.`}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total" value={progress.total} />
        <StatCard label="Fully answered" value={progress.fullyAnswered} />
        <StatCard label="Partially answered" value={progress.partiallyAnswered} />
        <StatCard label="Unanswered" value={progress.unanswered} />
        <StatCard label="Undecided" value={progress.undecided} />
        <StatCard label="Needs review" value={progress.needsReview} />
      </div>

      <div className="mb-4">
        <Link href="/conversations" className="btn btn-secondary">
          Start a related conversation
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const href = buildHref(params, { answer_status: filter.key === "all" ? undefined : filter.key });
          const active = answerFilter === filter.key;
          return (
            <Link
              key={filter.key}
              href={href}
              className={`badge ${active ? "badge-accent" : ""}`}
            >
              {filter.label} ({counts[filter.key]})
            </Link>
          );
        })}
      </div>

      <form className="surface mb-5 grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input md:col-span-2"
          name="q"
          defaultValue={params.q}
          placeholder="Search questions"
          aria-label="Search questions"
        />
        <select className="select" name="life_stage" defaultValue={params.life_stage ?? ""}>
          <option value="">All life stages</option>
          {store.life_stages.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="select" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {store.categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <select className="select" name="outcome" defaultValue={params.outcome ?? ""}>
          <option value="">All outcomes</option>
          {store.outcomes.map((o) => (
            <option key={o.id} value={o.slug}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="select"
          name="answer_status"
          defaultValue={answerFilter === "all" ? "" : answerFilter}
        >
          <option value="">Answer status: All</option>
          {STATUS_FILTERS.filter((f) => f.key !== "all").map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select className="select" name="priority" defaultValue={params.priority ?? ""}>
          <option value="">Any priority</option>
          {(["essential_before_birth", "high", "medium", "low", "future"] as QuestionPriority[]).map(
            (p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ),
          )}
        </select>
        <select className="select" name="type" defaultValue={params.type ?? ""}>
          <option value="">Any type</option>
          {Array.from(new Set(store.questions.map((q) => q.question_type))).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className="select" name="sort" defaultValue={sort}>
          <option value="unanswered_first">Unanswered first</option>
          <option value="updated">Recently updated</option>
          <option value="needs_review_first">Needs review first</option>
          <option value="category">Category order</option>
          <option value="life_stage">Life-stage order</option>
          <option value="logical">Logical order</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="evidence" value="1" defaultChecked={params.evidence === "1"} />
          Evidence available
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="separate" value="1" defaultChecked={params.separate === "1"} />
          Separate answers
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="cooling" value="1" defaultChecked={params.cooling === "1"} />
          Cooling-off recommended
        </label>
        <button type="submit" className="btn btn-primary md:col-span-4 md:w-fit">
          Apply filters
        </button>
      </form>

      <div className="space-y-3">
        {questions.map((q) => {
          const status = statusIndex.get(q.id)!;
          return (
            <Link
              key={q.id}
              href={`/questions/${q.slug}`}
              className="surface block p-4 transition hover:border-accent"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AnswerStatusBadge status={status} />
                <PriorityBadge priority={q.priority} />
                {status.confidence != null && (
                  <ConfidenceBadge confidence={status.confidence} />
                )}
                {(() => {
                  const mode = resolveEffectiveDiscussionMode({
                    discussion_mode: q.discussion_mode ?? null,
                    separate_answers_recommended: q.separate_answers_recommended,
                    question: q,
                  });
                  const icon = discussionModeIcon(mode);
                  return (
                    <span
                      className="badge"
                      title={icon.label}
                      aria-label={icon.label}
                    >
                      {icon.symbol}
                    </span>
                  );
                })()}
                {q.evidence_summary && <span className="badge">Evidence</span>}
                {bookmarks.has(q.id) && (
                  <span className="badge badge-warning">Bookmark</span>
                )}
              </div>
              <h2 className="mt-2 font-display text-xl text-ink">{q.text}</h2>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-subtle">
                <span>
                  {q.life_stages
                    .slice(0, 2)
                    .map((s) => LIFE_STAGE_LABELS[s])
                    .join(", ")}
                </span>
                <span>{q.categories[0]}</span>
                <span>~{q.estimated_minutes} min</span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function buildHref(
  params: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
) {
  const next = new URLSearchParams();
  const merged = { ...params, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/questions?${qs}` : "/questions";
}
