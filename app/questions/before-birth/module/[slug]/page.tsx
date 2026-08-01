import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import { ESSENTIALS_MODULES } from "@/lib/essentials/pathway";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";

export const dynamic = "force-dynamic";

export default async function EssentialsModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireFamilyContext();
  const { slug } = await params;
  const mod = ESSENTIALS_MODULES.find((m) => m.slug === slug);
  if (!mod) notFound();
  const store = await readStore();
  const dash = buildEssentialsDashboard(store);
  const screens = dash.screens.filter(
    (s) => s.visible && s.screen.module_id === mod.id,
  );
  const progress = dash.modules.find((m) => m.id === mod.id);

  return (
    <AppShell
      title={mod.title}
      subtitle={mod.description}
      actions={
        <Link href="/questions/before-birth" className="btn btn-ghost">
          All modules
        </Link>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        {progress?.completed ?? 0}/{screens.length} complete · ~{mod.estimated_minutes}{" "}
        min module
      </p>
      <ul className="space-y-3">
        {screens.map((row) => (
          <li key={row.screen.id}>
            <Link
              href={`/questions/before-birth/screen/${row.screen.id}`}
              className="surface block p-4 hover:border-accent"
            >
              <div className="font-medium text-ink">{row.screen.title}</div>
              <div className="mt-1 text-sm text-ink-muted">{row.screen.purpose}</div>
              <div className="mt-2 text-xs text-ink-subtle">{row.label}</div>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
