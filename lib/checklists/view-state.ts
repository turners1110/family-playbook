import type { TimelineView } from "@/lib/checklists/scheduling";

export type DisplayMode = "attention" | "milestones" | "timeline";
export type GroupBy = "none" | "owner" | "category";

export const ADVANCED_FILTERS: Array<{ id: TimelineView; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "next_week", label: "Next week" },
  { id: "next_2_weeks", label: "Next 2 weeks" },
  { id: "final_month", label: "Final month" },
  { id: "final_week", label: "Final week" },
  { id: "after_birth", label: "After birth" },
  { id: "overdue", label: "Overdue" },
  { id: "do_now", label: "Do now" },
  { id: "recommended", label: "Recommended" },
  { id: "by_priority", label: "Priority" },
  { id: "by_owner", label: "By owner" },
  { id: "by_category", label: "By category" },
  { id: "by_week", label: "By week" },
  { id: "by_month", label: "By month" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export type BeforeBabyViewState = {
  displayMode: DisplayMode;
  groupBy: GroupBy;
  filter: TimelineView | "attention";
};

export const DEFAULT_VIEW_STATE: BeforeBabyViewState = {
  displayMode: "attention",
  groupBy: "none",
  filter: "attention",
};

const DISPLAY_MODES: DisplayMode[] = ["attention", "milestones", "timeline"];
const GROUPS: GroupBy[] = ["none", "owner", "category"];
const FILTERS = new Set<string>([
  "attention",
  ...ADVANCED_FILTERS.map((f) => f.id),
]);

export function parseBeforeBabyViewState(
  search: URLSearchParams | Record<string, string | undefined>,
): BeforeBabyViewState {
  const get = (key: string) =>
    search instanceof URLSearchParams ? search.get(key) : search[key];
  const rawMode = get("view") ?? "attention";
  const displayMode = DISPLAY_MODES.includes(rawMode as DisplayMode)
    ? (rawMode as DisplayMode)
    : "attention";
  const rawGroup = get("group") ?? "none";
  const groupBy = GROUPS.includes(rawGroup as GroupBy)
    ? (rawGroup as GroupBy)
    : "none";
  const rawFilter = get("filter") ?? (displayMode === "attention" ? "attention" : "all");
  const filter = FILTERS.has(rawFilter)
    ? (rawFilter as BeforeBabyViewState["filter"])
    : "attention";

  if (displayMode === "attention") {
    return { displayMode: "attention", groupBy: "none", filter: "attention" };
  }
  if (displayMode === "milestones") {
    return { displayMode: "milestones", groupBy: "none", filter: "attention" };
  }
  return {
    displayMode: "timeline",
    groupBy,
    filter: filter === "attention" ? "all" : filter,
  };
}

export function beforeBabyViewSearch(state: BeforeBabyViewState): string {
  const params = new URLSearchParams();
  params.set("view", state.displayMode);
  if (state.displayMode === "timeline") {
    if (state.groupBy !== "none") params.set("group", state.groupBy);
    if (state.filter !== "all") params.set("filter", state.filter);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "?view=attention";
}

/** Owner/category grouping never overrides the selected filter. */
export function withDisplayMode(
  state: BeforeBabyViewState,
  displayMode: DisplayMode,
): BeforeBabyViewState {
  if (displayMode === "attention") return { ...DEFAULT_VIEW_STATE };
  if (displayMode === "milestones") {
    return { displayMode: "milestones", groupBy: "none", filter: "attention" };
  }
  return {
    displayMode: "timeline",
    groupBy: state.groupBy,
    filter: state.filter === "attention" ? "all" : state.filter,
  };
}

export function withGroupBy(
  state: BeforeBabyViewState,
  groupBy: GroupBy,
): BeforeBabyViewState {
  return {
    displayMode: "timeline",
    groupBy,
    filter: state.filter === "attention" ? "all" : state.filter,
  };
}

export function withFilter(
  state: BeforeBabyViewState,
  filter: TimelineView,
): BeforeBabyViewState {
  return {
    displayMode: "timeline",
    groupBy: state.groupBy,
    filter,
  };
}
