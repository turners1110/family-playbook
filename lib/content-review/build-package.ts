import type { AppStore, ChecklistTask, Question, QuestionOption } from "@/lib/types/models";
import {
  CONTENT_REVIEW_SCHEMA_VERSION,
  type ContentReviewOptions,
} from "@/lib/content-review/options";
import { validateContentReviewPackage } from "@/lib/content-review/schema";
import {
  DISCUSSION_TOPICS,
  classifyTopics,
} from "@/lib/content-review/topics";
import {
  biasedWording,
  combinesSeveralDecisions,
  jaccardSimilarity,
  looksTooBroad,
  looksTooNarrow,
  philosophicalNotPractical,
  practicalShouldBeTask,
  unclearWording,
} from "@/lib/content-review/text-heuristics";
import {
  PRE_BIRTH_COVERAGE_AREAS,
  textMatchesKeywords,
} from "@/lib/content-review/pre-birth-coverage";
import {
  getQuestionAnswerStatus,
  isTestQuestion,
} from "@/lib/services/question-status";
import {
  addDays,
  computePregnancyProgress,
  diffDays,
  todayDateOnly,
} from "@/lib/checklists/date-math";
import { BEFORE_BABY_TASK_TIMING } from "@/lib/checklists/default-timing";
import { BEFORE_BABY_TEMPLATE } from "@/lib/checklists/templates/before-baby";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function questionHaystack(q: Question): string {
  return [
    q.short_title,
    q.text,
    q.why_it_matters,
    ...q.categories,
    ...q.subcategories,
    ...q.outcomes,
  ].join(" ");
}

