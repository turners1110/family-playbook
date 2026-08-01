import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { OwnershipAssigner } from "@/components/checklists/OwnershipAssigner";
import { getBeforeBabyChecklist } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

export default async function BeforeBabyAssignPage() {
  const { tasks } = await getBeforeBabyChecklist();

  return (
    <AppShell
      title="Assign Before Baby responsibilities"
      subtitle="One card at a time. Suggestions never overwrite explicit choices."
      actions={
        <Link href="/before-baby" className="btn btn-ghost">
          Back to checklist
        </Link>
      }
    >
      <OwnershipAssigner initialTasks={tasks} />
    </AppShell>
  );
}
