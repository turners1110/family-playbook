import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ContentUpgradePanel } from "@/components/settings/ContentUpgradePanel";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import { buildContentUpgradePreview } from "@/lib/content/upgrade";

export const dynamic = "force-dynamic";

export default async function ContentUpgradePage() {
  await requireFamilyContext();
  const store = await readStore();
  const initialPreview = buildContentUpgradePreview(store);
  return (
    <AppShell
      title="Content upgrade"
      subtitle="Preview and apply safe seeded content improvements without changing answers or completion."
      actions={
        <Link href="/settings" className="btn btn-ghost">
          Settings
        </Link>
      }
    >
      <ContentUpgradePanel initialPreview={initialPreview} />
    </AppShell>
  );
}