function optionsForQuestion(
  store: AppStore,
  questionId: string,
): QuestionOption[] {
  return store.question_options
    .filter((o) => o.question_id === questionId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

function childQuestions(store: AppStore, parentId: string): Question[] {
  return store.questions
    .filter(
      (q) =>
        q.parent_decision_dependency === parentId ||
        q.related_questions.includes(parentId),
    )
    .sort((a, b) => a.logical_order - b.logical_order);
}

function selectQuestions(store: AppStore, options: ContentReviewOptions): Question[] {
  return store.questions
    .filter((q) => {
      if (!options.includeArchivedQuestions && !q.active) return false;
      if (!options.includeTestData && isTestQuestion(q)) return false;
      return true;
    })
    .sort((a, b) => a.logical_order - b.logical_order || a.id.localeCompare(b.id));
}

function exportQuestion(
  store: AppStore,
  q: Question,
  options: ContentReviewOptions,
  researchCounts: Map<string, number>,
) {
  const opts = optionsForQuestion(store, q.id);
  const status = getQuestionAnswerStatus(q.id, store);
  const children = childQuestions(store, q.id);
  const related = q.related_questions
    .map((id) => store.questions.find((x) => x.id === id))
    .filter(Boolean)
    .map((x) => ({ id: x!.id, slug: x!.slug, title: x!.short_title }));

  const parent = q.parent_decision_dependency
    ? store.questions.find((x) => x.id === q.parent_decision_dependency)
    : null;

  const mode = String(q.response_schema?.mode ?? q.question_type);
  const allowMultiple =
    q.question_type === "multiple_choice" || q.question_type === "ranking";
  const openTextAllowed =
    q.question_type === "open_response" ||
    mode.includes("open") ||
    opts.length === 0;

  return {
    id: q.id,
    slug: q.slug,
    title: q.short_title,
    full_question_text: q.text,
    helper_text: q.why_it_matters,
    discussion_guidance: q.discussion_guidance,
    category: q.categories[0] ?? null,
    categories: q.categories,
    subcategory: q.subcategories[0] ?? null,
    subcategories: q.subcategories,
    ...(() => {
      const classified = classifyTopics(questionHaystack(q));
      return {
        topic: [
          ...(classified.primary_topic ? [classified.primary_topic] : []),
          ...classified.secondary_topics,
        ],
        primary_topic: classified.primary_topic,
        secondary_topics: classified.secondary_topics,
      };
    })(),
    life_stage: q.life_stages.map((s) => LIFE_STAGE_LABELS[s] ?? s),
    life_stages: q.life_stages,
    age_range: q.life_stages,
    importance: q.priority,
    priority: q.priority,
    question_type: q.question_type,
    response_type: mode,
    answer_options: opts.map((o) => ({
      id: o.id,
      value: o.value,
      label: o.label,
      sort_order: o.sort_order,
    })),
    allow_multiple_selections: allowMultiple,
    open_text_allowed: openTextAllowed,
    confidence_requested: true,
    evidence_requested: q.evidence_needed,
    cooling_off_required: q.cooling_off_recommended,
    review_later_option: Boolean(q.review_recommendation),
    linked_questions: related,
    parent_question: parent
      ? { id: parent.id, slug: parent.slug, title: parent.short_title }
      : null,
    child_or_follow_up_questions: children.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.short_title,
    })),
    branching_rules: {
      parent_decision_dependency: q.parent_decision_dependency,
      related_question_ids: q.related_questions,
      follow_up_prompts: q.follow_up_prompts,
    },
    prerequisite_questions: q.parent_decision_dependency
      ? [q.parent_decision_dependency]
      : [],
    tags: [...q.categories, ...q.subcategories, ...q.outcomes],
    research_links: options.includeResearchMetadata
      ? { count: researchCounts.get(q.id) ?? 0 }
      : { count: researchCounts.get(q.id) ?? 0, detail_omitted: true },
    checklist_links: [],
    principle_links: q.related_principles,
    display_order: q.logical_order,
    source_or_template: "seed_question_bank",
    active_or_archived_status: q.active ? "active" : "archived",
    answer_status: status.primary,
    answer_status_label: status.label,
    flags: {
      too_broad: looksTooBroad(q.text),
      too_narrow: looksTooNarrow(q.text),
      combines_several_decisions: combinesSeveralDecisions(q.text),
      unclear_wording: unclearWording(q.text),
      biased_wording: biasedWording(q.text),
      philosophical_should_be_practical: philosophicalNotPractical(
        q.text,
        q.question_type,
      ),
      practical_should_be_checklist_task: practicalShouldBeTask(
        q.text,
        q.question_type,
      ),
      missing_answer_options:
        ["single_choice", "multiple_choice", "yes_or_no", "ranking"].includes(
          q.question_type,
        ) && opts.length === 0,
      no_follow_up: children.length === 0 && q.follow_up_prompts.length === 0,
      no_research:
        q.research_mode === "no_research_needed"
          ? false
          : (researchCounts.get(q.id) ?? 0) === 0 && !q.evidence_available,
      no_linked_principle: q.related_principles.length === 0,
      isolated: q.related_questions.length === 0 && !q.parent_decision_dependency,
    },
  };
}

