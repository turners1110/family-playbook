import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  getResearchStorageStatus,
  listResearchSources,
} from "@/lib/research/services";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { ResearchStatusBadge } from "@/components/research/ResearchSourceCard";

export const dynamic = "force-dynamic";

export default async function ResearchProcessingPage() {
  const ctx = await requireFamilyContext();
  const storage = getResearchStorageStatus();
  const queue = await listResearchSources({ tab: "queue" }, ctx);

  return (
    <AppShell
      title="Processing queue"
      subtitle="Phase 1 tracks status only. Automated extraction and AI summaries arrive in Phase 2."
      actions={
        <Link href="/research" className="btn btn-ghost">
          Library
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
      <div className="surface mb-5 p-4 text-sm text-ink-muted">
        Pipeline stages (queue-ready): file uploaded → text extraction → structure → metadata →
        chapters → chunking → summary → findings → citation validation → topic tagging → question
        linking → principle linking → human review → complete.
      </div>
      {queue.length === 0 ? (
        <p className="text-ink-muted">No sources currently queued or in review.</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((source) => (
            <li
              key={source.id}
              className="surface flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <Link href={`/research/${source.id}`} className="font-medium hover:text-accent">
                  {source.title}
                </Link>
                <div className="mt-1 text-sm text-ink-muted">
                  Progress placeholder · started{" "}
                  {source.updated_at.slice(0, 16).replace("T", " ")}
                </div>
              </div>
              <ResearchStatusBadge status={source.processing_status} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
