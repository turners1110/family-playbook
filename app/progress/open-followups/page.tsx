import Link from "next/link";
import { ProgressDetailShell } from "@/components/progress/ProgressDetailShell";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import {
  listOpenFollowUpRecords,
  sortProgressRecords,
  type OpenFollowUpGroup,
  type ProgressRecordSort,
} from "@/lib/services/progress-records";
import { readStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const GROUP_LABELS: Record<OpenFollowUpGroup, string> = {
  discuss_later: "Discuss later",
  waiting_provider: "Waiting for provider",
  needs_research: "Needs research",
  unresolved_differences: "Unresolved differences",
  follow_up_requested: "Follow-up requested",
  undecided: "Undecided",
  partial: "Partial answers",
};

const GROUP_ORDER: OpenFollowUpGroup[] = [
  "discuss_later",
  "waiting_provider",
  "needs_research",
  "unresolved_differences",
  "follow_up_requested",
  "undecided",
  "partial",
];

export default async function OpenFollowUpsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const store = await readStore();
  const metrics = buildFamilyProgressMetrics(store);
  const q = (sp.q ?? "").trim().toLowerCase();
  let records = listOpenFollowUpRecords(store);
  if (sp.group && sp.group in GROUP_LABELS) {
    records = records.filter((r) => r.group === sp.group);
  }
  if (q) {
    records = records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q),
    );
  }
  records = sortProgressRecords(
    records,
    (sp.sort as ProgressRecordSort) ?? "newest",
  );

  return (
    <ProgressDetailShell
      title="Open follow-ups"
      subtitle="Items marked for later, provider input, research, or review"
      count={records.length}
      expectedCount={
        sp.group || q ? records.length : metrics.openFollowUps
      }
      search={sp.q}
      sort={sp.sort}
      filters={
        <label className="text-sm text-ink-muted">
          Group
          <select
            name="group"
            defaultValue={sp.group ?? ""}
            className="mt-1 block rounded-xl border border-border bg-bg-elevated px-3 py-2 text-base"
          >
            <option value="">All</option>
            {GROUP_ORDER.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {records.length === 0 ? (
        <p className="text-ink-muted">No open follow-ups.</p>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((group) => {
            const items = records.filter((r) => r.group === group);
            if (!items.length) return null;
            return (
              <section key={group}>
                <h2 className="font-display text-xl">
                  {GROUP_LABELS[group]}
                </h2>
                <ul className="mt-3 space-y-3">
                  {items.map((r) => (
                    <li key={r.id} className="surface p-4">
                      <div className="font-medium">{r.title}</div>
                      <p className="mt-1 text-sm text-ink-muted">{r.detail}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Updated {new Date(r.lastUpdated).toLocaleString()}
                      </p>
                      <Link href={r.href} className="btn btn-secondary mt-3">
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </ProgressDetailShell>
  );
}
