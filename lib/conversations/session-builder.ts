import type { ConversationModeId, ConversationEnergy } from "@/lib/types/models";
import { getConversationMode } from "./modes";
import { getActiveQuickPrompts } from "./quick-prompts";
import {
  BABYMOON_INLINE_PROMPTS,
  BABYMOON_SET_TAG,
  getBabymoonRoundPrompts,
  resolveConversationPrompt,
} from "./babymoon-set";
import type { ConversationPromptDef, ConversationEnergyLevel } from "./response-types";
import { energyLevelToStore } from "./response-types";

export type SessionBuilderInput = {
  mode: ConversationModeId;
  plannedMinutes: number;
  energyPreference?: ConversationEnergyLevel | "balanced";
  topics?: string[];
  /** Default true: skip prompts whose linked library question is already answered. */
  includeUnansweredOnly?: boolean;
  includePriorDifferences?: boolean;
  includeDiscussLater?: boolean;
  includePlanning?: boolean;
  avoidRecentlyAnswered?: boolean;
  surpriseMe?: boolean;
  /** When set, build a fixed Babymoon Set round. */
  babymoonRound?: 1 | 2 | 3;
  recentlyAnsweredIds?: string[];
  discussLaterIds?: string[];
  differenceIds?: string[];
  /** Library deep-question IDs that are fully answered (skipByDefault). */
  answeredLibraryQuestionIds?: string[];
};

export type BuiltSessionItem = {
  prompt_id: string;
  source_question_id: string | null;
  item_type: ConversationPromptDef["response_type"];
  energy: ConversationEnergy;
  estimated_time_seconds: number;
  display_order: number;
};

const FUTURE_STAGE_TAGS = new Set(["teen", "young_adult", "money"]);

function targetSeconds(plannedMinutes: number): number {
  if (plannedMinutes <= 0) return 45 * 60;
  return plannedMinutes * 60;
}

function suggestedMix(plannedMinutes: number): {
  lightning: number;
  coffee: number;
  big: number;
  planning: number;
} {
  if (plannedMinutes <= 5) return { lightning: 5, coffee: 1, big: 0, planning: 0 };
  if (plannedMinutes <= 10) return { lightning: 4, coffee: 2, big: 0, planning: 0 };
  if (plannedMinutes <= 15) return { lightning: 4, coffee: 2, big: 1, planning: 0 };
  if (plannedMinutes <= 30) return { lightning: 5, coffee: 3, big: 1, planning: 0 };
  if (plannedMinutes <= 45) return { lightning: 5, coffee: 4, big: 2, planning: 0 };
  return { lightning: 6, coffee: 4, big: 2, planning: 1 };
}

function scorePrompt(
  p: ConversationPromptDef,
  input: SessionBuilderInput,
  modeTopics: Set<string>,
): number {
  let score = 10;
  if (p.session_tags.includes(input.mode)) score += 20;
  if (p.conversation_tags.some((t) => modeTopics.has(t))) score += 15;
  if (input.topics?.some((t) => p.conversation_tags.includes(t as never))) {
    score += 12;
  }
  if (p.follow_up_open_question_id) score += 8;
  if (input.avoidRecentlyAnswered && input.recentlyAnsweredIds?.includes(p.id)) {
    score -= 50;
  }
  if (
    input.answeredLibraryQuestionIds?.length &&
    isLibraryAnswered(p.follow_up_open_question_id, input.answeredLibraryQuestionIds)
  ) {
    score -= 80;
  }
  if (input.includeDiscussLater && input.discussLaterIds?.includes(p.id)) {
    score += 25;
  }
  if (input.includePriorDifferences && input.differenceIds?.includes(p.id)) {
    score += 20;
  }
  if (input.surpriseMe) score += Math.floor(Math.random() * 8);
  if (
    input.energyPreference &&
    input.energyPreference !== "balanced" &&
    p.conversation_energy === input.energyPreference
  ) {
    score += 10;
  }
  return score;
}

