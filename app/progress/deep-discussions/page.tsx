import Link from "next/link";
import { ProgressDetailShell } from "@/components/progress/ProgressDetailShell";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import {
  listDeepDiscussionRecords,
  sortProgressRecords,
  type ProgressRecordSort,
} from "@/lib/services/progress-records";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function DeepDiscussionsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const store = await readStore();
  const metrics = buildFamilyProgressMetrics(store);
  const q = (sp.q ?? "").trim().toLowerCase();
  let records = listDeepDiscussionRecords(store);
  if (q) {
    records = records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }
  records = sortProgressRecords(
    records,
    (sp.sort as ProgressRecordSort) ?? "newest",
  );

  return (
    <ProgressDetailShell
      title="Deep discussions"
      subtitle="Canonical questions with a saved deep answer"
      count={records.length}
      expectedCount={metrics.canonicalQuestionsAnswered}
      search={sp.q}
      sort={sp.sort}
    >
      {records.length === 0 ? (
        <p className="text-ink-muted">No deep discussions answered yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id} className="surface p-4">
              <div className="font-medium">{r.title}</div>
              <p className="mt-1 text-sm text-ink-muted">
                {r.category} · {r.actorStatus} · shared {r.sharedAnswerStatus}
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                Updated {new Date(r.lastUpdated).toLocaleString()}
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
