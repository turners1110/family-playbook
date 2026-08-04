import { AppShell } from "@/components/layout/AppShell";
import { AnswerStatusBadge } from "@/components/questions/AnswerStatusBadge";
import { searchAll } from "@/lib/services/stats";
import { readStore } from "@/lib/db/store";
import { buildQuestionStatusIndex } from "@/lib/services/question-status";
import {
  decisionHref,
  searchFamilyDecisions,
} from "@/lib/knowledge";
import {
  discussionModeIcon,
  resolveEffectiveDiscussionMode,
} from "@/lib/discussions/discussion-mode";
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
  const familyDecisions = q ? searchFamilyDecisions(store, q) : [];

  const sharedAnswers =
    results?.answers.filter((a) => a.is_shared) ?? [];
  const separateAnswers =
    results?.answers.filter((a) => !a.is_shared) ?? [];

  return (
    <AppShell
      title="Search"
      subtitle="Find decisions, conversations, questions, tasks, and research in one place."
    >
      <form className="surface mb-5 flex gap-2 p-4">
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Search family decisions and related records"
          aria-label="Search"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {!results && (
        <p className="text-ink-muted">
          Enter a term to search across the family system.
        </p>
      )}

      {results && (
        <div className="space-y-5">
          <section className="surface p-4">
            <h2 className="font-display text-xl">Shared decisions</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {familyDecisions.length === 0 && sharedAnswers.length === 0 ? (
                <li>No matches.</li>
              ) : (
                <>
                  {familyDecisions.map((item) => (
                    <li key={item.id}>
                      <Link href={decisionHref(item)}>{item.title}</Link>
                      <span className="text-ink-subtle">
                        {" "}
                        · {item.health.grade.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                  {sharedAnswers.map((item) => (
                    <li key={item.id}>
                      {item.question ? (
                        <Link href={`/questions/${item.question.slug}`}>
                          {item.question.short_title}
                        </Link>
                      ) : (
                        item.id
                      )}
                      <span className="text-ink-subtle"> · shared answer</span>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </section>

          <section className="surface p-4">
            <h2 className="font-display text-xl">Questions</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {results.questions.length === 0 ? (
                <li>No matches.</li>
              ) : (
                results.questions.map((item) => {
                  const mode = resolveEffectiveDiscussionMode({
                    discussion_mode: item.discussion_mode ?? null,
                    separate_answers_recommended:
                      item.separate_answers_recommended,
                    question: item,
                  });
                  const icon = discussionModeIcon(mode);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span title={icon.label} aria-label={icon.label}>
                        {icon.symbol}
                      </span>
                      <AnswerStatusBadge
                        status={statusIndex.get(item.id)!}
                        compact
                      />
                      <Link href={`/questions/${item.slug}`}>
                        {item.short_title}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {separateAnswers.length > 0 ? (
            <section className="surface p-4">
              <h2 className="font-display text-xl">Separate perspectives</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                {separateAnswers.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2"
                  >
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
                ))}
              </ul>
            </section>
          ) : null}

          {(
            [
              [
                "Saved decision records",
                results.decisions.map((item) => (
                  <li key={item.id}>
                    <Link href={`/decisions/${item.id}`}>{item.title}</Link>
                  </li>
                )),
              ],
              [
                "Outcomes",
                results.outcomes.map((item) => (
                  <li key={item.id}>
                    <Link href={`/outcomes/${item.slug}`}>{item.label}</Link>
                  </li>
                )),
              ],
              [
                "Principles",
                results.principles.map((item) => (
                  <li key={item.id}>{item.title}</li>
                )),
              ],
              [
                "Research",
                results.knowledge.map((item) => (
                  <li key={item.id}>
                    <Link href={`/knowledge/${item.id}`}>{item.title}</Link>
                  </li>
                )),
              ],
              [
                "Notes",
                results.notes.map((item) => (
                  <li key={item.id}>
                    {item.type}: {item.text.slice(0, 120)}
                  </li>
                )),
              ],
              [
                "Checklist",
                results.checklist_tasks.map((item) => (
                  <li key={item.id}>
                    <Link href="/before-baby">{item.title}</Link>
                  </li>
                )),
              ],
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
