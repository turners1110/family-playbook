import type { AppStore, ChecklistTask } from "@/lib/types/models";
import {
  ESSENTIALS_SCREENS,
  type TaskSuggestionTemplate,
} from "@/lib/essentials/pathway";
import { id, nowIso } from "@/lib/db/store";

export type SuggestedTaskPreview = TaskSuggestionTemplate & {
  screen_id: string;
  screen_title: string;
  already_present: boolean;
};

export function collectTaskSuggestions(store: AppStore): SuggestedTaskPreview[] {
  const titles = new Set(
    store.checklist_tasks
      .filter((t) => !t.archived)
      .map((t) => t.title.toLowerCase()),
  );
  const out: SuggestedTaskPreview[] = [];
  for (const screen of ESSENTIALS_SCREENS) {
    for (const suggestion of screen.task_suggestions ?? []) {
      out.push({
        ...suggestion,
        screen_id: screen.id,
        screen_title: screen.title,
        already_present: titles.has(suggestion.title.toLowerCase()),
      });
    }
  }
  return out;
}

export function buildSuggestedChecklistTasks(
  checklistId: string,
  suggestions: SuggestedTaskPreview[],
): ChecklistTask[] {
  const ts = nowIso();
  return suggestions
    .filter((s) => !s.already_present)
    .map((s, index) => ({
      id: id("ctask"),
      checklist_id: checklistId,
      template_task_slug: null,
      title: s.title,
      category: s.category,
      category_label: s.category_label,
      completed: false,
      completed_at: null,
      due_date: null,
      priority: "medium" as const,
      owner: "both" as const,
      notes: `From Before Birth Essentials · ${s.screen_title}. ${s.reason}`,
      is_custom: true,
      is_default: false,
      archived: false,
      sort_order: 9000 + index,
      created_at: ts,
      updated_at: ts,
      timing_type: s.timing_hint === "after_birth" ? "after_birth" : "before_birth",
      date_source: "none" as const,
      ownership_source: "suggested" as const,
    }));
}
