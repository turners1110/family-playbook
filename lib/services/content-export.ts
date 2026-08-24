import { readStore } from "@/lib/db/store";
import {
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
} from "@/lib/checklists";
import type { AppStore, ChecklistTask, Question } from "@/lib/types/models";

function mdEscape(text: string) {
  return text.replace(/\|/g, "\\|");
}

/**
 * V2 structured questions embed options inline in response_schema
 * (multi_select/ranking/single_choice: options[]; matrix: rows[]/columns[]).
 * The relational question_options table is a mostly-unused V1 leftover.
 */
function inlineOptionLabels(q: Question): string[] {
  const schema = q.response_schema as Record<string, unknown> | undefined;
  if (!schema) return [];
  const options = schema.options;
  if (Array.isArray(options)) {
    return options.map((o) => (typeof o === "string" ? o : JSON.stringify(o)));
  }
  const rows = Array.isArray(schema.rows) ? schema.rows : [];
  const columns = Array.isArray(schema.columns) ? schema.columns : [];
  if (rows.length || columns.length) {
    return [
      ...rows.map((r) => `row: ${typeof r === "string" ? r : JSON.stringify(r)}`),
      ...columns.map((c) => `column: ${typeof c === "string" ? c : JSON.stringify(c)}`),
    ];
  }
  return [];
}

function questionMarkdownBlock(q: Question, optionLabels: string[]) {
  const lines: string[] = [];
  lines.push(`### ${q.short_title}`);
  lines.push("");
  lines.push(`**Question:** ${q.text}`);
  lines.push("");
  lines.push(
    `**Priority:** ${q.priority} · **Type:** ${q.question_type} · **Est. minutes:** ${q.estimated_minutes} · **Emotional weight:** ${q.emotional_weight}/5`,
  );
  lines.push(
    `**Life stages:** ${q.life_stages.join(", ") || "—"}  \n**Categories:** ${q.categories.join(", ") || "—"}`,
  );
  if (q.required_before_birth) lines.push(`**Required before birth:** yes`);
  if (q.babymoon_priority) lines.push(`**Babymoon priority:** yes`);
  lines.push("");
  lines.push(`**Why it matters:** ${q.why_it_matters}`);
  lines.push("");
  lines.push(`**Discussion guidance:** ${q.discussion_guidance}`);
  if (optionLabels.length) {
    lines.push("");
    lines.push(`**Options:** ${optionLabels.join(", ")}`);
  }
  if (q.practical_tip) {
    lines.push("");
    lines.push(`**Practical tip:** ${q.practical_tip}`);
  }
  if (q.evidence_summary) {
    lines.push("");
    lines.push(`**Evidence:** ${q.evidence_summary}`);
  }
  if (q.follow_up_prompts?.length) {
    lines.push("");
    lines.push(`**Follow-up prompts:**`);
    for (const p of q.follow_up_prompts) lines.push(`- ${p}`);
  }
  lines.push("");
  lines.push(`_id: \`${q.id}\`_`);
  return lines.join("\n");
}

