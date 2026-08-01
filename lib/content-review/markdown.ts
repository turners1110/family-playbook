import { CONTENT_REVIEW_SCHEMA_VERSION } from "@/lib/content-review/options";

type ReviewPackage = ReturnType<
  typeof import("@/lib/content-review/build-package").buildContentReviewPackage
>;

function list(items: string[] | undefined, limit = 25): string {
  if (!items?.length) return "_None flagged._";
  return items
    .slice(0, limit)
    .map((item) => `- ${item}`)
    .join("\n");
}

export const CONTENT_REVIEW_AI_PROMPT = `You are reviewing the content design of a parenting-planning application.

Your main job is to audit the available questions, discussion areas, and Before Baby checklist.

Do not focus mainly on judging the family’s answers.

Review the material for:

1. Missing discussion areas
2. Missing parenting questions
3. Duplicate or overlapping questions
4. Poorly worded questions
5. Leading or biased questions
6. Questions combining several decisions
7. Weak answer options
8. Missing follow-up questions
9. Poor sequencing
10. Weak branching logic
11. Life-stage gaps
12. Questions better suited as checklist tasks
13. Checklist items better suited as discussion questions
14. Missing pre-birth tasks
15. Bad task timing
16. Missing task dependencies
17. Weeks with too many tasks
18. Missing owners
19. Missing post-birth tasks
20. Research gaps

Return:

- Overall content score out of 100
- Question-bank score
- Discussion coverage score
- Before Baby checklist score
- Timeline quality score
- Top 20 issues
- Top 20 new questions
- Top 20 new checklist items
- Suggested category changes
- Suggested ordering changes
- Suggested branching changes
- Suggested due-date timing changes
- Items to finish before birth
- Items safe to defer until later

Be specific.

Quote question titles and task titles when referring to them.

Separate:
- source-derived observations
- your recommendations
- assumptions`;

