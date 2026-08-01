/**
 * Versioned content upgrade: preview + apply safe seeded-content changes.
 * Never overwrites answers, manual dates, custom titles/notes, or completion.
 */
import type { AppStore, ChecklistTask, Question } from "@/lib/types/models";
import {
  BEFORE_BIRTH_ESSENTIALS_VERSION,
  looksLikeFutureStageQuestion,
  selectEssentialPrimaryQuestions,
} from "@/lib/content/before-birth-essentials";
import seedQuestions from "@/data/seed/questions.json";
import { BEFORE_BABY_OWNERSHIP } from "@/lib/checklists/ownership";

export const CONTENT_TEMPLATE_VERSION = "content-architecture-v1";

export type ContentChangeType =
  | "retitle"
  | "reprioritize"
  | "ownership_suggestion"
  | "flag_future_stage";

export type ContentChange = {
  id: string;
  template_version: string;
  entity_type: "question" | "checklist_task";
  entity_id: string;
  change_type: ContentChangeType;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
  data_preserved: string[];
  safe: boolean;
};

export type ContentUpgradePreview = {
  template_version: string;
  essentials_version: string;
  generated_at: string;
  changes: ContentChange[];
  summary: {
    questions_retitled: number;
    questions_reprioritized: number;
    questions_in_essentials: number;
    ownership_suggestions: number;
    future_stage_flags: number;
  };
};

function seedById(): Map<string, (typeof seedQuestions)[number]> {
  return new Map(seedQuestions.map((q) => [q.id, q]));
}

export function buildContentUpgradePreview(store: AppStore): ContentUpgradePreview {
  const changes: ContentChange[] = [];
  const seedMap = seedById();
  const essentialPrimary = new Set(
    selectEssentialPrimaryQuestions(store.questions).map((q) => q.id),
  );
  const essentials = essentialPrimary.size;

  for (const q of store.questions) {
    const seeded = seedMap.get(q.id);
    if (!seeded) continue;

    // Retitle truncated stored titles from seed full text.
    if (
      (q.short_title.includes("…") || q.short_title.includes("...")) &&
      seeded.text.length >= q.short_title.length
    ) {
      changes.push({
        id: `retitle:${q.id}`,
        template_version: CONTENT_TEMPLATE_VERSION,
        entity_type: "question",
        entity_id: q.id,
        change_type: "retitle",
        before: { short_title: q.short_title },
        after: { short_title: seeded.text },
        reason: "Replace stored ellipsis truncation with full question text.",
        data_preserved: ["answers", "status", "history", "id"],
        safe: true,
      });
    } else if (seeded.short_title !== q.short_title && seeded.short_title === seeded.text) {
      // Seed already repaired; sync if store still truncated-equivalent
      if (q.short_title.endsWith("…") || q.short_title.endsWith("...")) {
        changes.push({
          id: `retitle:${q.id}`,
          template_version: CONTENT_TEMPLATE_VERSION,
          entity_type: "question",
          entity_id: q.id,
          change_type: "retitle",
          before: { short_title: q.short_title },
          after: { short_title: seeded.short_title },
          reason: "Sync repaired seed title into family store.",
          data_preserved: ["answers", "status", "history", "id"],
          safe: true,
        });
      }
    }

    if (
      q.priority === "essential_before_birth" &&
      looksLikeFutureStageQuestion(q)
    ) {
      changes.push({
        id: `future:${q.id}`,
        template_version: CONTENT_TEMPLATE_VERSION,
        entity_type: "question",
        entity_id: q.id,
        change_type: "flag_future_stage",
        before: { priority: q.priority },
        after: { priority: "future" },
        reason: "Move teen/adult-stage topics out of before-birth essentials.",
        data_preserved: ["answers", "status", "history", "id", "text"],
        safe: true,
      });
    } else if (
      q.priority === "essential_before_birth" &&
      !essentialPrimary.has(q.id) &&
      !q.required_before_birth
    ) {
      changes.push({
        id: `prio:${q.id}`,
        template_version: CONTENT_TEMPLATE_VERSION,
        entity_type: "question",
        entity_id: q.id,
        change_type: "reprioritize",
        before: { priority: q.priority },
        after: { priority: "high" },
        reason:
          "Narrow Before Birth Essentials; keep question in full library at high priority.",
        data_preserved: ["answers", "status", "history", "id", "text"],
        safe: true,
      });
    }
  }

  for (const task of store.checklist_tasks) {
    if (!task.template_task_slug || task.is_custom) continue;
    const suggested = BEFORE_BABY_OWNERSHIP[task.template_task_slug];
    if (!suggested) continue;
    if (task.owner === suggested.primary_owner) continue;
    // Only suggest when still default "both"
    if (task.owner !== "both") continue;
    changes.push({
      id: `owner:${task.id}`,
      template_version: CONTENT_TEMPLATE_VERSION,
      entity_type: "checklist_task",
      entity_id: task.id,
      change_type: "ownership_suggestion",
      before: { owner: task.owner },
      after: {
        owner: suggested.primary_owner,
        contributor: suggested.contributor,
        joint_approval_required: suggested.joint_approval_required,
      },
      reason: suggested.reason,
      data_preserved: ["completion", "notes", "manual_dates", "custom_title"],
      safe: true,
    });
  }

  const summary = {
    questions_retitled: changes.filter((c) => c.change_type === "retitle").length,
    questions_reprioritized: changes.filter((c) => c.change_type === "reprioritize")
      .length,
    questions_in_essentials: essentials,
    ownership_suggestions: changes.filter(
      (c) => c.change_type === "ownership_suggestion",
    ).length,
    future_stage_flags: changes.filter((c) => c.change_type === "flag_future_stage")
      .length,
  };

  return {
    template_version: CONTENT_TEMPLATE_VERSION,
    essentials_version: BEFORE_BIRTH_ESSENTIALS_VERSION,
    generated_at: new Date().toISOString(),
    changes,
    summary,
  };
}

