import { describe, expect, it } from "vitest";
import type { AppStore, Question } from "@/lib/types/models";
import {
  buildContentReviewMarkdown,
  buildContentReviewPackage,
  normalizeContentReviewOptions,
  validateContentReviewPackage,
  CONTENT_REVIEW_SCHEMA_VERSION,
} from "@/lib/content-review";
import { BEFORE_BABY_TEMPLATE } from "@/lib/checklists/templates/before-baby";

function baseQuestion(partial: Partial<Question> & Pick<Question, "id" | "slug" | "short_title" | "text">): Question {
  const now = "2026-08-01T12:00:00.000Z";
  return {
    why_it_matters: "Helper",
    discussion_guidance: "Discuss together.",
    question_type: "joint_discussion",
    response_schema: { mode: "open_or_policy" },
    life_stages: ["pre_birth_planning"],
    categories: ["hospital"],
    subcategories: [],
    outcomes: [],
    related_principles: [],
    related_questions: [],
    parent_decision_dependency: null,
    logical_order: 1,
    priority: "high",
    estimated_minutes: 10,
    emotional_weight: 2,
    evidence_needed: false,
    evidence_available: false,
    evidence_summary: null,
    practical_tip: null,
    separate_answers_recommended: true,
    cooling_off_recommended: false,
    follow_up_prompts: [],
    review_recommendation: null,
    child_dependent: false,
    required_before_birth: true,
    babymoon_priority: false,
    research_mode: "optional_background",
    active: true,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

function minimalStore(overrides?: Partial<AppStore>): AppStore {
  const q1 = baseQuestion({
    id: "q_1",
    slug: "birth-plan",
    short_title: "Birth plan",
    text: "What birth preferences matter most to us?",
    logical_order: 1,
    related_questions: ["q_2"],
  });
  const q2 = baseQuestion({
    id: "q_2",
    slug: "visitors-labor",
    short_title: "Visitors during labor",
    text: "Who may visit during labor?",
    logical_order: 2,
    parent_decision_dependency: "q_1",
    question_type: "single_choice",
    categories: ["boundaries"],
  });
  const q3 = baseQuestion({
    id: "q_3",
    slug: "college-savings",
    short_title: "College savings",
    text: "Should we open a 529 plan?",
    logical_order: 3,
    life_stages: ["young_adult"],
    priority: "future",
    categories: ["finances"],
    active: true,
  });
  const archived = baseQuestion({
    id: "q_arch",
    slug: "archived-q",
    short_title: "Archived",
    text: "Archived question",
    active: false,
    logical_order: 99,
  });
  const testQ = baseQuestion({
    id: "q_test_demo",
    slug: "test-demo",
    short_title: "Test demo",
    text: "Test only",
    logical_order: 100,
  });

  const now = "2026-08-01T12:00:00.000Z";
  return {
    family: {
      id: "family_turner",
      name: "Turner Family",
      created_at: now,
      updated_at: now,
    },
    members: [
      {
        id: "member_sam",
        family_id: "family_turner",
        user_id: "user_sam",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: now,
      },
      {
        id: "member_michelle",
        family_id: "family_turner",
        user_id: "user_michelle",
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: now,
      },
    ],
    users: [],
    settings: {
      family_id: "family_turner",
      hide_partner_answers_until_both_saved: true,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 3,
      include_perspective_history_in_playbook: true,
      expected_due_date: "2026-12-01",
      updated_at: now,
    },
    principles: [],
    questions: [q1, q2, q3, archived, testQ],
    question_options: [
      {
        id: "opt_1",
        question_id: "q_2",
        value: "immediate_family",
        label: "Immediate family only",
        sort_order: 1,
      },
      {
        id: "opt_2",
        question_id: "q_2",
        value: "no_visitors",
        label: "No visitors",
        sort_order: 2,
      },
    ],
    answers: [
      {
        id: "a1",
        family_id: "family_turner",
        question_id: "q_1",
        member_id: "member_sam",
        is_shared: false,
        payload: { text: "SECRET_ANSWER_TEXT_SHOULD_NOT_APPEAR" },
        status: "in_discussion",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    answer_versions: [],
    decisions: [],
    decision_links: [],
    discussion_sessions: [],
    discussion_items: [],
    evidence_items: [],
    knowledge_items: [],
    reviews: [],
    cooling_off_items: [],
    annual_review_cycles: [],
    outcomes: [],
    ai_outputs: [],
    checklist_instances: [],
    checklist_tasks: [
      {
        id: "task_custom",
        checklist_id: "c1",
        template_task_slug: null,
        title: "Custom: charge devices",
        category: "final_week",
        category_label: "Final Week",
        completed: false,
        completed_at: null,
        due_date: "2026-11-28",
        priority: "high",
        owner: "sam",
        notes: null,
        is_custom: true,
        is_default: false,
        archived: false,
        sort_order: 999,
        created_at: now,
        updated_at: now,
        manual_due_date: "2026-11-28",
        date_source: "manual",
        timing_type: "before_birth",
      },
      {
        id: "task_post",
        checklist_id: "c1",
        template_task_slug: "medical_post_1",
        title: "Schedule postpartum checkup",
        category: "medical",
        category_label: "Medical",
        completed: false,
        completed_at: null,
        due_date: "2026-12-15",
        priority: "high",
        owner: "michelle",
        notes: null,
        is_custom: false,
        is_default: true,
        archived: false,
        sort_order: 50,
        created_at: now,
        updated_at: now,
        timing_type: "after_birth",
        recommended_due_offset_days: 14,
        date_source: "calculated",
        calculated_due_date: "2026-12-15",
      },
    ],
    ...overrides,
  } as AppStore;
}

describe("AI Content Review Package", () => {
  it("exports all active non-test questions including unanswered", () => {
    const store = minimalStore();
    const pkg = buildContentReviewPackage({
      store,
      options: normalizeContentReviewOptions(),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    validateContentReviewPackage(pkg);
    expect(pkg.schema_version).toBe(CONTENT_REVIEW_SCHEMA_VERSION);
    const titles = pkg.question_bank!.questions.map((q) => q.title);
    expect(titles).toContain("Birth plan");
    expect(titles).toContain("Visitors during labor");
    expect(titles).toContain("College savings");
    expect(titles).not.toContain("Archived");
    expect(titles).not.toContain("Test demo");
    const unanswered = pkg.question_bank!.questions.filter(
      (q) => q.answer_status === "unanswered",
    );
    expect(unanswered.length).toBeGreaterThanOrEqual(2);
  });

  it("exports question options, branching, and linked questions", () => {
    const pkg = buildContentReviewPackage({
      store: minimalStore(),
      options: normalizeContentReviewOptions(),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    const visitors = pkg.question_bank!.questions.find(
      (q) => q.slug === "visitors-labor",
    )!;
    expect(visitors.answer_options).toHaveLength(2);
    expect(visitors.answer_options[0].label).toBe("Immediate family only");
    expect(visitors.branching_rules.parent_decision_dependency).toBe("q_1");
    expect(visitors.parent_question?.slug).toBe("birth-plan");
    const birth = pkg.question_bank!.questions.find((q) => q.slug === "birth-plan")!;
    expect(birth.linked_questions.some((l: { slug: string }) => l.slug === "visitors-labor")).toBe(
      true,
    );
  });

  it("exports checklist timing, post-birth tasks, and preserves manual dates", () => {
    const store = minimalStore({
      checklist_instances: [
        {
          id: "c1",
          family_id: "family_turner",
          template_slug: "before-baby",
          title: "Before Baby",
          description: "Test",
          created_at: "2026-08-01T12:00:00.000Z",
          updated_at: "2026-08-01T12:00:00.000Z",
        },
      ],
    });
    const pkg = buildContentReviewPackage({
      store,
      options: normalizeContentReviewOptions({ includeCustomTasks: true }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    const custom = pkg.before_baby!.tasks.find((t) => t.id === "task_custom");
    expect(custom).toBeTruthy();
    expect(custom!.manually_assigned_date).toBe("2026-11-28");
    expect(custom!.due_date).toBe("2026-11-28");
    const post = pkg.before_baby!.tasks.find((t) => t.id === "task_post");
    expect(post?.post_birth_task).toBe(true);
    const postBirth = pkg.before_baby?.timeline_review?.post_birth_tasks as
      | string[]
      | undefined;
    expect(postBirth).toContain("Schedule postpartum checkup");
  });

  it("includes custom tasks when enabled and synthesizes defaults when empty", () => {
    const emptyChecklist = minimalStore({
      checklist_instances: [],
      checklist_tasks: [],
    });
    const pkg = buildContentReviewPackage({
      store: emptyChecklist,
      options: normalizeContentReviewOptions(),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    const defaultCount = BEFORE_BABY_TEMPLATE.sections.reduce(
      (n, s) => n + s.tasks.length,
      0,
    );
    expect(pkg.before_baby!.tasks.length).toBe(defaultCount);
    expect(
      pkg.before_baby!.tasks.every((t) => t.default_or_custom === "default"),
    ).toBe(true);
    expect(
      pkg.before_baby!.tasks.some(
        (t) => t.recommended_due_offset_days != null || t.due_date != null,
      ),
    ).toBe(true);
  });

  it("excludes answers by default and includes statuses metadata", () => {
    const pkg = buildContentReviewPackage({
      store: minimalStore(),
      options: normalizeContentReviewOptions(),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    expect(pkg.family_answers).toBeNull();
    expect(pkg.privacy.answers_included).toBe(false);
    const json = JSON.stringify(pkg);
    expect(json).not.toContain("SECRET_ANSWER_TEXT_SHOULD_NOT_APPEAR");
    expect(
      pkg.question_bank!.questions.find((q) => q.id === "q_1")?.answer_status,
    ).toBe("sam_answered");
  });

  it("can include statuses only without free text", () => {
    const pkg = buildContentReviewPackage({
      store: minimalStore(),
      options: normalizeContentReviewOptions({
        includeAnswers: true,
        answerDetail: "statuses_only",
        includeFreeTextAnswers: false,
      }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    expect(pkg.family_answers?.mode).toBe("statuses_only");
    const json = JSON.stringify(pkg);
    expect(json).not.toContain("SECRET_ANSWER_TEXT_SHOULD_NOT_APPEAR");
  });

  it("never exports secrets or book text fields", () => {
    const pkg = buildContentReviewPackage({
      store: minimalStore(),
      options: normalizeContentReviewOptions({
        includeTechnicalHealthData: true,
        includeResearchSummaries: true,
      }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    const json = JSON.stringify(pkg);
    expect(json).not.toMatch(/SUPABASE|SERVICE_ROLE|api[_-]?key|Bearer /i);
    expect(json).not.toContain("extracted_text");
    expect(json).not.toContain("signedUrl");
    expect(pkg.privacy.secrets_excluded).toBe(true);
    expect(pkg.privacy.book_text_excluded).toBe(true);
  });

  it("is deterministic for the same store and timestamp", () => {
    const store = minimalStore();
    const now = new Date("2026-08-01T15:00:00.000Z");
    const a = JSON.stringify(
      buildContentReviewPackage({
        store,
        options: normalizeContentReviewOptions(),
        now,
      }),
    );
    const b = JSON.stringify(
      buildContentReviewPackage({
        store,
        options: normalizeContentReviewOptions(),
        now,
      }),
    );
    expect(a).toBe(b);
  });

  it("builds markdown with review prompt and covers large export", () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      baseQuestion({
        id: `q_bulk_${i}`,
        slug: `bulk-${i}`,
        short_title: `Bulk question ${i}`,
        text: `Should we discuss topic number ${i} for parenting planning?`,
        logical_order: 200 + i,
        categories: [`cat_${i % 5}`],
      }),
    );
    const store = minimalStore({
      questions: [...minimalStore().questions, ...many],
    });
    const pkg = buildContentReviewPackage({
      store,
      options: normalizeContentReviewOptions({ scope: "full" }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    expect(pkg.question_bank!.questions.length).toBeGreaterThan(100);
    const md = buildContentReviewMarkdown(pkg);
    expect(md).toContain("Executive Summary");
    expect(md).toContain("Paste everything below into ChatGPT or Claude");
    expect(md).toContain("Overall content score out of 100");
    expect(md.length).toBeGreaterThan(2000);
  });

  it("supports questions-only and before-baby-only scopes", () => {
    const store = minimalStore();
    const qOnly = buildContentReviewPackage({
      store,
      options: normalizeContentReviewOptions({ scope: "questions_only" }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    expect(qOnly.question_bank).toBeTruthy();
    expect(qOnly.before_baby).toBeNull();
    const bOnly = buildContentReviewPackage({
      store,
      options: normalizeContentReviewOptions({ scope: "before_baby_only" }),
      now: new Date("2026-08-01T15:00:00.000Z"),
    });
    expect(bOnly.question_bank).toBeNull();
    expect(bOnly.before_baby).toBeTruthy();
  });
});