export function buildContentReviewMarkdown(pkg: ReviewPackage): string {
  const metrics = pkg.question_bank?.metrics as Record<string, unknown> | undefined;
  const topicMap = (pkg.question_bank?.topic_map ?? []) as Array<
    Record<string, unknown>
  >;
  const timeline = pkg.before_baby?.timeline_review as
    | Record<string, unknown>
    | undefined;
  const coverage = (pkg.before_baby?.pre_birth_coverage ?? []) as Array<{
    area_label: string;
    items: Array<{
      label: string;
      has_neither: boolean;
      has_tasks: boolean;
      has_questions: boolean;
    }>;
  }>;
  const rec = pkg.recommendations_seed;
  const weakTopics = topicMap
    .filter((t) => Number(t.number_of_questions ?? 0) === 0)
    .map((t) => String(t.topic_label));
  const missingPreBirth = coverage.flatMap((g) =>
    g.items.filter((i) => i.has_neither).map((i) => `${g.area_label}: ${i.label}`),
  );

  const sections: string[] = [];
  sections.push(`# Turner Family Principles — AI Content Review Package`);
  sections.push("");
  sections.push(`Schema: \`${CONTENT_REVIEW_SCHEMA_VERSION}\``);
  sections.push(`Generated: ${pkg.generated_at}`);
  sections.push(`Family: ${pkg.family_name}`);
  sections.push(`Focus: ${pkg.focus}`);
  sections.push("");
  sections.push(`## Executive Summary`);
  sections.push("");
  sections.push(
    `This package audits **content design** (question bank, discussion coverage, and Before Baby checklist). Family answers are ${pkg.privacy.answers_included ? "optionally included as supporting metadata" : "**excluded by default**"}.`,
  );
  sections.push("");
  if (metrics) {
    sections.push(
      `- Total questions exported: **${metrics.total_questions}**`,
    );
    sections.push(`- Unanswered (status metadata): **${metrics.unanswered_count}**`);
    sections.push(
      `- Duplicate candidates: **${(metrics.duplicate_candidates as unknown[])?.length ?? 0}**`,
    );
    sections.push(
      `- Near-duplicate candidates: **${(metrics.near_duplicate_candidates as unknown[])?.length ?? 0}**`,
    );
  }
  if (pkg.before_baby) {
    sections.push(`- Checklist tasks exported: **${pkg.before_baby.tasks.length}**`);
    sections.push(
      `- Post-birth tasks: **${(timeline?.post_birth_tasks as string[] | undefined)?.length ?? 0}**`,
    );
  }
  sections.push(`- Missing pre-birth areas (no task & no question): **${missingPreBirth.length}**`);
  sections.push("");

  sections.push(`## Question Bank Overview`);
  sections.push("");
  if (!pkg.question_bank) {
    sections.push("_Questions omitted by export scope._");
  } else {
    sections.push(
      `Exported **${pkg.question_bank.questions.length}** questions (includes unanswered). Ordering and branching metadata are preserved.`,
    );
    sections.push("");
    sections.push(`### Counts by category`);
    sections.push("");
    for (const [k, v] of Object.entries(
      (metrics?.questions_by_category as Record<string, number>) ?? {},
    )) {
      sections.push(`- ${k}: ${v}`);
    }
    sections.push("");
    sections.push(`### Counts by life stage`);
    sections.push("");
    for (const [k, v] of Object.entries(
      (metrics?.questions_by_life_stage as Record<string, number>) ?? {},
    )) {
      sections.push(`- ${k}: ${v}`);
    }
  }
  sections.push("");

  sections.push(`## Topic Coverage`);
  sections.push("");
  if (!topicMap.length) {
    sections.push("_Topic map omitted by export scope._");
  } else {
    for (const t of topicMap) {
      sections.push(
        `- **${t.topic_label}**: ${t.number_of_questions} questions · unanswered ${t.unanswered_count} · checklist links ${t.linked_checklist_count}`,
      );
      const gaps = t.possible_gaps as string[] | undefined;
      if (gaps?.length) sections.push(`  - Gaps: ${gaps.join("; ")}`);
    }
  }
  sections.push("");

  sections.push(`## Missing Discussion Areas`);
  sections.push("");
  sections.push(list(weakTopics, 50));
  sections.push("");

  sections.push(`## Duplicate and Overlapping Questions`);
  sections.push("");
  const dups = (metrics?.duplicate_candidates as Array<{ a: string; b: string; score: number }> | undefined) ?? [];
  const near = (metrics?.near_duplicate_candidates as Array<{ a: string; b: string; score: number }> | undefined) ?? [];
  if (!dups.length && !near.length) sections.push("_None flagged._");
  for (const d of dups.slice(0, 20)) {
    sections.push(`- Duplicate candidate (${d.score}): “${d.a}” ↔ “${d.b}”`);
  }
  for (const d of near.slice(0, 20)) {
    sections.push(`- Near-duplicate (${d.score}): “${d.a}” ↔ “${d.b}”`);
  }
  sections.push("");

  sections.push(`## Questions Needing Rewording`);
  sections.push("");
  sections.push(
    list([
      ...((metrics?.questions_with_unclear_wording as string[]) ?? []),
      ...((metrics?.questions_with_biased_wording as string[]) ?? []),
    ]),
  );
  sections.push("");

  sections.push(`## Questions Needing Better Answer Options`);
  sections.push("");
  sections.push(
    list([
      ...((metrics?.questions_missing_answer_options as string[]) ?? []),
      ...((metrics?.questions_with_poor_option_coverage as string[]) ?? []),
    ]),
  );
  sections.push("");

  sections.push(`## Question Ordering and Branching Issues`);
  sections.push("");
  sections.push(
    list([
      ...((metrics?.questions_in_weak_sequence as string[]) ?? []),
      ...((metrics?.branching_paths_that_end_too_early as string[]) ?? []).map(
        (t) => `Early-ending branch: ${t}`,
      ),
      ...((metrics?.isolated_questions_with_no_links as string[]) ?? [])
        .slice(0, 15)
        .map((t) => `Isolated: ${t}`),
    ]),
  );
  sections.push("");

  sections.push(`## Life-Stage Coverage`);
  sections.push("");
  sections.push(
    list(
      ((metrics?.life_stages_with_weak_coverage as string[]) ?? []).map(
        (s) => `Weak coverage: ${s}`,
      ),
    ),
  );
  sections.push("");

  sections.push(`## Before Baby Checklist Overview`);
  sections.push("");
  if (!pkg.before_baby) {
    sections.push("_Checklist omitted by export scope._");
  } else {
    sections.push(`Exported **${pkg.before_baby.tasks.length}** tasks.`);
    sections.push("");
    sections.push(`- Due this week: ${(timeline?.tasks_due_this_week as string[] | undefined)?.length ?? 0}`);
    sections.push(`- Final week: ${(timeline?.final_week_tasks as string[] | undefined)?.length ?? 0}`);
    sections.push(`- Overdue: ${(timeline?.overdue_tasks as string[] | undefined)?.length ?? 0}`);
    sections.push(`- Without dates: ${(timeline?.tasks_without_dates as string[] | undefined)?.length ?? 0}`);
  }
  sections.push("");

  sections.push(`## Missing Pre-Birth Tasks`);
  sections.push("");
  sections.push(list(missingPreBirth, 40));
  sections.push("");

  sections.push(`## Timeline and Scheduling Problems`);
  sections.push("");
  sections.push(
    list([
      ...((timeline?.tasks_with_unrealistic_timing as string[]) ?? []).map(
        (t) => `Unrealistic timing: ${t}`,
      ),
      ...(((timeline?.weeks_with_too_many_tasks as Array<{ period: string; count: number }>) ?? []).map(
        (w) => `Overloaded period ${w.period}: ${w.count} tasks`,
      )),
    ]),
  );
  sections.push("");

  sections.push(`## Tasks Due Too Early or Too Late`);
  sections.push("");
  sections.push(
    list([
      ...((timeline?.tasks_that_should_happen_earlier as string[]) ?? []).map(
        (t) => `Earlier: ${t}`,
      ),
      ...((timeline?.tasks_that_should_happen_later as string[]) ?? []).map(
        (t) => `Later: ${t}`,
      ),
    ]),
  );
  sections.push("");

  sections.push(`## Missing Dependencies and Owners`);
  sections.push("");
  sections.push(
    list([
      ...((timeline?.missing_owners as string[]) ?? []).map((t) => `Missing owner: ${t}`),
      ...((timeline?.missing_dependencies as string[]) ?? [])
        .slice(0, 15)
        .map((t) => `Check dependencies: ${t}`),
    ]),
  );
  sections.push("");

  sections.push(`## Questions That Should Become Tasks`);
  sections.push("");
  sections.push(
    list(
      (metrics?.practical_questions_that_should_be_checklist_tasks as string[]) ??
        [],
    ),
  );
  sections.push("");

  sections.push(`## Tasks That Should Become Questions`);
  sections.push("");
  sections.push(
    list(
      (timeline?.tasks_that_should_become_discussion_questions as string[]) ?? [],
    ),
  );
  sections.push("");

  sections.push(`## Top 20 Content Improvements`);
  sections.push("");
  sections.push(list(rec.top_content_improvements, 20));
  sections.push("");

  sections.push(`## Top 10 Additions Before Birth`);
  sections.push("");
  sections.push(list(rec.top_additions_before_birth, 10));
  sections.push("");

  sections.push(`## Suggested Question Categories`);
  sections.push("");
  sections.push(list(rec.suggested_question_categories, 30));
  sections.push("");

  sections.push(`## Suggested New Questions`);
  sections.push("");
  sections.push(list(rec.suggested_new_questions, 30));
  sections.push("");

  sections.push(`## Suggested New Checklist Items`);
  sections.push("");
  sections.push(list(rec.suggested_new_checklist_items, 30));
  sections.push("");

  sections.push(`## Suggested Timeline Changes`);
  sections.push("");
  sections.push(list(rec.suggested_timeline_changes, 30));
  sections.push("");

  sections.push(`---`);
  sections.push("");
  sections.push(`## Paste everything below into ChatGPT or Claude`);
  sections.push("");
  sections.push("```");
  sections.push(CONTENT_REVIEW_AI_PROMPT);
  sections.push("```");
  sections.push("");
  sections.push(
    `Then attach or paste \`turner-family-content-review.json\` (and this Markdown if helpful).`,
  );
  sections.push("");

  return `${sections.join("\n")}\n`;
}
