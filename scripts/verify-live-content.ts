/**
 * Dry-run inspection of the family store. Never mutates. Never prints answers/notes/secrets.
 *
 *   pnpm verify:live-content
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { readStore } from "@/lib/db/store";
import { ensureTaskTimingFields } from "@/lib/checklists/scheduling";
import {
  applyDependencyState,
  validateDependencies,
} from "@/lib/checklists/dependencies";
import { BEFORE_BABY_MILESTONES } from "@/lib/checklists/milestones";
import {
  GENERIC_GUIDANCE_MARKERS,
  GENERIC_WHY_MARKERS,
} from "@/lib/content/helper-templates";
import { selectEssentialPrimaryQuestions } from "@/lib/content/before-birth-essentials";
import { buildPrimaryStageReport } from "@/lib/content/primary-stages";

async function main() {
  const store = await readStore();
  const questions = store.questions.filter((q) => q.active !== false);
  const tasks = applyDependencyState(
    store.checklist_tasks
      .filter((t) => !t.archived)
      .map((t) => ensureTaskTimingFields(t)),
  );
  const due = store.settings.expected_due_date ?? null;

  const truncated = questions.filter(
    (q) => q.short_title.includes("…") || q.short_title.includes("..."),
  ).length;
  const essentials = selectEssentialPrimaryQuestions(questions).length;
  const manualDates = tasks.filter(
    (t) => t.date_source === "manual" || Boolean(t.manual_due_date),
  ).length;
  const completed = tasks.filter((t) => t.completed).length;
  const preBirthAfterDue = due
    ? tasks.filter(
        (t) =>
          t.timing_type === "before_birth" &&
          t.due_date &&
          t.due_date > due,
      ).length
    : 0;
  const postBirthBeforeDue = due
    ? tasks.filter(
        (t) =>
          t.timing_type === "after_birth" &&
          t.due_date &&
          t.due_date < due &&
          !store.settings.actual_birth_date,
      ).length
    : 0;
  const ownedBoth = tasks.filter((t) => t.owner === "both").length;
  const missingOwner = tasks.filter(
    (t) =>
      !t.ownership_source ||
      t.ownership_source === "default" ||
      t.ownership_source === "decide_later",
  ).length;
  const depIssues = validateDependencies(tasks);
  const milestoneCoverage = BEFORE_BABY_MILESTONES.map((m) => {
    const present = m.step_slugs.filter((slug) =>
      tasks.some((t) => t.template_task_slug === slug),
    ).length;
    return { id: m.id, present, total: m.step_slugs.length };
  });
  const stageReport = buildPrimaryStageReport(questions);
  const universalHelper = questions.filter(
    (q) =>
      GENERIC_WHY_MARKERS.some((m) => q.why_it_matters.includes(m)) ||
      GENERIC_GUIDANCE_MARKERS.some((m) => q.discussion_guidance.includes(m)),
  ).length;

  const report = {
    store_family: store.family.name,
    question_count: questions.length,
    truncated_titles: truncated,
    essentials_primary_count: essentials,
    manual_dates: manualDates,
    completed_tasks: completed,
    pre_birth_after_due: preBirthAfterDue,
    post_birth_before_due_estimate: postBirthBeforeDue,
    tasks_owned_both: ownedBoth,
    tasks_missing_owner_decision: missingOwner,
    dependency_issues: depIssues.length,
    dependency_issue_codes: [...new Set(depIssues.map((i) => i.code))],
    milestone_coverage: milestoneCoverage,
    missing_primary_stages: stageReport.missing_primary.length,
    low_confidence_stages: stageReport.low_confidence.length,
    teen_in_pregnancy_queue: stageReport.teen_in_pregnancy_queue.length,
    repeated_universal_helper_count: universalHelper,
    expected_due_date_set: Boolean(due),
    actual_birth_date_set: Boolean(store.settings.actual_birth_date),
    checklist_task_count: tasks.length,
    demo_mode: store.demo_mode,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