function isAllowedForMode(
  p: ConversationPromptDef,
  modeId: ConversationModeId,
  hideFuture: boolean,
): boolean {
  if (!p.active) return false;
  if (hideFuture && p.life_stage === "teen") return false;
  if (hideFuture && FUTURE_STAGE_TAGS.has(p.topic) && modeId === "babymoon") {
    // Allow money only if explicitly fun-linked; skip pure money.
    if (p.conversation_tags.includes("money") && !p.conversation_tags.includes("fun")) {
      return false;
    }
  }
  return true;
}

function idsRelated(a: string, b: string): boolean {
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function isLibraryAnswered(
  followUpId: string | null | undefined,
  answeredIds: string[] | undefined,
): boolean {
  if (!followUpId || !answeredIds?.length) return false;
  return answeredIds.some((id) => idsRelated(id, followUpId));
}

/**
 * Build a stable session item list. Caller persists it so refresh does not reshuffle.
 */
export function buildConversationSession(
  input: SessionBuilderInput,
): BuiltSessionItem[] {
  const skipAnswered = input.includeUnansweredOnly !== false;

  if (input.babymoonRound) {
    const prompts = getBabymoonRoundPrompts(input.babymoonRound).filter((p) => {
      if (!skipAnswered) return true;
      return !isLibraryAnswered(
        p.follow_up_open_question_id,
        input.answeredLibraryQuestionIds,
      );
    });
    // If filtering emptied the round (everything already answered), keep originals
    // so Start-again / revisit still works — UI labels them Previously answered.
    const list =
      prompts.length > 0
        ? prompts
        : getBabymoonRoundPrompts(input.babymoonRound);
    return list.map((p, i) => ({
      prompt_id: p.id,
      source_question_id: p.follow_up_open_question_id,
      item_type: p.response_type,
      energy: energyLevelToStore(p.conversation_energy),
      estimated_time_seconds: p.estimated_time_seconds,
      display_order: i,
    }));
  }

  const mode = getConversationMode(input.mode);
  const modeTopics = new Set(mode.topics);
  const mix = suggestedMix(input.plannedMinutes || mode.default_planned_minutes);
  const budget = targetSeconds(input.plannedMinutes || mode.default_planned_minutes);

  let pool = [...getActiveQuickPrompts(), ...BABYMOON_INLINE_PROMPTS].filter(
    (p) => isAllowedForMode(p, input.mode, mode.hide_future_stages),
  );
  // Dedupe by id (inline prompts may overlap conceptually with bank).
  const seen = new Set<string>();
  pool = pool.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  if (skipAnswered && input.answeredLibraryQuestionIds?.length) {
    pool = pool.filter(
      (p) =>
        !isLibraryAnswered(
          p.follow_up_open_question_id,
          input.answeredLibraryQuestionIds,
        ),
    );
  }

  if (input.mode === "babymoon") {
    // Prefer babymoon-tagged prompts first.
    pool = [...pool].sort((a, b) => {
      const at = a.session_tags.includes(BABYMOON_SET_TAG) ? 1 : 0;
      const bt = b.session_tags.includes(BABYMOON_SET_TAG) ? 1 : 0;
      return bt - at;
    });
  }

  const ranked = [...pool].sort(
    (a, b) => scorePrompt(b, input, modeTopics) - scorePrompt(a, input, modeTopics),
  );

  const picked: ConversationPromptDef[] = [];
  const usedTopics: string[] = [];
  let usedSeconds = 0;
  let lightning = 0;
  let coffee = 0;
  let big = 0;
  let planning = 0;
  let lastEnergy: ConversationEnergyLevel | null = null;

  const canTake = (p: ConversationPromptDef): boolean => {
    if (picked.some((x) => x.id === p.id)) return false;
    if (usedSeconds + p.estimated_time_seconds > budget + 60) return false;

    const topic = p.topic;
    const recentSame = usedTopics.slice(-2).filter((t) => t === topic).length;
    if (input.mode !== "deep_dive" && recentSame >= 2) return false;

    if (
      lastEnergy === "big_conversation" &&
      p.conversation_energy === "big_conversation"
    ) {
      return false;
    }

    if (p.conversation_energy === "lightning" && lightning >= mix.lightning) {
      return false;
    }
    if (p.conversation_energy === "coffee" && coffee >= mix.coffee) return false;
    if (p.conversation_energy === "big_conversation" && big >= mix.big) {
      return false;
    }
    if (p.conversation_energy === "planning" && planning >= mix.planning) {
      return false;
    }
    return true;
  };

  // Fill by energy preference order to avoid clustering heavy items.
  const energyOrder: ConversationEnergyLevel[] = [
    "lightning",
    "coffee",
    "lightning",
    "coffee",
    "big_conversation",
    "lightning",
    "planning",
  ];

  for (const energy of energyOrder) {
    for (const p of ranked) {
      if (p.conversation_energy !== energy) continue;
      if (!canTake(p)) continue;
      picked.push(p);
      usedSeconds += p.estimated_time_seconds;
      usedTopics.push(p.topic);
      lastEnergy = p.conversation_energy;
      if (p.conversation_energy === "lightning") lightning += 1;
      if (p.conversation_energy === "coffee") coffee += 1;
      if (p.conversation_energy === "big_conversation") big += 1;
      if (p.conversation_energy === "planning") planning += 1;
      if (usedSeconds >= budget * 0.9) break;
    }
    if (usedSeconds >= budget * 0.9) break;
  }

  // Fill remaining budget — relax mix caps so sessions are not tiny when
  // the curated bank is mostly Lightning prompts.
  const canTakeRelaxed = (p: ConversationPromptDef): boolean => {
    if (picked.some((x) => x.id === p.id)) return false;
    if (usedSeconds + p.estimated_time_seconds > budget + 90) return false;
    const topic = p.topic;
    const recentSame = usedTopics.slice(-2).filter((t) => t === topic).length;
    if (input.mode !== "deep_dive" && recentSame >= 2) return false;
    if (
      lastEnergy === "big_conversation" &&
      p.conversation_energy === "big_conversation"
    ) {
      return false;
    }
    return true;
  };

  for (const p of ranked) {
    if (usedSeconds >= budget * 0.95) break;
    if (!canTakeRelaxed(p)) continue;
    picked.push(p);
    usedSeconds += p.estimated_time_seconds;
    usedTopics.push(p.topic);
    lastEnergy = p.conversation_energy;
  }

  if (picked.length === 0 && ranked[0]) {
    picked.push(ranked[0]);
  }

  return picked.map((p, i) => ({
    prompt_id: p.id,
    source_question_id: p.follow_up_open_question_id,
    item_type: p.response_type,
    energy: energyLevelToStore(p.conversation_energy),
    estimated_time_seconds: p.estimated_time_seconds,
    display_order: i,
  }));
}

export function describeEnergyMix(items: BuiltSessionItem[]): string {
  const counts = { light: 0, medium: 0, deep: 0, planning: 0 };
  for (const item of items) counts[item.energy] += 1;
  const parts: string[] = [];
  if (counts.light) parts.push(`${counts.light} Lightning`);
  if (counts.medium) parts.push(`${counts.medium} Coffee Discussions`);
  if (counts.deep) parts.push(`${counts.deep} Big Conversations`);
  if (counts.planning) parts.push(`${counts.planning} Planning`);
  const mins = Math.round(
    items.reduce((s, i) => s + i.estimated_time_seconds, 0) / 60,
  );
  return `${parts.join(" · ") || "No items"} · About ${mins} minutes`;
}

export function promptForItem(promptId: string): ConversationPromptDef | undefined {
  return resolveConversationPrompt(promptId);
}
