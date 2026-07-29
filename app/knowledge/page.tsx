import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { readStore } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const store = await readStore();

  return (
    <AppShell
      title="Knowledge"
      subtitle="Research, guidance, and notes — clearly labeled by evidence quality. Sample content is marked."
    >
      <div className="space-y-3">
        {store.knowledge_items.map((k) => (
          <Link key={k.id} href={`/knowledge/${k.id}`} className="surface block p-4 hover:border-accent">
            <div className="flex flex-wrap gap-2">
              <span className="badge">{k.item_type.replaceAll("_", " ")}</span>
              <span className="badge badge-info">{k.evidence_quality}</span>
              {k.is_sample && <span className="badge badge-warning">Sample content</span>}
            </div>
            <h2 className="mt-2 font-display text-xl">{k.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{k.summary}</p>
          </Link>
        ))}
      </div>
      <div className="surface mt-6 p-4 text-sm text-ink-muted">
        Distinction reminder: research findings, professional guidance, common practice, personal
        values, personal experience, and family decisions are not the same. Source quality is
        always visible.
      </div>
    </AppShell>
  );
}
