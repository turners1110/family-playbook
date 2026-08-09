/**
 * Apply Question Experience V2 cohort metadata to data/seed/questions.json.
 *
 * Updates only:
 * - response_schema (structured modes + options from Essentials where available)
 * - estimated_minutes
 *
 * Does not touch answers, IDs, or discussion_mode.
 *
 * Usage:
 *   pnpm exec tsx scripts/apply-question-experience-v2.ts
 *   pnpm exec tsx scripts/apply-question-experience-v2.ts --dry-run
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { ESSENTIALS_SCREENS } from "../lib/essentials/pathway";

const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");

/** Curated options for high-value structured questions without Essentials options. */
const CURATED_STRUCTURE: Record<
  string,
  Partial<{
    options: string[];
    max_selections: number;
    tradeoff_a_label: string;
    tradeoff_b_label: string;
    scenario_options: string[];
    policy_fields: string[];
    matrix_rows: string[];
    matrix_owners: string[];
  }>
> = {
  q_should_allowance_be_tied_to_chores: {
    options: [
      "Yes — allowance is earned through chores",
      "No — allowance is separate from chores",
      "Hybrid — base allowance plus chore bonuses",
      "Decide later / depends on age",
    ],
  },
  q_should_our_child_receive_an_allowance: {
    options: [
      "Yes, starting at a set age",
      "Yes, when they show readiness",
      "No allowance — use other money teaching",
      "Undecided / revisit later",
    ],
  },
  q_should_we_match_savings: {
    options: [
      "Yes — match savings dollar-for-dollar",
      "Partial match with a cap",
      "No matching — encourage saving another way",
      "Decide when relevant",
    ],
  },
  q_will_we_prepare_separate_meals_for_a_child_who_refuses_dinner: {
    options: [
      "No separate meals — offer the family meal",
      "Limited backup option only",
      "Yes when needed to reduce conflict",
      "Depends on age and context",
    ],
  },
  q_will_we_require_tasting_unfamiliar_foods: {
    options: [
      "Yes — one polite taste required",
      "Encourage but never force",
      "No pressure around tasting",
      "Depends on the food and situation",
    ],
  },
  q_who_should_attend_the_birth: {
    options: [
      "Partner only",
      "Partner + one support person",
      "Doula / birth professional",
      "Parents / close family",
      "Keep the room limited — decide closer to due date",
    ],
  },
  q_what_traits_do_we_most_hope_our_child_develops: {
    options: [
      "Kindness",
      "Curiosity",
      "Resilience",
      "Honesty",
      "Independence",
      "Empathy",
      "Responsibility",
      "Courage",
    ],
  },
  q_which_five_adult_traits_matter_most_to_us: {
    options: [
      "Emotional security",
      "Independence",
      "Curiosity",
      "Kindness",
      "Discipline / self-control",
      "Faith or spiritual grounding",
      "Work ethic",
      "Joy / playfulness",
    ],
  },
  q_which_birth_preferences_matter_most_to_us: {
    options: [
      "Pain management approach",
      "Who is in the room",
      "Immediate skin-to-skin",
      "Delayed cord clamping",
      "Feeding plan in first hour",
      "Cesarean preferences if needed",
      "Music / atmosphere",
      "Partner's role during labor",
    ],
  },
  q_what_holidays_will_we_prioritize_and_with_whom: {
    options: [
      "Christmas / major winter holiday",
      "Thanksgiving",
      "Our own family traditions",
      "Visiting Sam's family",
      "Visiting Michelle's family",
      "Travel / vacation holidays",
      "Low-key / rest days",
    ],
  },
  q_what_safety_proofing_priorities_matter_before_crawling: {
    options: [
      "Outlet covers and cords",
      "Cabinet / chemical locks",
      "Stairs and gates",
      "Furniture anchoring",
      "Sleep environment safety",
      "Water / bathroom hazards",
      "Choking hazards / floor clutter",
    ],
  },
  q_how_should_night_duties_be_divided_during_the_newborn_stage: {
    matrix_rows: [
      "Night feeding",
      "Diaper changes",
      "Soothing back to sleep",
      "Getting baby settled after feeds",
      "Protecting the off-duty parent's sleep",
    ],
    matrix_owners: ["Sam", "Michelle", "Both", "Depends"],
  },
  q_how_should_we_divide_invisible_household_and_parenting_work: {
    matrix_rows: [
      "Tracking supplies / appointments",
      "Mental load / planning",
      "Cleaning / laundry",
      "Feeding prep",
      "Communicating with family",
    ],
    matrix_owners: ["Sam", "Michelle", "Both", "Depends"],
  },
  q_how_will_we_divide_laundry_bottles_and_pump_parts_if_used: {
    matrix_rows: [
      "Laundry",
      "Bottles",
      "Pump parts",
      "Dishwashing",
      "Restocking supplies",
    ],
    matrix_owners: ["Sam", "Michelle", "Both", "Depends"],
  },
  q_how_will_we_protect_sleep_for_the_parent_who_is_not_on_overnig: {
    matrix_rows: [
      "Who is on-call overnight",
      "Where the on-call parent sleeps",
      "How the off-duty parent is protected",
      "Weekend / catch-up sleep plan",
    ],
    matrix_owners: ["Sam", "Michelle", "Both", "Depends"],
  },
  q_what_boundaries_apply_to_overnight_guests_after_birth: {
    matrix_rows: [
      "Who may stay overnight",
      "How soon after birth",
      "How long they may stay",
      "Help we want vs privacy we need",
    ],
    matrix_owners: ["Allowed", "Not yet", "Case by case", "Depends"],
  },
  q_what_responsibilities_should_sam_own_during_the_first_two_week: {
    matrix_rows: [
      "Overnight support",
      "Meals / household",
      "Visitor coordination",
      "Errands / logistics",
      "Emotional support",
    ],
    matrix_owners: ["Sam primary", "Shared", "Michelle primary", "Depends"],
  },
  q_who_owns_which_recurring_household_tasks_in_the_first_three_mo: {
    matrix_rows: [
      "Dishes",
      "Laundry",
      "Trash / recycling",
      "Groceries",
      "Cleaning bathrooms",
      "Pet care (if any)",
    ],
    matrix_owners: ["Sam", "Michelle", "Both", "Depends"],
  },
  q_how_should_we_handle_visitors_who_ignore_boundaries: {
    policy_fields: [
      "First response",
      "Who speaks for the family",
      "When we end the visit",
      "Follow-up conversation",
      "Exceptions",
    ],
  },
  q_what_boundaries_apply_to_unsolicited_advice_from_family: {
    policy_fields: [
      "Default response phrase",
      "Topics that are off-limits",
      "Who responds",
      "When we escalate",
      "Exceptions",
    ],
  },
};

