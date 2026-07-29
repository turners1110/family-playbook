import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge, StatusBadge, ConfidenceBadge } from "@/components/shared/ui";
import { readStore } from "@/lib/db/local-store";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import type { DecisionStatus, LifeStage, QuestionPriority, QuestionType } from "@/lib/constants/enums";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = await readStore();
  const answered = new Map(
    store.answers.filter((a) => a.is_shared).map((a) => [a.question_id, a]),
  );
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
  if (params.status === "answered") {
    questions = questions.filter((item) => answered.has(item.id));
  } else if (params.status === "unanswered") {
    questions = questions.filter((item) => !answered.has(item.id));
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

  const sort = params.sort ?? "logical";
  questions = [...questions].sort((a, b) => {
    if (sort === "priority") {
      const order = ["essential_before_birth", "high", "medium", "low", "future"];
      return order.indexOf(a.priority) - order.indexOf(b.priority);
    }
    if (sort === "time") return a.estimated_minutes - b.estimated_minutes;
    if (sort === "updated") return b.updated_at.localeCompare(a.updated_at);
    return a.logical_order - b.logical_order;
  });

  return (
    <AppShell
      title="Questions"
      subtitle={`${questions.length} questions in view · browse, filter, and revisit anytime.`}
    >
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
        <select className="select" name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          <option value="answered">Answered</option>
          <option value="unanswered">Unanswered</option>
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
          <option value="logical">Logical order</option>
          <option value="priority">Priority</option>
          <option value="time">Estimated time</option>
          <option value="updated">Recently updated</option>
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
          const answer = answered.get(q.id);
          return (
            <Link
              key={q.id}
              href={`/questions/${q.slug}`}
              className="surface block p-4 transition hover:border-accent"
            >
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={q.priority} />
                {answer ? <StatusBadge status={answer.status as DecisionStatus} /> : (
                  <span className="badge">Not started</span>
                )}
                {answer && <ConfidenceBadge confidence={answer.confidence} />}
                {q.separate_answers_recommended && <span className="badge badge-info">Separate</span>}
                {q.evidence_summary && <span className="badge">Evidence</span>}
                {bookmarks.has(q.id) && <span className="badge badge-warning">Bookmark</span>}
                {answer?.review_date && <span className="badge badge-info">Review</span>}
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
