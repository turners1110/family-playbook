import { AppShell } from "@/components/layout/AppShell";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { searchAll } from "@/lib/services/stats";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const results = q ? await searchAll(q) : null;
  const store = await readStore();
  const statusIndex = buildQuestionStatusIndex(store);

  return (
    <AppShell title="Search" subtitle="Search questions, answers, decisions, outcomes, principles, knowledge, and notes.">
      <form className="surface mb-5 flex gap-2 p-4">
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Search the family knowledge base"
          aria-label="Search"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {!results && (
        <p className="text-ink-muted">Enter a term to search across the family system.</p>
      )}

      {results && (
        <div className="space-y-5">
          {(
            [
              ["Questions", results.questions.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <AnswerStatusBadge status={statusIndex.get(item.id)!} compact />
                  <Link href={`/questions/${item.slug}`}>{item.short_title}</Link>
                </li>
              ))],
              ["Decisions", results.decisions.map((item) => (
                <li key={item.id}><Link href={`/decisions/${item.id}`}>{item.title}</Link></li>
              ))],
              ["Outcomes", results.outcomes.map((item) => (
                <li key={item.id}><Link href={`/outcomes/${item.slug}`}>{item.label}</Link></li>
              ))],
              ["Principles", results.principles.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))],
              ["Knowledge", results.knowledge.map((item) => (
                <li key={item.id}><Link href={`/knowledge/${item.id}`}>{item.title}</Link></li>
              ))],
              ["Answers", results.answers.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  {item.question ? (
                    <>
                      <AnswerStatusBadge
                        status={statusIndex.get(item.question.id)!}
                        compact
                      />
                      <Link href={`/questions/${item.question.slug}`}>
                        {item.question.short_title}
                      </Link>
                    </>
                  ) : (
                    item.id
                  )}
                </li>
              ))],
              ["Notes", results.notes.map((item) => (
                <li key={item.id}>{item.type}: {item.text.slice(0, 120)}</li>
              ))],
            ] as const
          ).map(([title, items]) => (
            <section key={title} className="surface p-4">
              <h2 className="font-display text-xl">{title}</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                {items.length === 0 ? <li>No matches.</li> : items}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
