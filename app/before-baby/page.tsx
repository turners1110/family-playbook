import { AppShell } from "@/components/layout/AppShell";
import { BeforeBabyBoard } from "@/components/checklists/BeforeBabyBoard";
import { getBeforeBabyChecklist } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

export default async function BeforeBabyPage() {
  const { instance, tasks, templateTaskCount } = await getBeforeBabyChecklist();

  return (
    <AppShell
      title="Before Baby"
      subtitle="Practical prep for the weeks before arrival — organized, shareable, and satisfying to finish."
    >
      <BeforeBabyBoard
        checklistId={instance?.id ?? null}
        initialTasks={tasks}
        templateTaskCount={templateTaskCount}
      />
    </AppShell>
  );
}
