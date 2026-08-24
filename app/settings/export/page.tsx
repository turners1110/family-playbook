import { AppShell } from "@/components/layout/AppShell";
import { readStore } from "@/lib/db/local-store";
import { buildPlaybookPreview, playbookToMarkdown, playbookToHtml } from "@/lib/services/playbook";
import { ExportButtons } from "@/components/settings/ExportButtons";
import { ContentExportButtons } from "@/components/settings/ContentExportButtons";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const store = await readStore();
  const { playbook } = await buildPlaybookPreview(
    store.settings.include_perspective_history_in_playbook,
  );

  const answersJson = JSON.stringify(store.answers, null, 2);
  const decisionsJson = JSON.stringify(store.decisions, null, 2);
  const markdown = playbookToMarkdown(playbook);
  const html = playbookToHtml(playbook);

  return (
    <AppShell
      title="Import / Export"
      subtitle="Export answers, decisions, and playbook preview. Import seed JSON for questions and outcomes."
    >
      <ExportButtons
        answersJson={answersJson}
        decisionsJson={decisionsJson}
        markdown={markdown}
        html={html}
      />

      <div className="mt-5">
        <ContentExportButtons />
      </div>

      <section className="surface mt-5 p-5 text-sm text-ink-muted">
        <h2 className="font-display text-xl text-ink">Import</h2>
        <p className="mt-2">
          Place question JSON at <code>data/seed/questions.json</code> and outcomes at{" "}
          <code>data/seed/outcomes.json</code>, then run <code>pnpm seed</code>. See{" "}
          <code>docs/seed-question-format.md</code>.
        </p>
        <p className="mt-2">
          PDF and Word export are planned for a later release and are not blockers for MVP.
        </p>
      </section>
    </AppShell>
  );
}
