import type { AppStore } from "@/lib/types/models";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { collectTaskSuggestions } from "@/lib/essentials/task-suggestions";

export type BabymoonSummary = {
  generated_at: string;
  completed_count: number;
  open_count: number;
  shared_decisions: Array<{ title: string; summary: string }>;
  open_decisions: Array<{ title: string; reason: string }>;
  different_viewpoints: Array<{ title: string; note: string }>;
  provider_questions: Array<{ title: string }>;
  tasks_to_add: Array<{ title: string; reason: string }>;
  policies_drafted: Array<{ title: string; summary: string }>;
  revisit_after_birth: Array<{ title: string; trigger: string }>;
};

export function buildBabymoonSummary(store: AppStore): BabymoonSummary {
  const dash = buildEssentialsDashboard(store);
  const shared_decisions: BabymoonSummary["shared_decisions"] = [];
  const open_decisions: BabymoonSummary["open_decisions"] = [];
  const different_viewpoints: BabymoonSummary["different_viewpoints"] = [];
  const provider_questions: BabymoonSummary["provider_questions"] = [];
  const policies_drafted: BabymoonSummary["policies_drafted"] = [];
  const revisit_after_birth: BabymoonSummary["revisit_after_birth"] = [];

  for (const row of dash.screens.filter((s) => s.visible)) {
    const shared = store.answers.find(
      (a) => a.question_id === row.screen.question_id && a.is_shared,
    );
    const separates = store.answers.filter(
      (a) => a.question_id === row.screen.question_id && !a.is_shared,
    );

    if (shared?.payload.text || shared?.payload.choice) {
      const summary =
        shared.payload.text ||
        (Array.isArray(shared.payload.choice)
          ? shared.payload.choice.join(", ")
          : String(shared.payload.choice ?? ""));
      if (
        row.screen.response_type === "policy_builder" ||
        row.screen.response_type === "responsibility_matrix"
      ) {
        policies_drafted.push({ title: row.screen.title, summary });
      } else {
        shared_decisions.push({ title: row.screen.title, summary });
      }
    }

    if (row.state === "not_started" || row.state === "in_progress") {
      open_decisions.push({
        title: row.screen.title,
        reason: row.label,
      });
    }
    if (row.state === "needs_follow_up") {
      open_decisions.push({
        title: row.screen.title,
        reason: "Needs follow-up",
      });
    }

    if (separates.length >= 2) {
      const texts = separates.map((a) => a.payload.text?.trim()).filter(Boolean);
      if (texts.length >= 2 && texts[0] !== texts[1] && !shared?.payload.text) {
        different_viewpoints.push({
          title: row.screen.title,
          note: "Separate answers differ; no shared conclusion yet.",
        });
      }
    }

    if (row.screen.provider_label) {
      const needs =
        shared?.needs_research ||
        shared?.status === "needs_research" ||
        separates.some((a) => a.needs_research);
      if (needs || row.state === "needs_follow_up") {
        provider_questions.push({ title: row.screen.title });
      }
    }

    if (
      row.screen.review_trigger.toLowerCase().includes("postpartum") ||
      row.screen.review_trigger.toLowerCase().includes("after birth") ||
      row.screen.review_trigger.toLowerCase().includes("day 7") ||
      row.screen.review_trigger.toLowerCase().includes("week")
    ) {
      revisit_after_birth.push({
        title: row.screen.title,
        trigger: row.screen.review_trigger,
      });
    }
  }

  const tasks = collectTaskSuggestions(store).filter((t) => !t.already_present);

  return {
    generated_at: new Date().toISOString(),
    completed_count: dash.completed,
    open_count: dash.not_started + dash.in_progress + dash.needs_follow_up,
    shared_decisions,
    open_decisions,
    different_viewpoints,
    provider_questions,
    tasks_to_add: tasks.map((t) => ({ title: t.title, reason: t.reason })),
    policies_drafted,
    revisit_after_birth,
  };
}
