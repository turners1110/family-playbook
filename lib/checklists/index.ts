import "@/lib/checklists/templates/before-baby";
import "@/lib/checklists/templates/after-birth";

export {
  getChecklistTemplate,
  listChecklistTemplates,
  countTemplateTasks,
  CHECKLIST_OWNER_LABELS,
  CHECKLIST_PRIORITY_LABELS,
  CHECKLIST_OWNERS,
  CHECKLIST_PRIORITIES,
} from "@/lib/checklists/types";

export type {
  ChecklistOwner,
  ChecklistPriority,
  ChecklistTemplateDef,
  ChecklistTemplateSectionDef,
  ChecklistTemplateTaskDef,
} from "@/lib/checklists/types";

export { BEFORE_BABY_TEMPLATE } from "@/lib/checklists/templates/before-baby";
export { AFTER_BIRTH_TEMPLATE } from "@/lib/checklists/templates/after-birth";
export { BEFORE_BABY_MILESTONES, buildMilestoneViews } from "@/lib/checklists/milestones";
export {
  TEMPLATE_DEPENDENCIES,
  applyDependencyState,
  validateDependencies,
} from "@/lib/checklists/dependencies";
