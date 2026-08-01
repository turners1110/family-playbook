import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AfterBirthBoard } from "@/components/checklists/AfterBirthBoard";
import { getAfterBirthChecklist } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

export default async function AfterBirthPage() {
  const { instance, tasks, templateTaskCount, settings } =
    await getAfterBirthChecklist();

  return (
    <AppShell
      title="First Month"
      subtitle="Post-birth planning for paperwork, support, and family check-ins."
      actions={
        <Link href="/before-baby" className="btn btn-ghost">
          Before Baby
        </Link>
      }
    >
      <AfterBirthBoard
        checklistId={instance?.id ?? null}
        initialTasks={tasks}
        templateTaskCount={templateTaskCount}
        settings={settings}
      />
    </AppShell>
  );
}
