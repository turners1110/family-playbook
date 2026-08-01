import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/shared/ui";
import {
  getResearchSource,
  getResearchStorageStatus,
  listResearchSources,
} from "@/lib/research/services";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function ResearchCoveragePage() {
  const ctx = await requireFamilyContext();
  const store = await readStore();
  const storage = getResearchStorageStatus();
  const sources = await listResearchSources({}, ctx);
  const details = await Promise.all(
    sources.map((s) => getResearchSource(s.id, ctx)),
  );
  const links = details.flatMap((d) => d?.links ?? []);
  const linkedQuestionIds = new Set(
    links.map((l) => l.question_id).filter(Boolean) as string[],
  );
  const activeQuestions = store.questions.filter((q) => q.active);
  const withNone = activeQuestions.filter((q) => !linkedQuestionIds.has(q.id));
  const withOne = activeQuestions.filter(
    (q) => links.filter((l) => l.question_id === q.id).length === 1,
  );
  const withSeveral = activeQuestions.filter(
    (q) => links.filter((l) => l.question_id === q.id).length > 1,
  );
  const principles = store.principles;
  const linkedPrincipleIds = new Set(
    links.map((l) => l.principle_id).filter(Boolean) as string[],
  );
  const principlesUnsupported = principles.filter(
    (p) => !linkedPrincipleIds.has(p.id),
  );
  const highQuality = sources.filter(
    (s) => s.evidence_rating === "high" && s.evidence_rating_approved,
  );

  return (
    <AppShell
      title="Source coverage"
      subtitle="Coverage is not the same as quality. Prefer approved high-evidence sources over volume."
      actions={
        <Link href="/research" className="btn btn-ghost">
          Library
        </Link>
      }
    >
      <p
        className={`mb-4 text-sm ${
          storage.mode === "unavailable" ? "text-warning" : "text-ink-subtle"
        }`}
      >
        {storage.label}
      </p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Questions with no sources" value={withNone.length} />
        <StatCard label="Questions with one source" value={withOne.length} />
        <StatCard label="Questions with several" value={withSeveral.length} />
        <StatCard label="Approved high-evidence sources" value={highQuality.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-xl">Questions needing sources</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {withNone.slice(0, 12).map((q) => (
              <li key={q.id}>
                <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                  {q.short_title}
                </Link>
              </li>
            ))}
            {withNone.length === 0 && (
              <li className="text-ink-muted">Every active question has at least one link.</li>
            )}
          </ul>
        </section>
        <section className="surface p-5">
          <h2 className="font-display text-xl">Principles without source support</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {principlesUnsupported.slice(0, 12).map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
            {principlesUnsupported.length === 0 && (
              <li className="text-ink-muted">All principles have linked sources.</li>
            )}
          </ul>
        </section>
      </div>

      <p className="mt-5 text-sm text-ink-muted">
        Conflict detection and deeper coverage analytics arrive in Phase 3.
      </p>
    </AppShell>
  );
}
