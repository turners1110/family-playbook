import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AddSourceForm } from "@/components/research/AddSourceForm";

export const dynamic = "force-dynamic";

export default function AddResearchSourcePage() {
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
      <AddSourceForm />
    </AppShell>
  );
}
