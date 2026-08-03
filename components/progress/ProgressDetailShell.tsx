import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export function ProgressDetailShell({
  title,
  subtitle,
  count,
  expectedCount,
  search,
  sort,
  children,
  filters,
}: {
  title: string;
  subtitle: string;
  count: number;
  expectedCount: number;
  search?: string;
  sort?: string;
  filters?: ReactNode;
  children: ReactNode;
}) {
  const mismatch = count !== expectedCount;
  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/home" className="btn btn-secondary">
          Back to Home
        </Link>
        <span className="text-sm text-ink-muted">
          Showing {count}
          {expectedCount !== count ? ` · Home tile ${expectedCount}` : ""}
        </span>
      </div>
      {mismatch ? (
        <p className="mb-4 text-sm text-danger" role="alert">
          Count mismatch: detail list {count} vs Home tile {expectedCount}.
        </p>
      ) : null}
      <form className="surface mb-5 flex flex-wrap gap-3 p-4" method="get">
        <label className="text-sm text-ink-muted">
          Search
          <input
            name="q"
            defaultValue={search ?? ""}
            className="mt-1 block w-56 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-base"
            placeholder="Filter titles"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Sort
          <select
            name="sort"
            defaultValue={sort ?? "newest"}
            className="mt-1 block rounded-xl border border-border bg-bg-elevated px-3 py-2 text-base"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
            <option value="category">Category</option>
            <option value="module">Module</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn btn-secondary">
            Apply
          </button>
        </div>
        {filters}
      </form>
      {children}
    </AppShell>
  );
}