type CohortFile = {
  questions: Array<{
    id: string;
    proposed_response_type: string;
    proposed_estimated_minutes: number;
    proposed_response_schema: Record<string, unknown>;
    rationale: string;
    essentials_link: { screen_id: string; response_type: string } | null;
  }>;
};

function main() {
  const cohort = JSON.parse(
    readFileSync(path.join(root, "docs/high-priority-question-cohort.json"), "utf8"),
  ) as CohortFile;
  const questionsPath = path.join(root, "data/seed/questions.json");
  const questions = JSON.parse(readFileSync(questionsPath, "utf8")) as Array<
    Record<string, unknown> & { id: string }
  >;
  const byId = new Map(questions.map((q) => [q.id, q]));

  const changes: Array<Record<string, unknown>> = [];

  for (const item of cohort.questions) {
    const q = byId.get(item.id);
    if (!q) continue;

    let schema: Record<string, unknown> = {
      ...item.proposed_response_schema,
      version: 2,
    };
    const curated = CURATED_STRUCTURE[item.id];
    if (curated) schema = { ...schema, ...curated };

    const screen = item.essentials_link
      ? ESSENTIALS_SCREENS.find((s) => s.id === item.essentials_link!.screen_id)
      : ESSENTIALS_SCREENS.find(
          (s) =>
            s.question_id === item.id ||
            item.id.startsWith(s.question_id) ||
            s.question_id.startsWith(item.id),
        );

    if (screen) {
      if (screen.options?.length) schema = { ...schema, options: screen.options };
      if (screen.matrix_rows?.length) {
        schema = {
          ...schema,
          matrix_rows: screen.matrix_rows,
          matrix_owners: (screen.matrix_owners ?? ["sam", "michelle", "both", "other"]).map(
            (o) => (o === "sam" ? "Sam" : o === "michelle" ? "Michelle" : o === "both" ? "Both" : "Depends"),
          ),
        };
      }
      if (screen.policy_fields?.length) {
        schema = { ...schema, policy_fields: screen.policy_fields };
      }
    }

    const mode = String(schema.mode);
    const needsOpts = [
      "single_choice",
      "multi_select",
      "ranking",
      "priority_pick",
      "scenario",
    ].includes(mode);
    if (needsOpts && !(Array.isArray(schema.options) && schema.options.length)) {
      // Without options, do not force broken structured UI
      schema = { mode: "open_discussion", version: 2 };
    }
    if (mode === "matrix" && !(Array.isArray(schema.matrix_rows) && schema.matrix_rows.length)) {
      schema = { mode: "open_discussion", version: 2 };
    }
    if (
      mode === "policy_builder" &&
      !(Array.isArray(schema.policy_fields) && schema.policy_fields.length) &&
      !(Array.isArray(schema.options) && schema.options.length)
    ) {
      schema = { mode: "open_discussion", version: 2 };
    }

    const prevSchema = JSON.stringify(q.response_schema ?? {});
    const nextSchema = JSON.stringify(schema);
    const prevMinutes = q.estimated_minutes;
    const nextMinutes = item.proposed_estimated_minutes;

    if (prevSchema === nextSchema && prevMinutes === nextMinutes) continue;

    changes.push({
      id: item.id,
      from_schema: q.response_schema,
      to_schema: schema,
      from_minutes: prevMinutes,
      to_minutes: nextMinutes,
      rationale: item.rationale,
    });

    if (!dryRun) {
      q.response_schema = schema;
      q.estimated_minutes = nextMinutes;
    }
  }

  const report = {
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    cohort_size: cohort.questions.length,
    changed: changes.length,
    changes,
  };
  writeFileSync(
    path.join(root, "docs/question-experience-v2-apply-report.json"),
    JSON.stringify(report, null, 2),
  );

  if (!dryRun) {
    writeFileSync(questionsPath, `${JSON.stringify(questions, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        changed: changes.length,
        report: "docs/question-experience-v2-apply-report.json",
      },
      null,
      2,
    ),
  );
}

main();
