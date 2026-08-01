/**
 * Helper-text templates by question type / category.
 * Used when a question still has generic seed guidance.
 */
import type { Question } from "@/lib/types/models";

export const GENERIC_WHY_MARKERS = [
  "This shapes daily choices and long-term outcomes.",
  "Talk through values, tradeoffs, and what you would revisit later.",
];

export const GENERIC_GUIDANCE_MARKERS = [
  "Listen first, then look for the shared principle underneath the preference.",
];

export function helperForQuestion(q: Question): {
  why_it_matters: string;
  discussion_guidance: string;
  follow_up_prompts: string[];
  replaced: boolean;
} {
  const genericWhy = GENERIC_WHY_MARKERS.some((m) => q.why_it_matters.includes(m));
  const genericGuide = GENERIC_GUIDANCE_MARKERS.some((m) =>
    q.discussion_guidance.includes(m),
  );
  if (!genericWhy && !genericGuide) {
    return {
      why_it_matters: q.why_it_matters,
      discussion_guidance: q.discussion_guidance,
      follow_up_prompts: q.follow_up_prompts,
      replaced: false,
    };
  }

  const type = q.question_type;
  const cat = (q.categories[0] ?? "").toLowerCase();

  let why = q.why_it_matters;
  let guidance = q.discussion_guidance;
  let prompts = q.follow_up_prompts;

  if (type === "values_clarification" || cat.includes("value")) {
    why =
      "Discuss what this value means in daily behavior, what tradeoffs it creates, and what would make you revisit it.";
    guidance =
      "Name one concrete behavior that would show this value, and one conflict that would challenge it.";
    prompts = [
      "What behavior would show this value?",
      "What would conflict with it?",
      "How should we handle exceptions?",
    ];
  } else if (type === "practical_planning" || cat.includes("newborn") || cat.includes("pregnancy")) {
    why =
      "Agree on an initial plan, name one owner, and define when the plan should be reviewed.";
    guidance =
      "Separate the decision from the next action. Leave medical timing to a provider when needed.";
    prompts = [
      "Who owns the next step?",
      "What is the deadline?",
      "What would make the plan fail?",
      "What is the backup?",
    ];
  } else if (type === "tradeoff") {
    why =
      "Name what each option protects, what each option costs, and which risk feels harder to accept.";
    guidance = "Compare options before choosing. Record what information is still missing.";
    prompts = [
      "What does each option protect?",
      "What does each option risk?",
      "What information is missing?",
      "When should we revisit?",
    ];
  } else if (cat.includes("parent_partnership") || cat.includes("relationship")) {
    why =
      "Discuss each person’s needs separately before trying to agree on one policy.";
    guidance =
      "Listen for fairness and resentment early. Agree how either person can ask for a change.";
    prompts = [
      "What does each partner need?",
      "What would feel unfair?",
      "How will either person ask for a change?",
      "How will repair happen after conflict?",
    ];
  } else if (cat.includes("financ") || cat.includes("money")) {
    why = "Separate the family value from the operational step. Record both.";
    guidance =
      "Decide the principle first, then the account, owner, and review date.";
    prompts = [
      "What value is this protecting?",
      "What operational step follows?",
      "Who owns the next action?",
    ];
  } else if (genericWhy || genericGuide) {
    why =
      "Clarify preferences, name tradeoffs, and note what would make you revisit this.";
    guidance =
      "Answer separately if needed, then look for a shared principle and a next step.";
    prompts = [
      "What matters most here?",
      "What tradeoff are we accepting?",
      "When should we revisit?",
    ];
  }

  return {
    why_it_matters: why,
    discussion_guidance: guidance,
    follow_up_prompts: prompts,
    replaced: true,
  };
}
