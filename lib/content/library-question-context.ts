/**
 * Question-specific workshop context for important library questions
 * that are not (only) covered by Essentials screens.
 * Prefer blank over generic filler — only curated, concrete copy lives here.
 */
import type { SampleAnswer, Score1to5 } from "@/lib/essentials/screen-context";
import { questionIdsRelated } from "@/lib/conversations/deep-link";

export type LibraryQuestionEnrichment = {
  purpose: string;
  explanation: string;
  examples: SampleAnswer[];
  prompts: string[];
  related_research?: string;
  importance: Score1to5;
  relevance_now: Score1to5;
  difficulty: Score1to5;
  estimated_minutes: number;
};

const LIBRARY_CONTEXT: Record<string, LibraryQuestionEnrichment> = {
  q_what_traits_do_we_most_hope_our_child_develops: {
    purpose: "Name the character traits you will actually reinforce day to day.",
    explanation:
      "Trait priorities shape praise, discipline, school choices, and which behaviors you correct versus celebrate.",
    examples: [
      {
        style: "Character-first",
        text: "Kindness, honesty, and responsibility—competence matters, but not at the expense of how they treat people.",
      },
      {
        style: "Agency-first",
        text: "Curiosity, resilience, and sound judgment—we want them able to think and recover when things go wrong.",
      },
    ],
    prompts: [
      "Which three traits would we protect even under stress?",
      "Which trait do we risk over-valuing because of our own upbringing?",
    ],
    importance: 5,
    relevance_now: 4,
    difficulty: 3,
    estimated_minutes: 12,
  },
  q_should_our_child_receive_an_allowance: {
    purpose: "Decide whether money is taught through a regular allowance.",
    explanation:
      "This becomes the backbone for chores, saving rules, and how you talk about ‘enough’ later.",
    examples: [
      {
        style: "Yes, structured",
        text: "Yes—small weekly allowance starting around age six, with a save/spend/give split.",
      },
      {
        style: "Earn-only",
        text: "No automatic allowance; money comes from optional extra jobs once basic family chores are done.",
      },
    ],
    prompts: [
      "What age feels right to start?",
      "What should allowance teach that chores alone do not?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_should_allowance_be_tied_to_chores: {
    purpose: "Separate family contribution from paid work—or deliberately link them.",
    explanation:
      "This rule prevents later fights about ‘I won’t take out trash unless I get paid.’",
    examples: [
      {
        style: "Untied contribution",
        text: "Base chores are unpaid family contribution; allowance is separate; extra jobs can earn more.",
      },
      {
        style: "Tied to effort",
        text: "Allowance requires completing agreed chores; missed chores reduce that week’s amount.",
      },
    ],
    prompts: [
      "Which chores are simply ‘being in this family’?",
      "What happens the first week chores slip?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 4,
    estimated_minutes: 12,
  },
  q_which_chores_should_be_expected_as_a_family_contribution: {
    purpose: "List unpaid contributions that belong to membership in the family.",
    explanation:
      "Clear contribution lists reduce negotiation-at-every-meal and support the allowance principle.",
    examples: [
      {
        style: "Age-banded",
        text: "Toddler: put toys away. School-age: dishes + laundry basket. Teen: one household zone weekly.",
      },
      {
        style: "Shared load",
        text: "Everyone owns personal space plus one rotating common chore; parents still do the heavy lifts.",
      },
    ],
    prompts: [
      "What is never optional?",
      "How do we adjust when sports or school load spikes?",
    ],
    importance: 3,
    relevance_now: 2,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_what_money_lessons_belong_before_age_eight: {
    purpose: "Name the money skills you want locked in before complex spending starts.",
    explanation:
      "Early lessons become the language you reuse for phones, activities, and later credit.",
    examples: [
      {
        style: "Save-first",
        text: "Before age eight: money comes from effort, save a portion before spending, wants ≠ needs.",
      },
      {
        style: "Tradeoffs",
        text: "Choices have tradeoffs; waiting can get you more; generosity is planned, not leftover.",
      },
    ],
    prompts: [
      "What phrase do we want them to hear from both of us?",
      "What money behavior would worry us by age eight?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 2,
    estimated_minutes: 10,
  },
  q_how_should_gifts_and_spending_money_be_handled: {
    purpose: "Set gift and spending norms before birthdays and grandparents escalate them.",
    explanation:
      "Gift rules protect values around gratitude, clutter, and fairness between kids or cousins.",
    examples: [
      {
        style: "Experience-leaning",
        text: "Prefer experiences or one meaningful gift; cash gifts go partly to savings.",
      },
      {
        style: "Grateful + limits",
        text: "Gifts are welcome with a thank-you rule; no expectation of matching what friends receive.",
      },
    ],
    prompts: [
      "What do we tell grandparents before the first holiday?",
      "How do we handle a gift that violates a value?",
    ],
    importance: 3,
    relevance_now: 2,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_when_should_our_child_open_a_savings_account: {
    purpose: "Pick a concrete milestone for formal saving.",
    explanation:
      "An account turns ‘save first’ from a jar habit into a visible family system.",
    examples: [
      {
        style: "Early starter",
        text: "Open a custodial savings account when allowance begins; deposit the save portion together monthly.",
      },
      {
        style: "Later",
        text: "Jar/system at home until they can understand statements—then open an account around age eight to ten.",
      },
    ],
    prompts: [
      "Who takes them to open it?",
      "What percentage is untouchable without a family conversation?",
    ],
    importance: 3,
    relevance_now: 1,
    difficulty: 2,
    estimated_minutes: 8,
  },
  q_how_should_we_talk_about_money_status_and_enough: {
    purpose: "Align on the money story your child will overhear.",
    explanation:
      "Tone about ‘enough,’ status, and comparison becomes their default money anxiety or calm.",
    examples: [
      {
        style: "Enough-focused",
        text: "We talk gratefully about enough; we don’t perform wealth; big purchases get a values check.",
      },
      {
        style: "Transparent tradeoffs",
        text: "We name tradeoffs out loud (‘we’re choosing travel over a newer car’) without shaming others’ choices.",
      },
    ],
    prompts: [
      "What money talk is off-limits in front of kids?",
      "How do we answer ‘are we rich?’",
    ],
    importance: 4,
    relevance_now: 3,
    difficulty: 4,
    estimated_minutes: 15,
  },
  q_what_is_the_purpose_of_discipline_in_our_family: {
    purpose: "Define what discipline is for—before you pick tools.",
    explanation:
      "Purpose drives whether you reach for punishment, teaching, or connection when behavior spikes.",
    examples: [
      {
        style: "Teaching",
        text: "Discipline teaches self-control and repair; it is not about making them pay for making us angry.",
      },
      {
        style: "Safety + character",
        text: "First protect safety and respect; then help them practice the skill they lacked in the moment.",
      },
    ],
    prompts: [
      "What would ‘success’ look like after a hard consequence?",
      "What discipline memory from childhood do we refuse to repeat?",
    ],
    importance: 5,
    relevance_now: 3,
    difficulty: 4,
    estimated_minutes: 15,
  },
  q_which_forms_of_discipline_are_unacceptable_to_us: {
    purpose: "Draw hard lines you both will honor under stress.",
    explanation:
      "Non-negotiables prevent one-parent escalation and give a shared script to caregivers.",
    examples: [
      {
        style: "No humiliation",
        text: "No spanking, no shaming language, no withholding love or basic needs as punishment.",
      },
      {
        style: "No scare control",
        text: "No threats we won’t keep, no silent treatment, no comparing them to other kids as discipline.",
      },
    ],
    prompts: [
      "What is never allowed—even when we are furious?",
      "How does either of us intervene if the other crosses a line?",
    ],
    importance: 5,
    relevance_now: 3,
    difficulty: 3,
    estimated_minutes: 12,
  },
  q_how_should_consequences_relate_to_behavior: {
    purpose: "Prefer natural/logical consequences over arbitrary ones.",
    explanation:
      "Related consequences teach cause-and-effect; random ones teach fear of parents.",
    examples: [
      {
        style: "Logical",
        text: "If they wreck a toy by throwing it, it rests for a day; if they refuse a coat, we leave later when they’re ready—within reason.",
      },
      {
        style: "Repair-focused",
        text: "Harm to people requires repair (apology + action); loss of privilege is secondary.",
      },
    ],
    prompts: [
      "Give one example consequence for hitting vs. for dawdling.",
      "When do we pause instead of consequencing immediately?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 4,
    estimated_minutes: 12,
  },
  q_how_should_we_handle_lying: {
    purpose: "Decide how truth-telling is protected when kids mess up.",
    explanation:
      "Your response to lies either rewards honesty after mistakes or trains better hiding.",
    examples: [
      {
        style: "Truth amnesty",
        text: "Honest admission reduces the consequence; the lie is addressed separately from the original mistake.",
      },
      {
        style: "Trust rebuild",
        text: "Lying pauses privileges that require trust until repair happens; we stay calm and curious first.",
      },
    ],
    prompts: [
      "What makes lying more likely in our home?",
      "How do we respond in the first 60 seconds?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 4,
    estimated_minutes: 12,
  },
  q_how_should_we_approach_early_screen_exposure_for_adults_a: {
    purpose: "Set adult phone norms around a baby before habits calcify.",
    explanation:
      "Babies learn attention patterns from your face—and visitors copy whatever you allow.",
    examples: [
      {
        style: "Phone-down feeds",
        text: "No scrolling during feeds or floor play; phones charge outside the bedroom at night.",
      },
      {
        style: "Practical limits",
        text: "Quick checks OK; no background YouTube in baby spaces; photos without broadcasting every moment.",
      },
    ],
    prompts: [
      "When is a phone a tool vs. a third parent?",
      "What do we ask visitors to do with phones?",
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_how_should_screens_relate_to_learning_if_at_all_in_early: {
    purpose: "Decide whether early screens are tools, treats, or mostly off-limits.",
    explanation:
      "This principle guides preschool apps, car videos, and how you answer ‘educational’ marketing.",
    examples: [
      {
        style: "Delay",
        text: "No personal screens before age two; after that, co-viewed short content with a clear end time.",
      },
      {
        style: "Selective tool",
        text: "Rare video calls with family anytime; learning apps only with a parent, never as default babysitter.",
      },
    ],
    prompts: [
      "What exception is allowed on airplanes or sick days?",
      "Who enforces the end of screen time?",
    ],
    importance: 4,
    relevance_now: 2,
    difficulty: 3,
    estimated_minutes: 12,
  },
  q_what_childcare_options_are_acceptable_to_us_in_the_first: {
    purpose: "Name acceptable care arrangements before leave ends.",
    explanation:
      "Acceptable options drive leave length, budget, and how hard you hunt for a particular slot.",
    examples: [
      {
        style: "Parent + daycare",
        text: "Parent care as long as feasible, then a small daycare with outdoor time; nanny only if schedules break.",
      },
      {
        style: "Family help",
        text: "Grandparent care 2–3 days is welcome with our sleep/food/screen rules written down.",
      },
    ],
    prompts: [
      "What is unacceptable even if convenient?",
      "What would make us revisit the plan at 6 months?",
    ],
    importance: 5,
    relevance_now: 4,
    difficulty: 4,
    estimated_minutes: 15,
  },
  q_how_will_we_evaluate_daycare_or_preschool_quality: {
    purpose: "Agree on quality signals before touring under time pressure.",
    explanation:
      "Shared criteria prevent one partner vetoing from gut feel while the other optimizes for logistics.",
    examples: [
      {
        style: "Relationship-first",
        text: "Warm teachers, low turnover, how they handle crying, outdoor access, clear illness policy.",
      },
      {
        style: "Practical + values",
        text: "Ratio, cleanliness, communication app, alignment on food/screens, commute under 20 minutes.",
      },
    ],
    prompts: [
      "What are our top three deal-breakers?",
      "Who calls references?",
    ],
    importance: 4,
    relevance_now: 3,
    difficulty: 3,
    estimated_minutes: 12,
  },
  q_what_values_should_a_caregiver_share_with_us: {
    purpose: "List values a caregiver must honor when you are not in the room.",
    explanation:
      "Values alignment beats perfect logistics when your child spends long days elsewhere.",
    examples: [
      {
        style: "Warm firm",
        text: "Respectful talk, no shaming, outdoor play, follows our sleep/food rules, tells us about hard moments.",
      },
      {
        style: "Curious + safe",
        text: "Safety first, gentle coaching, screens only per our policy, supports both parents equally.",
      },
    ],
    prompts: [
      "What value breach would make us leave a provider?",
      "How do we communicate rules without micromanaging?",
    ],
    importance: 4,
    relevance_now: 3,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_how_should_we_handle_guilt_about_using_childcare: {
    purpose: "Pre-agree how you will talk to yourselves about care days.",
    explanation:
      "Guilt scripts can sabotage a solid plan—or keep you from using help you need.",
    examples: [
      {
        style: "Both/and",
        text: "Using care can be loving; we measure success by connection at pickup, not by never needing help.",
      },
      {
        style: "Seasonal",
        text: "Guilt gets named in weekly check-ins; we adjust hours before we abandon a working arrangement.",
      },
    ],
    prompts: [
      "What guilt story is each of us most prone to?",
      "What evidence would tell us the plan is working?",
    ],
    importance: 3,
    relevance_now: 3,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_what_does_a_good_day_look_like_when_both_parents_are_exha: {
    purpose: "Define ‘good enough’ for depleted days so you stop failing an impossible standard.",
    explanation:
      "Exhausted-day standards protect partnership and keep newborn weeks from becoming a referendum on love.",
    examples: [
      {
        style: "Minimum viable day",
        text: "Everyone fed/safe, one short outdoor moment if possible, no big decisions, tag-out available once each.",
      },
      {
        style: "Connection scraps",
        text: "One sincere check-in, one laugh if we can manage it, dishes can wait, resentment gets spoken before bed.",
      },
    ],
    prompts: [
      "What do we drop first on a hard day?",
      "What still counts as showing up for each other?",
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_how_should_we_respond_when_one_parent_feels_overloaded: {
    purpose: "Create a response pattern before overload becomes contempt.",
    explanation:
      "A rehearsed response beats improvising when one of you is drowning.",
    examples: [
      {
        style: "Immediate relief",
        text: "Say ‘I’m overloaded’; the other takes the baby/task within 10 minutes without debating fairness in the moment.",
      },
      {
        style: "Relief + plan",
        text: "Relieve first, then a same-day 10-minute reset on what to offload this week.",
      },
    ],
    prompts: [
      "What words will we actually say?",
      "What is never an acceptable response to overload?",
    ],
    importance: 5,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_what_topics_deserve_private_discussion_before_either_pare: {
    purpose: "List decisions that must not be made unilaterally with relatives watching.",
    explanation:
      "Private-first topics prevent public pressure and split-parenting in front of family.",
    examples: [
      {
        style: "Core list",
        text: "Sleep training, feeding changes, visitor exceptions, spending over a set amount, discipline approaches.",
      },
      {
        style: "Wide net",
        text: "Anything that changes a written family rule waits for a private huddle—even if a grandparent is waiting.",
      },
    ],
    prompts: [
      "What is safe for one parent to decide alone?",
      "How do we pause a relative politely?",
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
  q_how_will_we_evaluate_whether_our_sleep_approach_is_workin: {
    purpose: "Define success metrics so sleep debates use data, not blame.",
    explanation:
      "Shared metrics decide when to change course instead of arguing every night.",
    examples: [
      {
        style: "Parent health",
        text: "Working = baby safe, each parent gets one protected sleep block, mood isn’t collapsing for 3+ days.",
      },
      {
        style: "Baby + parents",
        text: "Working = sustainable nights + daytime functioning; revisit if either parent dreads bedtime.",
      },
    ],
    prompts: [
      "What number of bad nights triggers a plan change?",
      "Who proposes the experiment?",
    ],
    importance: 4,
    relevance_now: 5,
    difficulty: 3,
    estimated_minutes: 10,
  },
};

export function getLibraryQuestionEnrichment(
  questionId: string | null | undefined,
): LibraryQuestionEnrichment | null {
  if (!questionId) return null;
  if (LIBRARY_CONTEXT[questionId]) return LIBRARY_CONTEXT[questionId]!;
  const hit = Object.entries(LIBRARY_CONTEXT).find(
    ([id]) => questionIdsRelated(id, questionId),
  );
  return hit?.[1] ?? null;
}

export function listLibraryQuestionEnrichmentIds(): string[] {
  return Object.keys(LIBRARY_CONTEXT);
}
