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
import { TEMPLATE_DEPENDENCIES } from "@/lib/checklists/dependencies";
import { inferPrimaryDiscussionStage } from "@/lib/content/primary-stages";
import {
  GENERIC_GUIDANCE_MARKERS,
  GENERIC_WHY_MARKERS,
  helperForQuestion,
} from "@/lib/content/helper-templates";
import { getDefaultTimingForTask } from "@/lib/checklists/default-timing";

export const CONTENT_TEMPLATE_VERSION = "content-architecture-v2";

export type ContentChangeType =
  | "retitle"
  | "reprioritize"
  | "ownership_suggestion"
  | "flag_future_stage"
  | "add_dependency"
  | "primary_stage"
  | "helper_template"
  | "timing_window"
  | "new_task_available";

export type ContentChange = {
  id: string;
  template_version: string;
  entity_type: "question" | "checklist_task" | "checklist";
  entity_id: string;
  change_type: ContentChangeType;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
  data_preserved: string[];
  safe: boolean;
  section?:
    | "titles"
    | "timeline"
    | "milestones"
    | "dependencies"
    | "ownership"
    | "new_tasks"
    | "post_birth"
    | "primary_stages"
    | "helpers";
  user_data_exists?: boolean;
  manual_approval_required?: boolean;
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
    dependencies_added: number;
    primary_stages_set: number;
    helper_updates: number;
    timing_updates: number;
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
        section: "titles",
      });
    } else if (
      seeded.short_title !== q.short_title &&
      seeded.short_title === seeded.text &&
      (q.short_title.endsWith("…") || q.short_title.endsWith("..."))
    ) {
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
        section: "titles",
      });
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
        section: "primary_stages",
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
        section: "primary_stages",
      });
    }

    if (q.primary_stage_source !== "manual") {
      const inferred = inferPrimaryDiscussionStage(q);
      if (q.primary_discussion_stage !== inferred.primary) {
        changes.push({
          id: `stage:${q.id}`,
          template_version: CONTENT_TEMPLATE_VERSION,
          entity_type: "question",
          entity_id: q.id,
          change_type: "primary_stage",
          before: {
            primary_discussion_stage: q.primary_discussion_stage ?? null,
          },
          after: {
            primary_discussion_stage: inferred.primary,
            review_stages: inferred.review_stages,
            trigger_event: inferred.trigger_event,
            timing_reason: inferred.timing_reason,
            primary_stage_source: "rule_based",
          },
          reason: inferred.timing_reason,
          data_preserved: ["answers", "life_stages", "id"],
          safe: inferred.confidence !== "low",
          section: "primary_stages",
          manual_approval_required: inferred.confidence === "low",
        });
      }
    }

    const generic =
      GENERIC_WHY_MARKERS.some((m) => q.why_it_matters.includes(m)) ||
      GENERIC_GUIDANCE_MARKERS.some((m) => q.discussion_guidance.includes(m));
    if (generic) {
      const helpers = helperForQuestion(q);
      if (helpers.replaced) {
        changes.push({
          id: `helper:${q.id}`,
          template_version: CONTENT_TEMPLATE_VERSION,
          entity_type: "question",
          entity_id: q.id,
          change_type: "helper_template",
          before: {
            why_it_matters: q.why_it_matters,
            discussion_guidance: q.discussion_guidance,
          },
          after: {
            why_it_matters: helpers.why_it_matters,
            discussion_guidance: helpers.discussion_guidance,
            follow_up_prompts: helpers.follow_up_prompts,
          },
          reason: "Replace universal helper with type/category template.",
          data_preserved: ["answers", "id", "custom_edits_if_non_generic"],
          safe: true,
          section: "helpers",
        });
      }
    }
  }

  for (const task of store.checklist_tasks ?? []) {
    if (!task.template_task_slug || task.is_custom || task.archived) continue;

    const suggested = BEFORE_BABY_OWNERSHIP[task.template_task_slug];
    if (
      suggested &&
      task.owner === "both" &&
      task.owner !== suggested.primary_owner &&
      task.ownership_source !== "explicit" &&
      task.ownership_source !== "bulk"
    ) {
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
          ownership_source: "suggested",
        },
        reason: suggested.reason,
        data_preserved: ["completion", "notes", "manual_dates", "custom_title"],
        safe: true,
        section: "ownership",
      });
    }

    const needed = TEMPLATE_DEPENDENCIES[task.template_task_slug] ?? [];
    if (needed.length) {
      const current = task.depends_on_template_slugs ?? [];
      const missing = needed.filter((s) => !current.includes(s));
      if (missing.length) {
        changes.push({
          id: `dep:${task.id}`,
          template_version: CONTENT_TEMPLATE_VERSION,
          entity_type: "checklist_task",
          entity_id: task.id,
          change_type: "add_dependency",
          before: { depends_on_template_slugs: current },
          after: { depends_on_template_slugs: needed },
          reason: `Add seeded dependencies: ${missing.join(", ")}`,
          data_preserved: ["completion", "notes", "dates"],
          safe: true,
          section: "dependencies",
        });
      }
    }

    const timing = getDefaultTimingForTask(task.template_task_slug, task.category);
    if (
      task.date_source !== "manual" &&
      !task.manual_due_date &&
      timing.recommended_due_offset_days != null &&
      task.recommended_due_offset_days !== timing.recommended_due_offset_days
    ) {
      const hasUserDate = Boolean(task.manual_due_date);
      changes.push({
        id: `timing:${task.id}`,
        template_version: CONTENT_TEMPLATE_VERSION,
        entity_type: "checklist_task",
        entity_id: task.id,
        change_type: "timing_window",
        before: {
          recommended_due_offset_days: task.recommended_due_offset_days,
        },
        after: {
          recommended_due_offset_days: timing.recommended_due_offset_days,
          recommended_start_offset_days: timing.recommended_start_offset_days,
          timing_reason: timing.timing_reason,
          timing_window_label: timing.timing_window_label,
          task_tags: timing.task_tags ?? [],
        },
        reason: "Rebalance seeded timing window.",
        data_preserved: ["completion", "notes", "manual_dates"],
        safe: !hasUserDate,
        section: "timeline",
        user_data_exists: hasUserDate || task.completed,
        manual_approval_required: hasUserDate,
      });
    }
  }

  const beforeBaby = (store.checklist_instances ?? []).find(
    (c) => c.template_slug === "before-baby",
  );
  if (beforeBaby) {
    const existing = new Set(
      store.checklist_tasks
        .filter((t) => t.checklist_id === beforeBaby.id && t.template_task_slug)
        .map((t) => t.template_task_slug as string),
    );
    const missingSeeded = Object.keys(TEMPLATE_DEPENDENCIES).filter(
      (slug) => !existing.has(slug) && !slug.includes("legal_"),
    );
    // Signal that import can add new template rows (safe additive).
    const newSections = [
      "work_leave",
      "postpartum_prep",
      "legal_extra",
      "lulu_extra",
      "home_extra",
    ];
    for (const prefix of newSections) {
      const present = [...existing].some((s) => s.startsWith(prefix));
      if (!present) {
        changes.push({
          id: `newtasks:${prefix}`,
          template_version: CONTENT_TEMPLATE_VERSION,
          entity_type: "checklist",
          entity_id: beforeBaby.id,
          change_type: "new_task_available",
          before: { section: prefix, present: false },
          after: { section: prefix, present: true },
          reason: `Import Before Baby template to add ${prefix} tasks (additive; no overwrites).`,
          data_preserved: ["all_existing_tasks", "completion", "notes"],
          safe: true,
          section: "new_tasks",
        });
      }
    }
    void missingSeeded;
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
    dependencies_added: changes.filter((c) => c.change_type === "add_dependency")
      .length,
    primary_stages_set: changes.filter((c) => c.change_type === "primary_stage")
      .length,
    helper_updates: changes.filter((c) => c.change_type === "helper_template")
      .length,
    timing_updates: changes.filter((c) => c.change_type === "timing_window").length,
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
      } else if (change.change_type === "primary_stage") {
        if (q.primary_stage_source === "manual") {
          skipped += 1;
          continue;
        }
        q.primary_discussion_stage = change.after
          .primary_discussion_stage as Question["primary_discussion_stage"];
        q.review_stages = change.after.review_stages as Question["review_stages"];
        q.trigger_event = (change.after.trigger_event as string | null) ?? null;
        q.timing_reason = (change.after.timing_reason as string | null) ?? null;
        q.primary_stage_source = "rule_based";
        q.updated_at = new Date().toISOString();
        applied += 1;
      } else if (change.change_type === "helper_template") {
        const stillGeneric =
          GENERIC_WHY_MARKERS.some((m) => q.why_it_matters.includes(m)) ||
          GENERIC_GUIDANCE_MARKERS.some((m) => q.discussion_guidance.includes(m));
        if (!stillGeneric) {
          skipped += 1;
          continue;
        }
        q.why_it_matters = String(change.after.why_it_matters);
        q.discussion_guidance = String(change.after.discussion_guidance);
        if (Array.isArray(change.after.follow_up_prompts)) {
          q.follow_up_prompts = change.after.follow_up_prompts as string[];
        }
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
        if (
          t.owner !== "both" ||
          t.ownership_source === "explicit" ||
          t.ownership_source === "bulk"
        ) {
          skipped += 1;
          continue;
        }
        t.owner = change.after.owner as ChecklistTask["owner"];
        t.contributor = (change.after.contributor as ChecklistTask["contributor"]) ?? null;
        t.joint_approval_required = Boolean(change.after.joint_approval_required);
        t.ownership_source = "suggested";
        t.updated_at = new Date().toISOString();
        applied += 1;
      } else if (change.change_type === "add_dependency") {
        t.depends_on_template_slugs = change.after
          .depends_on_template_slugs as string[];
        t.updated_at = new Date().toISOString();
        applied += 1;
      } else if (change.change_type === "timing_window") {
        if (t.manual_due_date || t.date_source === "manual") {
          skipped += 1;
          continue;
        }
        t.recommended_due_offset_days = change.after
          .recommended_due_offset_days as number;
        t.recommended_target_offset_days = t.recommended_due_offset_days;
        t.recommended_start_offset_days = change.after
          .recommended_start_offset_days as number | null;
        t.timing_reason = String(change.after.timing_reason);
        t.timing_window_label =
          change.after.timing_window_label as ChecklistTask["timing_window_label"];
        t.task_tags = (change.after.task_tags as ChecklistTask["task_tags"]) ?? [];
        t.updated_at = new Date().toISOString();
        applied += 1;
      }
    } else if (change.change_type === "new_task_available") {
      // Additive import is a separate action; count as skipped here.
      skipped += 1;
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