function buildQuestionMetrics(
  exported: ReturnType<typeof exportQuestion>[],
  allSelected: Question[],
) {
  const byCategory = countBy(allSelected, (q) => q.categories[0] ?? "uncategorized");
  const byLifeStage = countBy(
    allSelected.flatMap((q) => q.life_stages.map((s) => ({ s }))),
    (x) => x.s,
  );
  const byImportance = countBy(allSelected, (q) => q.priority);
  const byResponseType = countBy(allSelected, (q) => q.question_type);

  const duplicateCandidates: Array<{ a: string; b: string; score: number }> = [];
  const nearDuplicates: Array<{ a: string; b: string; score: number }> = [];
  for (let i = 0; i < allSelected.length; i += 1) {
    for (let j = i + 1; j < allSelected.length; j += 1) {
      const a = allSelected[i];
      const b = allSelected[j];
      const score = Math.max(
        jaccardSimilarity(a.short_title, b.short_title),
        jaccardSimilarity(a.text, b.text),
      );
      if (score >= 0.85) {
        duplicateCandidates.push({
          a: a.short_title,
          b: b.short_title,
          score: Number(score.toFixed(3)),
        });
      } else if (score >= 0.62) {
        nearDuplicates.push({
          a: a.short_title,
          b: b.short_title,
          score: Number(score.toFixed(3)),
        });
      }
    }
  }
  duplicateCandidates.sort((x, y) => y.score - x.score);
  nearDuplicates.sort((x, y) => y.score - x.score);

  const categoryCounts = Object.entries(byCategory);
  const avg =
    categoryCounts.reduce((n, [, c]) => n + c, 0) /
    Math.max(categoryCounts.length, 1);
  const tooFew = categoryCounts
    .filter(([, c]) => c < Math.max(2, avg * 0.35))
    .map(([k]) => k)
    .sort();
  const tooMany = categoryCounts
    .filter(([, c]) => c > avg * 2.5 && c >= 12)
    .map(([k]) => k)
    .sort();

  const lifeStageCoverage = Object.fromEntries(
    Object.entries(byLifeStage).map(([stage, count]) => [
      stage,
      {
        count,
        weak: count < 5 && stage !== "all_stages",
      },
    ]),
  );

  return {
    total_questions: exported.length,
    questions_by_category: byCategory,
    questions_by_life_stage: byLifeStage,
    questions_by_age_range: byLifeStage,
    questions_by_importance: byImportance,
    questions_by_response_type: byResponseType,
    unanswered_count: exported.filter((q) => q.answer_status === "unanswered")
      .length,
    duplicate_candidates: duplicateCandidates.slice(0, 40),
    near_duplicate_candidates: nearDuplicates.slice(0, 60),
    questions_with_overlapping_intent: nearDuplicates.slice(0, 40),
    categories_with_too_few_questions: tooFew,
    categories_with_too_many_questions: tooMany,
    life_stages_with_weak_coverage: Object.entries(lifeStageCoverage)
      .filter(([, v]) => (v as { weak: boolean }).weak)
      .map(([k]) => k)
      .sort(),
    questions_with_no_follow_up: exported
      .filter((q) => q.flags.no_follow_up)
      .map((q) => q.title)
      .slice(0, 80),
    questions_with_no_research: exported
      .filter((q) => q.flags.no_research)
      .map((q) => q.title)
      .slice(0, 80),
    questions_with_no_linked_principle: exported
      .filter((q) => q.flags.no_linked_principle)
      .map((q) => q.title)
      .slice(0, 80),
    questions_that_appear_too_broad: exported
      .filter((q) => q.flags.too_broad)
      .map((q) => q.title),
    questions_that_appear_too_narrow: exported
      .filter((q) => q.flags.too_narrow)
      .map((q) => q.title),
    questions_that_combine_several_decisions: exported
      .filter((q) => q.flags.combines_several_decisions)
      .map((q) => q.title),
    questions_with_unclear_wording: exported
      .filter((q) => q.flags.unclear_wording)
      .map((q) => q.title),
    questions_with_biased_wording: exported
      .filter((q) => q.flags.biased_wording)
      .map((q) => q.title),
    questions_missing_answer_options: exported
      .filter((q) => q.flags.missing_answer_options)
      .map((q) => q.title),
    questions_with_poor_option_coverage: exported
      .filter(
        (q) =>
          q.answer_options.length > 0 &&
          q.answer_options.length < 2 &&
          q.question_type !== "yes_or_no",
      )
      .map((q) => q.title),
    questions_in_weak_sequence: exported
      .filter((q, i, arr) => {
        if (i === 0) return false;
        return q.display_order < arr[i - 1].display_order;
      })
      .map((q) => q.title),
    isolated_questions_with_no_links: exported
      .filter((q) => q.flags.isolated)
      .map((q) => q.title)
      .slice(0, 80),
    branching_paths_that_end_too_early: exported
      .filter(
        (q) =>
          q.priority === "essential_before_birth" &&
          q.child_or_follow_up_questions.length === 0,
      )
      .map((q) => q.title)
      .slice(0, 40),
    questions_asked_too_early_or_too_late: exported
      .filter(
        (q) =>
          (q.priority === "essential_before_birth" &&
            !q.life_stages.includes("pre_birth_planning") &&
            !q.life_stages.includes("pregnancy")) ||
          (q.life_stages.includes("teen") &&
            q.priority === "essential_before_birth"),
      )
      .map((q) => q.title),
    philosophical_questions_that_should_be_practical: exported
      .filter((q) => q.flags.philosophical_should_be_practical)
      .map((q) => q.title),
    practical_questions_that_should_be_checklist_tasks: exported
      .filter((q) => q.flags.practical_should_be_checklist_task)
      .map((q) => q.title)
      .slice(0, 60),
    life_stage_coverage: lifeStageCoverage,
  };
}

