/**
 * Timing validation for Before Baby templates and scheduled tasks.
 * Canonical rule: negative offset = before due date, 0 = due date, positive = after birth.
 */
import { BEFORE_BABY_TASK_TIMING } from "@/lib/checklists/default-timing";
import { BEFORE_BABY_TEMPLATE } from "@/lib/checklists/templates/before-baby";
import type { ChecklistTask } from "@/lib/types/models";
import { isDateOnly } from "@/lib/checklists/date-math";

export type TimingViolation = {
  code: string;
  entity_id: string;
  message: string;
};

export function validateTemplateTiming(): TimingViolation[] {
  const violations: TimingViolation[] = [];
  const titles = new Map<string, string>();
  for (const section of BEFORE_BABY_TEMPLATE.sections) {
    for (const task of section.tasks) {
      titles.set(task.slug, task.title);
      const timing = BEFORE_BABY_TASK_TIMING[task.slug];
      if (!timing) {
        violations.push({
          code: "missing_timing",
          entity_id: task.slug,
          message: `No timing definition for ${task.slug}`,
        });
        continue;
      }
      if (
        timing.timing_type === "before_birth" &&
        timing.recommended_due_offset_days != null &&
        timing.recommended_due_offset_days > 0
      ) {
        violations.push({
          code: "prebirth_positive_offset",
          entity_id: task.slug,
          message: `Pre-birth task “${task.title}” has positive target offset ${timing.recommended_due_offset_days}`,
        });
      }
      if (
        timing.timing_type === "after_birth" &&
        timing.recommended_due_offset_days != null &&
        timing.recommended_due_offset_days < 0
      ) {
        violations.push({
          code: "postbirth_negative_offset",
          entity_id: task.slug,
          message: `Post-birth task “${task.title}” has negative target offset ${timing.recommended_due_offset_days}`,
        });
      }
      if (
        timing.recommended_start_offset_days != null &&
        timing.recommended_due_offset_days != null &&
        timing.recommended_start_offset_days > timing.recommended_due_offset_days
      ) {
        violations.push({
          code: "start_after_target",
          entity_id: task.slug,
          message: `Start offset after target for “${task.title}”`,
        });
      }
      if (
        timing.hard_deadline_offset_days != null &&
        timing.recommended_start_offset_days != null &&
        timing.hard_deadline_offset_days < timing.recommended_start_offset_days
      ) {
        violations.push({
          code: "hard_before_start",
          entity_id: task.slug,
          message: `Hard deadline before start for “${task.title}”`,
        });
      }
    }
  }
  void titles;
  return violations;
}

export function validateScheduledTasks(
  tasks: ChecklistTask[],
  dueDate: string | null,
): TimingViolation[] {
  const violations: TimingViolation[] = [];
  if (!dueDate || !isDateOnly(dueDate)) return violations;
  for (const task of tasks) {
    if (task.date_source !== "calculated" || !task.calculated_due_date) continue;
    if (
      task.timing_type === "before_birth" &&
      task.calculated_due_date > dueDate
    ) {
      violations.push({
        code: "prebirth_after_due",
        entity_id: task.id,
        message: `Pre-birth task “${task.title}” scheduled after due date (${task.calculated_due_date} > ${dueDate})`,
      });
    }
    if (
      task.timing_type === "after_birth" &&
      task.calculated_due_date < dueDate
    ) {
      violations.push({
        code: "postbirth_before_due",
        entity_id: task.id,
        message: `Post-birth task “${task.title}” scheduled before due date`,
      });
    }
    if (
      task.calculated_start_date &&
      task.calculated_due_date &&
      task.calculated_start_date > task.calculated_due_date
    ) {
      violations.push({
        code: "start_after_target_date",
        entity_id: task.id,
        message: `Start after target for “${task.title}”`,
      });
    }
  }
  return violations;
}
