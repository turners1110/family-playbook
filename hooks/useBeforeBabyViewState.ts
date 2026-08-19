"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  beforeBabyViewSearch,
  parseBeforeBabyViewState,
  withDisplayMode,
  withFilter,
  withGroupBy,
  type BeforeBabyViewState,
  type DisplayMode,
  type GroupBy,
} from "@/lib/checklists/view-state";
import type { TimelineView } from "@/lib/checklists/scheduling";

export function useBeforeBabyViewState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = parseBeforeBabyViewState(params);

  const replace = useCallback(
    (next: BeforeBabyViewState) => {
      router.replace(`${pathname}${beforeBabyViewSearch(next)}`, { scroll: false });
    },
    [pathname, router],
  );

  return {
    state,
    setDisplayMode: (mode: DisplayMode) => replace(withDisplayMode(state, mode)),
    setGroupBy: (groupBy: GroupBy) => replace(withGroupBy(state, groupBy)),
    setFilter: (filter: TimelineView) => replace(withFilter(state, filter)),
    setTimeline: (groupBy: GroupBy) =>
      replace({
        displayMode: "timeline",
        groupBy,
        filter: state.filter === "attention" ? "all" : state.filter,
      }),
  };
}
