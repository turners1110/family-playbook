import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import {
  BEFORE_BIRTH_ESSENTIAL_MODULES,
  matchEssentialQuestion,
} from "@/lib/content/before-birth-essentials";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
} from "@/lib/services/question-status";

export const dynamic = "force-dynamic";

export default async function BeforeBirthEssentialsPage() {
  await requireFamilyContext();
  const store = await readStore();
  const statusIndex = buildQuestionStatusIndex(store);

  const modules = BEFORE_BIRTH_ESSENTIAL_MODULES.map((mod) => {
    const questions = store.questions
      .filter((q) => q.active)
      .filter((q) => {
        const match = matchEssentialQuestion(q);
        return match?.moduleId === mod.id;
      })
      .sort((a, b) => a.logical_order - b.logical_order);
    // Deduplicate by keeping first ~6 per module for primary screens
    const primary = questions.slice(0, 6);
    return { mod, primary, total: questions.length };
  });

  const primaryCount = modules.reduce((n, m) => n + m.primary.length, 0);

  return (
    <AppShell
      title="Before Birth Essentials"
      subtitle={`A curated path of about ${primaryCount} primary screens. Full library stays available.`}
      actions={
        <Link href="/questions" className="btn btn-ghost">
          Full library
        </Link>
      }
    >
      <section className="surface mb-5 p-5 text-sm text-ink-muted">
        Work module by module. Use Undecided or Discuss later on any question.
        Progress uses existing answer status — nothing is reset.
      </section>

      <div className="space-y-4">
        {modules.map(({ mod, primary, total }) => (
          <section key={mod.id} className="surface p-5">
            <h2 className="font-display text-xl">{mod.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{mod.description}</p>
            <p className="mt-2 text-xs text-ink-subtle">
              Showing {primary.length} primary · {total} related in library
            </p>
            <ul className="mt-4 space-y-3">
              {primary.map((q) => {
                const status =
                  statusIndex.get(q.id) ?? getQuestionAnswerStatus(q.id, store);
                return (
                  <li key={q.id}>
                    <Link
                      href={`/questions/${q.slug}`}
                      className="block rounded-xl border border-border px-3 py-3 hover:border-accent"
                    >
                      <div className="font-medium text-ink">{q.short_title}</div>
                      <div className="mt-1 text-xs text-ink-subtle">
                        {status.label}
                      </div>
                    </Link>
                  </li>
                );
              })}
              {primary.length === 0 ? (
                <li className="text-sm text-ink-muted">
                  No matching questions yet — open the full library.
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
