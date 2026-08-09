/**
 * Plan Essentials screens by cumulative estimated discussion time.
 */
import type { EssentialsScreenDef } from "@/lib/essentials/pathway";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";

/** Conservative defaults from response type when question minutes are unavailable. */
export function essentialsScreenMinutes(screen: EssentialsScreenDef): number {
  switch (screen.response_type) {
    case "single_choice":
    case "multi_select":
    case "scale":
      return 5;
    case "ranking":
    case "scenario_plan":
    case "named_people":
      return 8;
    case "policy_builder":
    case "responsibility_matrix":
      return 12;
    case "separate_then_shared":
    case "paired_text":
      return 15;
    case "open_with_prompts":
      return 10;
    default:
      return 8;
  }
}

/**
 * Pack incomplete screens until adding the next would overshoot budget
 * (unless the next item alone is a major discussion that can fill most of a short session).
 */
export function planEssentialsByMinutes(
  incomplete: EssentialsScreenDef[],
  budgetMinutes: number,
  questionMinutesById?: Map<string, number>,
): { screens: EssentialsScreenDef[]; aboutMinutes: number } {
  if (budgetMinutes <= 0) {
    return {
      screens: incomplete,
      aboutMinutes: incomplete.reduce(
        (sum, s) =>
          sum +
          (questionMinutesById?.get(s.question_id) ?? essentialsScreenMinutes(s)),
        0,
      ),
    };
  }

  const selected: EssentialsScreenDef[] = [];
  let used = 0;

  for (const screen of incomplete) {
    const minutes =
      questionMinutesById?.get(screen.question_id) ??
      essentialsScreenMinutes(screen);

    if (selected.length === 0) {
      selected.push(screen);
      used += minutes;
      if (minutes >= budgetMinutes * 0.7) break;
      continue;
    }

    if (used + minutes > budgetMinutes + 2) break;
    selected.push(screen);
    used += minutes;
    if (used >= budgetMinutes) break;
  }

  return { screens: selected, aboutMinutes: used };
}

export function allEssentialsScreenIds(): string[] {
  return ESSENTIALS_SCREENS.map((s) => s.id);
}
