import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { readStore } from "@/lib/db/local-store";
import { OUTCOME_DOMAIN_LABELS } from "@/lib/constants/enums";
import { ProgressBar } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default async function OutcomesPage() {
  const store = await readStore();
  const answered = new Set(store.answers.map((a) => a.question_id));

  return (
    <AppShell
      title="Outcomes"
      subtitle="Skills and traits you hope to build — linked to questions and decisions."
    >
      <div className="space-y-8">
        {store.outcome_domains.map((domain) => {
          const outcomes = store.outcomes.filter((o) => o.domain_slug === domain.slug);
          return (
            <section key={domain.id}>
              <h2 className="font-display text-2xl">
                {OUTCOME_DOMAIN_LABELS[domain.slug]}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {outcomes.map((o) => {
                  const qs = store.questions.filter((q) => q.outcomes.includes(o.slug));
                  const covered = qs.filter((q) => answered.has(q.id)).length;
                  const pct = qs.length ? Math.round((covered / qs.length) * 100) : 0;
                  return (
                    <Link key={o.id} href={`/outcomes/${o.slug}`} className="surface block p-4 hover:border-accent">
                      <h3 className="font-display text-lg">{o.label}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{o.definition}</p>
                      <div className="mt-3">
                        <ProgressBar value={pct} label={`Coverage ${covered}/${qs.length || 0}`} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