/** Full question bank, grouped by category, as readable Markdown. Includes inactive-filtered set only. */
export function questionsToMarkdown(store: AppStore) {
  const questions = store.questions
    .filter((q) => q.active !== false)
    .slice()
    .sort((a, b) => a.logical_order - b.logical_order);

  const byCategory = new Map<string, Question[]>();
  for (const q of questions) {
    const cat = q.categories[0] ?? "uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(q);
  }

  const optionsByQuestion = new Map<string, string[]>();
  for (const opt of store.question_options) {
    if (!optionsByQuestion.has(opt.question_id)) {
      optionsByQuestion.set(opt.question_id, []);
    }
    optionsByQuestion.get(opt.question_id)!.push(opt.label);
  }
  for (const q of questions) {
    if (optionsByQuestion.has(q.id)) continue;
    const inline = inlineOptionLabels(q);
    if (inline.length) optionsByQuestion.set(q.id, inline);
  }

  const lines: string[] = [];
  lines.push(`# Question Bank — Full Detail`);
  lines.push("");
  lines.push(
    `${questions.length} active questions, generated ${new Date().toISOString()}.`,
  );
  lines.push("");

  for (const [category, items] of [...byCategory.entries()].sort()) {
    lines.push(`## ${category}`);
    lines.push("");
    for (const q of items) {
      lines.push(questionMarkdownBlock(q, optionsByQuestion.get(q.id) ?? []));
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** Full question bank with nested options, as JSON. */
export function questionsToJson(store: AppStore) {
  const optionsByQuestion = new Map<string, { value: string; label: string }[]>();
  for (const opt of store.question_options) {
    if (!optionsByQuestion.has(opt.question_id)) {
      optionsByQuestion.set(opt.question_id, []);
    }
    optionsByQuestion.get(opt.question_id)!.push({ value: opt.value, label: opt.label });
  }

  return store.questions
    .filter((q) => q.active !== false)
    .slice()
    .sort((a, b) => a.logical_order - b.logical_order)
    .map((q) => {
      const tableOptions = optionsByQuestion.get(q.id) ?? [];
      const options = tableOptions.length
        ? tableOptions
        : inlineOptionLabels(q).map((label) => ({ value: label, label }));
      return { ...q, options };
    });
}

function taskMarkdownRow(t: ChecklistTask) {
  const due = t.due_date ?? "—";
  const owner = CHECKLIST_OWNER_LABELS[t.owner] ?? t.owner;
  const priority = CHECKLIST_PRIORITY_LABELS[t.priority] ?? t.priority;
  const status = t.completed ? "✓ Done" : "Open";
  return `| ${mdEscape(t.title)} | ${status} | ${priority} | ${owner} | ${due} | ${mdEscape(t.timing_reason ?? "")} |`;
}

/** Before Baby checklist, grouped by category, as readable Markdown. */
export function beforeBabyChecklistToMarkdown(store: AppStore) {
  const instance = store.checklist_instances.find(
    (c) => c.template_slug === "before-baby",
  );
  const tasks = store.checklist_tasks
    .filter((t) => !t.archived && t.checklist_id === instance?.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const byCategory = new Map<string, ChecklistTask[]>();
  for (const t of tasks) {
    if (!byCategory.has(t.category_label)) byCategory.set(t.category_label, []);
    byCategory.get(t.category_label)!.push(t);
  }

  const lines: string[] = [];
  lines.push(`# Before Baby Checklist — Full Detail`);
  lines.push("");
  lines.push(
    `${tasks.length} tasks (${tasks.filter((t) => t.completed).length} complete), generated ${new Date().toISOString()}.`,
  );
  if (store.settings.expected_due_date) {
    lines.push(`Due date: ${store.settings.expected_due_date}`);
  }
  lines.push("");

  for (const [category, items] of [...byCategory.entries()].sort()) {
    lines.push(`## ${category}`);
    lines.push("");
    lines.push("| Task | Status | Priority | Owner | Due | Timing reason |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const t of items) lines.push(taskMarkdownRow(t));
    lines.push("");
  }

  return lines.join("\n");
}

/** Before Baby checklist, as JSON (tasks only, not archived). */
export function beforeBabyChecklistToJson(store: AppStore) {
  const instance = store.checklist_instances.find(
    (c) => c.template_slug === "before-baby",
  );
  return store.checklist_tasks
    .filter((t) => !t.archived && t.checklist_id === instance?.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function buildContentExports() {
  const store = await readStore();
  return {
    questionsMarkdown: questionsToMarkdown(store),
    questionsJson: JSON.stringify(questionsToJson(store), null, 2),
    beforeBabyMarkdown: beforeBabyChecklistToMarkdown(store),
    beforeBabyJson: JSON.stringify(beforeBabyChecklistToJson(store), null, 2),
  };
}
