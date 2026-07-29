import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { buildPlaybookPreview } from "@/lib/services/playbook";
import { readStore } from "@/lib/db/local-store";
import { PlaybookControls } from "@/components/playbook/PlaybookControls";

export const dynamic = "force-dynamic";

export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ history?: string }>;
}) {
  const params = await searchParams;
  const store = await readStore();
  const includeHistory =
    params.history === "1" || store.settings.include_perspective_history_in_playbook;
  const { playbook, weakCoverage } = await buildPlaybookPreview(includeHistory);

  return (
    <AppShell
      title="Playbook"
      subtitle="A living preview assembled from your decisions, outcomes, and open questions. AI generation is optional and requires approval."
      actions={
        <>
          <Link href="/settings/export" className="btn btn-secondary">
            Export
          </Link>
          <PlaybookControls includeHistory={includeHistory} />
        </>
      }
    >
      <div className="surface mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm text-ink-muted">Version date</div>
          <div className="font-display text-xl">{playbook.version_date.slice(0, 10)}</div>
        </div>
        <div>
          <div className="text-sm text-ink-muted">Babymoon-weighted completion</div>
          <div className="font-display text-xl">{playbook.completion_status}%</div>
        </div>
        <div>
          <div className="text-sm text-ink-muted">Perspective history</div>
          <div className="font-display text-xl">{includeHistory ? "Included" : "Excluded"}</div>
        </div>
      </div>

      {weakCoverage.length > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-warning-soft p-4 text-sm text-warning">
          Weak coverage areas: {weakCoverage.join(", ")}
        </div>
      )}

      <div className="space-y-4">
        {playbook.sections.map((section) => (
          <section key={section.slug} id={section.slug} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-display text-2xl">{section.title}</h2>
              <div className="flex gap-2">
                <span className="badge">Coverage: {section.coverage}</span>
                {section.ai_placeholder && <span className="badge badge-info">AI placeholder</span>}
              </div>
            </div>
            <div className="prose mt-4 whitespace-pre-wrap text-sm text-ink-muted">
              {section.content}
            </div>
            {section.unresolved_ids.length > 0 && section.slug !== "open-questions" && (
              <p className="mt-3 text-sm text-warning">
                Unresolved related items: {section.unresolved_ids.length}
              </p>
            )}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
