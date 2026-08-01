import { describe, expect, it } from "vitest";
import seedQuestions from "@/data/seed/questions.json";
import {
  BEFORE_BIRTH_PATHWAY_VERSION,
  ESSENTIALS_MODULES,
  ESSENTIALS_SCREENS,
  allPathwayQuestionIds,
  listPrimaryScreens,
} from "@/lib/essentials/pathway";
import { GENERIC_WHY_MARKERS } from "@/lib/content/helper-templates";
import { buildEssentialsDashboard, evaluateConditional } from "@/lib/essentials/progress";
import { buildBabymoonSummary } from "@/lib/essentials/summary";
import { collectTaskSuggestions } from "@/lib/essentials/task-suggestions";
import type { Answer, AppStore } from "@/lib/types/models";

const seedById = new Map(seedQuestions.map((q) => [q.id, q]));

function minimalStore(answers: Answer[] = []): AppStore {
  return {
    family: {
      id: "f",
      name: "Turner Family",
      created_at: "",
      updated_at: "",
    },
    users: [],
    members: [
      {
        id: "m_sam",
        family_id: "f",
        user_id: "u_sam",
        display_name: "Sam",
        role: "parent",
        sort_order: 1,
        created_at: "",
      },
      {
        id: "m_michelle",
        family_id: "f",
        user_id: "u_michelle",
        display_name: "Michelle",
        role: "parent",
        sort_order: 2,
        created_at: "",
      },
    ],
    children: [],
    life_stages: [],
    categories: [],
    outcome_domains: [],
    outcomes: [],
    development_maps: [],
    principles: [],
    questions: seedQuestions.map((q) => ({
      ...q,
      created_at: "",
      updated_at: "",
      active: true,
    })) as AppStore["questions"],
    question_options: [],
    answers,
    answer_versions: [],
    decisions: [],
    decision_versions: [],
    sessions: [],
    session_questions: [],
    knowledge_items: [],
    cooling_off_items: [],
    reviews: [],
    bookmarks: [],
    activity_log: [],
    settings: {
      family_id: "f",
      hide_partner_answers_until_both_saved: false,
      dark_mode: "system",
      babymoon_target_date: null,
      babymoon_daily_questions: 5,
      include_perspective_history_in_playbook: false,
      updated_at: "",
    },
    ai_outputs: [],
    playbook_versions: [],
    checklist_instances: [],
    checklist_tasks: [],
    current_user_id: "u_sam",
    demo_mode: true,
  };
}

describe("Before Birth Essentials pathway", () => {
  it("contains 28–35 primary screens and eight modules including foundation", () => {
    const primary = listPrimaryScreens();
    expect(primary.length).toBeGreaterThanOrEqual(28);
    expect(primary.length).toBeLessThanOrEqual(35);
    expect(ESSENTIALS_MODULES.length).toBe(8);
    expect(ESSENTIALS_MODULES[0]?.id).toBe("foundation");
    expect(
      ESSENTIALS_MODULES.map((m) => m.id),
    ).toEqual(
      expect.arrayContaining([
        "birth_medical",
        "feeding_sleep",
        "postpartum",
        "partnership",
        "visitors",
        "work_legal",
        "home_lulu",
      ]),
    );
    expect(BEFORE_BIRTH_PATHWAY_VERSION).toBeTruthy();
  });

  it("includes three foundation screens", () => {
    const foundation = ESSENTIALS_SCREENS.filter((s) => s.module_id === "foundation");
    expect(foundation).toHaveLength(3);
    expect(foundation.map((s) => s.id)).toEqual([
      "f1_success",
      "f2_loving_home",
      "f3_childhood",
    ]);
  });

  it("keeps the full 430-question library and stable IDs", () => {
    expect(seedQuestions).toHaveLength(430);
    for (const id of allPathwayQuestionIds()) {
      expect(seedById.has(id)).toBe(true);
    }
  });

  it("uses full titles and non-generic helpers with structured response types", () => {
    for (const screen of listPrimaryScreens()) {
      expect(screen.title.includes("…")).toBe(false);
      expect(screen.title.includes("...")).toBe(false);
      expect(screen.helper.length).toBeGreaterThan(40);
      for (const marker of GENERIC_WHY_MARKERS) {
        expect(screen.helper.includes(marker)).toBe(false);
      }
      expect(screen.response_type).toBeTruthy();
      expect(screen.prompts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("preserves paired childhood question IDs on one screen", () => {
    const childhood = ESSENTIALS_SCREENS.find((s) => s.id === "f3_childhood")!;
    expect(childhood.question_id).toBe(
      "q_what_parts_of_our_own_childhoods_do_we_hope_to_repeat",
    );
    expect(childhood.paired_question_ids).toContain(
      "q_what_parts_of_our_childhoods_do_we_hope_to_change",
    );
  });

  it("evaluates childcare conditional branching", () => {
    expect(
      evaluateConditional(
        {
          source_screen_id: "w2_return_childcare",
          show_when_choice_includes: ["Daycare", "Mixed plan"],
        },
        {
          payload: { choice: "Daycare" },
          status: "tentatively_decided",
        } as Answer,
      ),
    ).toBe(true);
    expect(
      evaluateConditional(
        {
          source_screen_id: "w2_return_childcare",
          show_when_choice_includes: ["Daycare", "Mixed plan"],
        },
        {
          payload: { choice: "Parent care" },
          status: "tentatively_decided",
        } as Answer,
      ),
    ).toBe(false);
  });

  it("builds dashboard progress and resume from existing answers", () => {
    const store = minimalStore([
      {
        id: "a1",
        family_id: "f",
        question_id: "q_what_does_success_as_parents_mean_to_us",
        member_id: null,
        is_shared: true,
        payload: { choice: ["Child feels safe and loved"], text: "safe" },
        status: "tentatively_decided",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const dash = buildEssentialsDashboard(store);
    expect(dash.completed).toBeGreaterThanOrEqual(1);
    expect(dash.resume_screen_id).toBeTruthy();
    expect(dash.visible_primary).toBeGreaterThanOrEqual(28);
  });

  it("does not silently merge separate answers in summary", () => {
    const store = minimalStore([
      {
        id: "a_sam",
        family_id: "f",
        question_id: "q_what_support_will_michelle_need_during_recovery",
        member_id: "m_sam",
        is_shared: false,
        payload: { text: "Sleep and quiet" },
        status: "in_discussion",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "a_michelle",
        family_id: "f",
        question_id: "q_what_support_will_michelle_need_during_recovery",
        member_id: "m_michelle",
        is_shared: false,
        payload: { text: "Meal help and privacy" },
        status: "in_discussion",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const summary = buildBabymoonSummary(store);
    expect(
      summary.different_viewpoints.some((d) =>
        d.title.toLowerCase().includes("michelle"),
      ),
    ).toBe(true);
    expect(summary.shared_decisions.some((d) => d.summary.includes("Sleep and quiet") && d.summary.includes("Meal help"))).toBe(false);
  });

  it("requires task suggestion preview before apply (collect only)", () => {
    const store = minimalStore();
    const suggestions = collectTaskSuggestions(store);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.reason && s.title)).toBe(true);
  });
});
