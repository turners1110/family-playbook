import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ContentReviewPackageControls } from "@/components/settings/ContentReviewPackageControls";
import { requireFamilyContext } from "@/lib/auth/family-context";

export const dynamic = "force-dynamic";

export default async function ContentReviewSettingsPage() {
  await requireFamilyContext();

  return (
    <AppShell
      title="AI Content Review"
      subtitle="Export the question bank and Before Baby checklist for ChatGPT or Claude to audit content design."
      actions={
        <Link href="/settings" className="btn btn-ghost">
          Settings
        </Link>
      }
    >
      <ContentReviewPackageControls />
    </AppShell>
  );
}
