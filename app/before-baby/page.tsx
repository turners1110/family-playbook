import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BeforeBabyScheduler } from "@/components/checklists/BeforeBabyScheduler";
import { getBeforeBabyChecklist } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

export default async function BeforeBabyPage() {
  const { instance, tasks, templateTaskCount, settings, pregnancy } =
    await getBeforeBabyChecklist();

  return (
    <AppShell
      title="Before Baby"
      subtitle="Due-date timeline for hospital, home, gear, and paperwork prep."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/conversations" className="btn btn-ghost">
            Discuss related decisions
          </Link>
          <Link href="/before-baby/plan" className="btn btn-ghost">
            Plan
          </Link>
        </div>
      }
    >
      <BeforeBabyScheduler
        checklistId={instance?.id ?? null}
        initialTasks={tasks}
        templateTaskCount={templateTaskCount}
        settings={settings}
        pregnancy={pregnancy}
      />
    </AppShell>
  );
}