function buildTopicMap(
  exported: ReturnType<typeof exportQuestion>[],
  tasks: ChecklistTask[],
) {
  return DISCUSSION_TOPICS.map((topic) => {
    const questions = exported.filter((q) => q.topic.includes(topic.key));
    const taskHits = tasks.filter((t) =>
      textMatchesKeywords(`${t.title} ${t.category_label}`, topic.keywords),
    );
    const lifeStages = Array.from(
      new Set(questions.flatMap((q) => q.life_stages)),
    ).sort();
    const importances = questions.map((q) => q.importance);
    const unanswered = questions.filter((q) => q.answer_status === "unanswered")
      .length;
    const gaps: string[] = [];
    if (questions.length === 0) gaps.push("No questions matched this topic");
    if (questions.length > 0 && questions.length < 2) {
      gaps.push("Very few questions");
    }
    if (lifeStages.length <= 1 && questions.length > 0) {
      gaps.push("Narrow life-stage coverage");
    }
    if (taskHits.length === 0 && topic.key.includes("birth")) {
      gaps.push("No checklist tasks matched");
    }
    return {
      topic_key: topic.key,
      topic_label: topic.label,
      number_of_questions: questions.length,
      life_stages_covered: lifeStages,
      importance_range: importances.length
        ? {
            values: Array.from(new Set(importances)).sort(),
          }
        : null,
      linked_research_count: questions.reduce(
        (n, q) => n + Number((q.research_links as { count?: number }).count ?? 0),
        0,
      ),
      linked_checklist_count: taskHits.length,
      unanswered_count: unanswered,
      possible_gaps: gaps,
      sample_question_titles: questions.slice(0, 8).map((q) => q.title),
    };
  });
}

