/**
 * Checklist template registry — future templates (First Year, Toddler, etc.)
 * register here without changing product UI.
 */

export type ChecklistOwner = "sam" | "michelle" | "both";
export type ChecklistPriority = "high" | "medium" | "low";

export type ChecklistTemplateTaskDef = {
  slug: string;
  title: string;
  priority?: ChecklistPriority;
  owner?: ChecklistOwner;
};

export type ChecklistTemplateSectionDef = {
  slug: string;
  label: string;
  sort_order: number;
  tasks: ChecklistTemplateTaskDef[];
};

export type ChecklistTemplateDef = {
  slug: string;
  title: string;
  description: string;
  sections: ChecklistTemplateSectionDef[];
};

export const CHECKLIST_OWNERS = ["sam", "michelle", "both"] as const;
export const CHECKLIST_PRIORITIES = ["high", "medium", "low"] as const;

export const CHECKLIST_OWNER_LABELS: Record<ChecklistOwner, string> = {
  sam: "Sam",
  michelle: "Michelle",
  both: "Both",
};

export const CHECKLIST_PRIORITY_LABELS: Record<ChecklistPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const registry = new Map<string, ChecklistTemplateDef>();

export function registerChecklistTemplate(template: ChecklistTemplateDef) {
  registry.set(template.slug, template);
}

export function getChecklistTemplate(slug: string): ChecklistTemplateDef | null {
  return registry.get(slug) ?? null;
}

export function listChecklistTemplates(): ChecklistTemplateDef[] {
  return [...registry.values()];
}

export function countTemplateTasks(template: ChecklistTemplateDef): number {
  return template.sections.reduce((sum, section) => sum + section.tasks.length, 0);
}
