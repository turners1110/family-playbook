import type { AppStore } from "@/lib/types/models";
import {
  CONVERSATION_RESPONSE_TYPES,
  type ConversationResponseType,
} from "@/lib/conversations/response-types";
import {
  countQuickToDeepLinks,
  getActiveQuickPrompts,
} from "@/lib/conversations/quick-prompts";
import { CONVERSATION_MODES } from "@/lib/conversations/modes";
import { BABYMOON_ROUNDS, BABYMOON_SET_TAG } from "@/lib/conversations/babymoon-set";
import { ESSENTIALS_COMPANIONS } from "@/lib/conversations/companions";
import { FIXED_OPTION_QUESTION_IDS } from "@/lib/conversations/ensure-options";

export function buildConversationReviewMetrics(store: AppStore) {
  const prompts = getActiveQuickPrompts();
  const byType = Object.fromEntries(
    CONVERSATION_RESPONSE_TYPES.map((t) => [t, 0]),
  ) as Record<ConversationResponseType, number>;
  const byEnergy: Record<string, number> = {};

  for (const p of prompts) {
    byType[p.response_type] += 1;
    byEnergy[p.conversation_energy] = (byEnergy[p.conversation_energy] ?? 0) + 1;
  }

  const withEstimate = prompts.filter((p) => p.estimated_time_seconds > 0).length;
  const withoutDeep = prompts.filter((p) => !p.follow_up_open_question_id).length;
  const deepWithoutCompanion = ESSENTIALS_COMPANIONS.length; // companions curated

  const sessions = (store.conversation_sessions ?? []).filter((s) => !s.is_test_data);
  const items = (store.conversation_session_items ?? []).filter((i) => !i.is_test_data);
  const diffs = (store.conversation_differences ?? []).filter((d) => !d.is_test_data);

  const avgActive =
    sessions.length === 0
      ? 0
      : Math.round(
          sessions.reduce((s, x) => s + x.active_seconds, 0) / sessions.length,
        );

  const emptyOptionViolations = FIXED_OPTION_QUESTION_IDS.filter((qid) => {
    const opts = store.question_options.filter((o) => o.question_id === qid);
    return opts.length === 0;
  });

  return {
    response_types: byType,
    quick_prompt_count: prompts.length,
    either_or_count: byType.either_or,
    short_text_count: byType.short_text,
    energy_distribution: byEnergy,
    estimated_time_coverage: {
      with_estimate: withEstimate,
      total: prompts.length,
      percent: prompts.length
        ? Math.round((withEstimate / prompts.length) * 100)
        : 0,
    },
    quick_to_deep_links: countQuickToDeepLinks(),
    quick_prompts_without_deep_links: withoutDeep,
    deep_companions_curated: deepWithoutCompanion,
    conversation_modes: CONVERSATION_MODES.map((m) => m.id),
    session_tags: [
      BABYMOON_SET_TAG,
      ...CONVERSATION_MODES.map((m) => m.session_tag).filter(Boolean),
    ],
    babymoon_rounds: BABYMOON_ROUNDS.length,
    empty_answer_option_violations: emptyOptionViolations,
    actual_session_timing_aggregates: {
      session_count: sessions.length,
      item_count: items.length,
      average_active_seconds: avgActive,
      total_active_seconds: sessions.reduce((s, x) => s + x.active_seconds, 0),
    },
    difference_resolution_counts: diffs.reduce(
      (acc, d) => {
        acc[d.resolution_status] = (acc[d.resolution_status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}