export function applyContentUpgradeChanges(
  store: AppStore,
  changeIds: string[],
): { store: AppStore; applied: number; skipped: number } {
  const preview = buildContentUpgradePreview(store);
  const selected = new Set(changeIds);
  const applyAll = changeIds.length === 1 && changeIds[0] === "*";
  let applied = 0;
  let skipped = 0;

  const questions = store.questions.map((q) => ({ ...q }));
  const qById = new Map(questions.map((q) => [q.id, q]));
  const tasks = store.checklist_tasks.map((t) => ({ ...t }));
  const tById = new Map(tasks.map((t) => [t.id, t]));

  for (const change of preview.changes) {
    if (!applyAll && !selected.has(change.id)) continue;
    if (!change.safe) {
      skipped += 1;
      continue;
    }
    if (change.entity_type === "question") {
      const q = qById.get(change.entity_id);
      if (!q) {
        skipped += 1;
        continue;
      }
      if (change.change_type === "retitle") {
        q.short_title = String(change.after.short_title);
        q.updated_at = new Date().toISOString();
        applied += 1;
      } else if (
        change.change_type === "reprioritize" ||
        change.change_type === "flag_future_stage"
      ) {
        q.priority = change.after.priority as Question["priority"];
        q.updated_at = new Date().toISOString();
        applied += 1;
      }
    } else if (change.entity_type === "checklist_task") {
      const t = tById.get(change.entity_id);
      if (!t) {
        skipped += 1;
        continue;
      }
      if (change.change_type === "ownership_suggestion") {
        // Never overwrite non-default ownership or completed custom intent.
        if (t.owner !== "both") {
          skipped += 1;
          continue;
        }
        t.owner = change.after.owner as ChecklistTask["owner"];
        t.updated_at = new Date().toISOString();
        applied += 1;
      }
    }
  }

  return {
    store: {
      ...store,
      questions,
      checklist_tasks: tasks,
    },
    applied,
    skipped,
  };
}
