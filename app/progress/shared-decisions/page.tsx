import Link from "next/link";
import { ProgressDetailShell } from "@/components/progress/ProgressDetailShell";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import {
  listSharedDecisionRecords,
  sortProgressRecords,
  type ProgressRecordSort,
} from "@/lib/services/progress-records";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function SharedDecisionsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const store = await readStore();
  const metrics = buildFamilyProgressMetrics(store);
  const q = (sp.q ?? "").trim().toLowerCase();
  let records = listSharedDecisionRecords(store);
  if (q) {
    records = records.filter((r) => r.title.toLowerCase().includes(q));
  }
  records = sortProgressRecords(
    records.map((r) => ({ ...r, lastUpdated: r.createdAt })),
    (sp.sort as ProgressRecordSort) ?? "newest",
  );

  return (
    <ProgressDetailShell
      title="Shared decisions"
      subtitle="Agreed shared answers saved by both parents"
      count={records.length}
      expectedCount={metrics.sharedDecisions}
      search={sp.q}
      sort={sp.sort}
    >
      {records.length === 0 ? (
        <p className="text-ink-muted">No shared decisions yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id} className="surface p-4">
              <div className="font-medium">{r.title}</div>
              <p className="mt-1 text-sm text-ink-muted">
                {r.source.replace(/_/g, " ")} · {r.actors}
                {r.relatedTaskCount
                  ? ` · ${r.relatedTaskCount} related task${r.relatedTaskCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                Created {new Date(r.createdAt).toLocaleString()}
              </p>
              <Link href={r.href} className="btn btn-secondary mt-3">
                Open details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ProgressDetailShell>
  );
}
