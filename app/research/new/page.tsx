import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AddSourceForm } from "@/components/research/AddSourceForm";
import { getResearchStorageStatus } from "@/lib/research/services";

export const dynamic = "force-dynamic";

export default function AddResearchSourcePage() {
  const storage = getResearchStorageStatus();

  return (
    <AppShell
      title="Add source"
      subtitle="Books, papers, guidelines, and notes — kept private and clearly labeled by how much source text is available."
      actions={
        <Link href="/research" className="btn btn-ghost">
          Back to library
        </Link>
      }
    >
      <p
        className={`mb-4 text-sm ${
          storage.mode === "unavailable" ? "text-warning" : "text-ink-subtle"
        }`}
      >
        {storage.label}
      </p>
      <AddSourceForm writesAllowed={storage.writesAllowed} />
    </AppShell>
  );
}