function selectTasks(store: AppStore, options: ContentReviewOptions): ChecklistTask[] {
  const instance = store.checklist_instances.find(
    (c) => c.template_slug === "before-baby",
  );
  const tasks = store.checklist_tasks
    .filter((t) => {
      if (instance && t.checklist_id !== instance.id) {
        // Keep orphan custom tasks only if no instance filter applies
        if (!instance) return true;
        return false;
      }
      if (!instance && store.checklist_instances.length > 0) {
        // Prefer before-baby instance only
        return false;
      }
      if (t.archived) return false;
      if (!options.includeCustomTasks && t.is_custom) return false;
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  if (tasks.length > 0) return tasks;

  // Synthesize default template tasks so content review works before checklist generation.
  const synthesized: ChecklistTask[] = [];
  let order = 0;
  for (const section of BEFORE_BABY_TEMPLATE.sections) {
    for (const task of section.tasks) {
      const timing = BEFORE_BABY_TASK_TIMING[task.slug];
      order += 1;
      const due =
        store.settings.expected_due_date &&
        timing?.recommended_due_offset_days != null
          ? addDays(
              store.settings.expected_due_date,
              timing.recommended_due_offset_days,
            )
          : null;
      const start =
        store.settings.expected_due_date &&
        timing?.recommended_start_offset_days != null
          ? addDays(
              store.settings.expected_due_date,
              timing.recommended_start_offset_days,
            )
          : null;
      synthesized.push({
        id: `template:${task.slug}`,
        checklist_id: "template:before-baby",
        template_task_slug: task.slug,
        title: task.title,
        category: section.slug,
        category_label: section.label,
        completed: false,
        completed_at: null,
        due_date: due,
        priority: (task.priority as ChecklistTask["priority"]) ?? "medium",
        owner: (task.owner as ChecklistTask["owner"]) ?? "both",
        notes: null,
        is_custom: false,
        is_default: true,
        archived: false,
        sort_order: order,
        created_at: "1970-01-01T00:00:00.000Z",
        updated_at: "1970-01-01T00:00:00.000Z",
        recommended_start_offset_days: timing?.recommended_start_offset_days ?? null,
        recommended_due_offset_days: timing?.recommended_due_offset_days ?? null,
        hard_deadline_offset_days: timing?.hard_deadline_offset_days ?? null,
        timing_reason: timing?.timing_reason ?? null,
        timing_flexibility: timing?.timing_flexibility,
        timing_type: timing?.timing_type,
        manual_due_date: null,
        calculated_due_date: due,
        calculated_start_date: start,
        date_source: due ? "calculated" : "none",
      });
    }
  }
  return synthesized;
}

function exportTask(task: ChecklistTask, dueDate: string | null) {
  const timing =
    (task.template_task_slug &&
      BEFORE_BABY_TASK_TIMING[task.template_task_slug]) ||
    null;
  const daysBeforeDue =
    dueDate && task.due_date ? diffDays(task.due_date, dueDate) : null;
  let pregnancyWeek: number | null = null;
  let trimester: 1 | 2 | 3 | null = null;
  if (dueDate && task.due_date) {
    const progress = computePregnancyProgress(dueDate, task.due_date);
    pregnancyWeek = progress.pregnancy_week;
    trimester = progress.trimester;
  }
  return {
    id: task.id,
    title: task.title,
    description: task.notes,
    category: task.category,
    category_label: task.category_label,
    owner: task.owner,
    priority: task.priority,
    status: task.completed ? "completed" : "open",
    default_or_custom: task.is_custom ? "custom" : "default",
    due_date: task.due_date,
    manually_assigned_date: task.manual_due_date ?? null,
    recommended_start_date: task.calculated_start_date ?? null,
    recommended_completion_date: task.calculated_due_date ?? task.due_date,
    days_before_due_date: daysBeforeDue,
    pregnancy_week: pregnancyWeek,
    trimester,
    post_birth_task: task.timing_type === "after_birth",
    hard_deadline: task.hard_deadline_offset_days != null,
    flexible_timing: task.timing_flexibility ?? timing?.timing_flexibility ?? null,
    scheduling_reason: task.timing_reason ?? timing?.timing_reason ?? null,
    provider_confirmation_needed: Boolean(timing?.confirm_with_provider),
    dependencies: [],
    linked_questions: [],
    linked_research: [],
    notes: task.notes,
    display_order: task.sort_order,
    recurring_status: "not_recurring",
    timing_type: task.timing_type ?? timing?.timing_type ?? null,
    date_source: task.date_source ?? null,
    recommended_start_offset_days: task.recommended_start_offset_days ?? null,
    recommended_due_offset_days: task.recommended_due_offset_days ?? null,
    hard_deadline_offset_days: task.hard_deadline_offset_days ?? null,
  };
}

function buildTimelineReview(
  tasks: ReturnType<typeof exportTask>[],
  dueDate: string | null,
  now: Date,
) {
  const today = todayDateOnly(now);
  const inWeek = addDays(today, 7);
  const inTwoWeeks = addDays(today, 14);
  const inMonth = addDays(today, 30);
  const withDue = tasks.filter((t) => t.due_date);

  const finalMonth = dueDate
    ? withDue.filter((t) => {
        const d = t.due_date!;
        return d >= addDays(dueDate, -30) && d <= dueDate;
      })
    : [];
  const finalWeek = dueDate
    ? withDue.filter((t) => {
        const d = t.due_date!;
        return d >= addDays(dueDate, -7) && d <= dueDate;
      })
    : [];

  const byWeek: Record<string, number> = {};
  for (const t of withDue) {
    // group by ISO week start
    const key = t.due_date!.slice(0, 7);
    byWeek[key] = (byWeek[key] ?? 0) + 1;
  }
  const overloadedWeeks = Object.entries(byWeek)
    .filter(([, n]) => n >= 8)
    .map(([k, n]) => ({ period: k, count: n }));

  const titles = tasks.map((t) => t.title.toLowerCase());
  const duplicateTasks = tasks
    .filter((t, i) => titles.indexOf(t.title.toLowerCase()) !== i)
    .map((t) => t.title);

  return {
    tasks_due_now: withDue.filter((t) => t.due_date === today).map((t) => t.title),
    tasks_due_this_week: withDue
      .filter((t) => t.due_date! >= today && t.due_date! <= inWeek)
      .map((t) => t.title),
    tasks_due_in_two_weeks: withDue
      .filter((t) => t.due_date! > inWeek && t.due_date! <= inTwoWeeks)
      .map((t) => t.title),
    tasks_due_this_month: withDue
      .filter((t) => t.due_date! >= today && t.due_date! <= inMonth)
      .map((t) => t.title),
    final_month_tasks: finalMonth.map((t) => t.title),
    final_week_tasks: finalWeek.map((t) => t.title),
    post_birth_tasks: tasks.filter((t) => t.post_birth_task).map((t) => t.title),
    overdue_tasks: withDue
      .filter((t) => t.due_date! < today && t.status !== "completed")
      .map((t) => t.title),
    unassigned_tasks: tasks.filter((t) => !t.owner).map((t) => t.title),
    tasks_without_dates: tasks.filter((t) => !t.due_date).map((t) => t.title),
    tasks_with_unrealistic_timing: tasks
      .filter(
        (t) =>
          t.days_before_due_date != null &&
          (t.days_before_due_date > 280 || t.days_before_due_date < -60),
      )
      .map((t) => t.title),
    tasks_grouped_too_closely: overloadedWeeks,
    weeks_with_too_many_tasks: overloadedWeeks,
    missing_dependencies: tasks
      .filter((t) => /registration|car seat inspect|first pediatric/i.test(t.title))
      .map((t) => t.title),
    missing_owners: tasks.filter((t) => !t.owner).map((t) => t.title),
    duplicate_tasks: Array.from(new Set(duplicateTasks)),
    tasks_that_should_happen_earlier: tasks
      .filter(
        (t) =>
          /will|guardian|life insurance|pediatrician|car seat/i.test(t.title) &&
          (t.days_before_due_date == null || t.days_before_due_date > -30),
      )
      .map((t) => t.title),
    tasks_that_should_happen_later: tasks
      .filter(
        (t) =>
          /solid food|preschool|college/i.test(t.title) && !t.post_birth_task,
      )
      .map((t) => t.title),
    tasks_that_require_provider_confirmation: tasks
      .filter((t) => t.provider_confirmation_needed)
      .map((t) => t.title),
    tasks_that_should_recur: tasks
      .filter((t) => /stock|laundry|meal/i.test(t.title))
      .map((t) => t.title)
      .slice(0, 20),
    tasks_that_belong_after_birth: tasks
      .filter((t) => t.post_birth_task)
      .map((t) => t.title),
    decisions_that_should_become_tasks: [] as string[],
    tasks_that_should_become_discussion_questions: tasks
      .filter((t) =>
        /birth plan|visitor|circumcision|cord blood|overnight|feeding role/i.test(
          t.title,
        ),
      )
      .map((t) => t.title),
  };
}

function buildPreBirthCoverage(
  questions: ReturnType<typeof exportQuestion>[],
  tasks: ReturnType<typeof exportTask>[],
) {
  return PRE_BIRTH_COVERAGE_AREAS.map((group) => ({
    area_key: group.key,
    area_label: group.label,
    items: group.items.map((item) => {
      const qHits = questions.filter((q) =>
        textMatchesKeywords(
          `${q.title} ${q.full_question_text} ${q.tags.join(" ")}`,
          item.keywords,
        ),
      );
      const tHits = tasks.filter((t) =>
        textMatchesKeywords(`${t.title} ${t.category_label}`, item.keywords),
      );
      const hasQuestions = qHits.length > 0;
      const hasTasks = tHits.length > 0;
      return {
        key: item.key,
        label: item.label,
        has_tasks: hasTasks,
        has_questions: hasQuestions,
        has_neither: !hasTasks && !hasQuestions,
        task_titles: tHits.map((t) => t.title),
        question_titles: qHits.map((q) => q.title),
      };
    }),
  }));
}

function buildRecommendations(
  questionMetrics: {
    duplicate_candidates: Array<{ a: string; b: string; score: number }>;
    questions_with_biased_wording: string[];
    questions_missing_answer_options: string[];
    categories_with_too_few_questions: string[];
    practical_questions_that_should_be_checklist_tasks: string[];
  },
  timeline: {
    tasks_that_should_happen_earlier: string[];
    weeks_with_too_many_tasks: Array<{ period: string; count: number }>;
  },
  coverage: ReturnType<typeof buildPreBirthCoverage>,
) {
  const missingAreas = coverage
    .flatMap((g) => g.items.filter((i) => i.has_neither).map((i) => i.label))
    .slice(0, 20);

  const topImprovements = [
    ...questionMetrics.duplicate_candidates
      .slice(0, 5)
      .map((d) => `Resolve duplicate/near-duplicate: “${d.a}” vs “${d.b}”`),
    ...questionMetrics.questions_with_biased_wording
      .slice(0, 3)
      .map((t) => `Reword potentially biased question: “${t}”`),
    ...questionMetrics.questions_missing_answer_options
      .slice(0, 5)
      .map((t) => `Add answer options for: “${t}”`),
    ...missingAreas
      .slice(0, 5)
      .map((a) => `Add coverage for pre-birth area: ${a}`),
  ].slice(0, 20);

  return {
    top_content_improvements: topImprovements,
    top_additions_before_birth: missingAreas.slice(0, 10),
    suggested_question_categories: questionMetrics.categories_with_too_few_questions,
    suggested_new_questions: missingAreas.map(
      (a) => `Discuss and decide: ${a}`,
    ),
    suggested_new_checklist_items: missingAreas.map((a) => `Complete: ${a}`),
    suggested_timeline_changes: [
      ...timeline.tasks_that_should_happen_earlier
        .slice(0, 5)
        .map((t) => `Move earlier: “${t}”`),
      ...timeline.weeks_with_too_many_tasks
        .slice(0, 5)
        .map((w) => `Spread load in ${w.period} (${w.count} tasks)`),
    ],
  };
}

export type BuildContentReviewInput = {
  store: AppStore;
  options: ContentReviewOptions;
  now?: Date;
  researchCounts?: Map<string, number>;
};

export function buildContentReviewPackage(input: BuildContentReviewInput) {
  const now = input.now ?? new Date();
  const options = input.options;
  const store = input.store;
  const researchCounts = input.researchCounts ?? new Map<string, number>();
  const dueDate = store.settings.expected_due_date ?? null;

  const includeQuestions =
    options.scope === "full" || options.scope === "questions_only";
  const includeChecklist =
    options.scope === "full" || options.scope === "before_baby_only";

  const selectedQuestions = includeQuestions
    ? selectQuestions(store, options)
    : [];
  const exportedQuestions = selectedQuestions.map((q) =>
    exportQuestion(store, q, options, researchCounts),
  );
  const questionMetrics = includeQuestions
    ? buildQuestionMetrics(exportedQuestions, selectedQuestions)
    : null;

  const selectedTasks = includeChecklist ? selectTasks(store, options) : [];
  const exportedTasks = selectedTasks.map((t) => exportTask(t, dueDate));
  const timeline = includeChecklist
    ? buildTimelineReview(exportedTasks, dueDate, now)
    : null;
  const coverage = includeChecklist
    ? buildPreBirthCoverage(exportedQuestions, exportedTasks)
    : null;
  const topicMap = includeQuestions
    ? buildTopicMap(exportedQuestions, selectedTasks)
    : [];

  // Cross-fill decisions↔tasks suggestions when both present
  if (questionMetrics && timeline) {
    timeline.decisions_that_should_become_tasks =
      questionMetrics.practical_questions_that_should_be_checklist_tasks.slice(
        0,
        40,
      );
  }

  let familyAnswers: {
    mode: "excluded" | "statuses_only" | "full";
    items: Record<string, unknown>[];
    signals: Record<string, unknown>;
  } | null = null;

  if (options.includeAnswers && includeQuestions) {
    const mode = options.answerDetail === "full" ? "full" : "statuses_only";
    const items = exportedQuestions.map((q) => {
      const base: Record<string, unknown> = {
        question_id: q.id,
        title: q.title,
        answer_status: q.answer_status,
        answer_status_label: q.answer_status_label,
      };
      if (mode === "full") {
        const answers = store.answers.filter((a) => a.question_id === q.id);
        base.answers = answers.map((a) => ({
          member_id: a.member_id,
          is_shared: a.is_shared,
          status: a.status,
          confidence: a.confidence,
          payload: options.includeFreeTextAnswers
            ? a.payload
            : {
                choice: a.payload.choice ?? null,
                scale: a.payload.scale ?? null,
                ranking: a.payload.ranking ?? null,
                text_redacted: Boolean(a.payload.text),
                notes_redacted: Boolean(a.payload.notes),
              },
        }));
      }
      return base;
    });
    familyAnswers = {
      mode,
      items,
      signals: {
        unanswered_areas: exportedQuestions
          .filter((q) => q.answer_status === "unanswered")
          .map((q) => q.title)
          .slice(0, 100),
        needs_follow_up: exportedQuestions
          .filter((q) =>
            ["undecided", "needs_review", "cooling_off"].includes(q.answer_status),
          )
          .map((q) => q.title),
        contradictions_note:
          "Contradiction detection is limited; review shared vs individual statuses manually.",
      },
    };
  }

  const recommendations = buildRecommendations(
    questionMetrics ?? {
      duplicate_candidates: [],
      questions_with_biased_wording: [],
      questions_missing_answer_options: [],
      categories_with_too_few_questions: [],
      practical_questions_that_should_be_checklist_tasks: [],
    },
    timeline ?? {
      tasks_that_should_happen_earlier: [],
      weeks_with_too_many_tasks: [],
    },
    coverage ?? [],
  );

  const pkg = {
    schema_version: CONTENT_REVIEW_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    family_name: store.family.name,
    purpose: "ai_content_review" as const,
    focus: "content_design_not_answer_scoring" as const,
    options,
    question_bank: includeQuestions
      ? {
          questions: exportedQuestions,
          metrics: questionMetrics,
          topic_map: topicMap,
        }
      : null,
    before_baby: includeChecklist
      ? {
          tasks: exportedTasks,
          timeline_review: timeline,
          pre_birth_coverage: coverage,
        }
      : null,
    family_answers: familyAnswers,
    recommendations_seed: recommendations,
    privacy: {
      secrets_excluded: true as const,
      book_text_excluded: true as const,
      answers_included: Boolean(options.includeAnswers),
      free_text_answers_included: Boolean(
        options.includeAnswers && options.includeFreeTextAnswers,
      ),
    },
    ...(options.includeTechnicalHealthData
      ? {
          technical_health: {
            question_count_in_store: store.questions.length,
            answer_count_in_store: store.answers.length,
            checklist_task_count_in_store: store.checklist_tasks.length,
            expected_due_date: dueDate,
          },
        }
      : {}),
  };

  // Strip technical_health from schema validation by validating core fields
  const { technical_health: _th, ...core } = pkg as typeof pkg & {
    technical_health?: unknown;
  };
  void _th;
  validateContentReviewPackage(core);
  return pkg;
}
