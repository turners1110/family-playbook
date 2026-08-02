import type { ConversationModeId } from "@/lib/types/models";
import type { ConversationPromptDef, ConversationTag } from "./response-types";
import { getActiveQuickPrompts } from "./quick-prompts";
import { getConversationMode } from "./modes";

export type MomentumSuggestion = {
  prompt_id: string;
  label: string;
  reason: string;
  topic: string;
};

const TOPIC_NEIGHBORS: Record<string, ConversationTag[]> = {
  visitors: ["privacy", "family", "holidays", "advice"],
  privacy: ["visitors", "family"],
  sleep: ["feeding", "partnership"],
  feeding: ["sleep", "partnership"],
  partnership: ["sleep", "advice", "values"],
  birth: ["visitors", "privacy", "feeding"],
  lulu: ["family", "partnership"],
  traditions: ["identity", "holidays", "fun"],
  identity: ["values", "traditions"],
  values: ["identity", "partnership"],
  fun: ["traditions", "identity"],
  advice: ["visitors", "partnership"],
  holidays: ["traditions", "visitors", "family"],
};

/**
 * Suggest up to three related next directions using curated tags — not keyword guessing.
 */
export function suggestMomentum(input: {
  current: ConversationPromptDef;
  mode: ConversationModeId;
  answeredIds: string[];
  remainingSeconds: number;
  sessionPromptIds: string[];
}): MomentumSuggestion[] {
  const mode = getConversationMode(input.mode);
  const answered = new Set(input.answeredIds);
  const inSession = new Set(input.sessionPromptIds);

  const primary = input.current.topic as ConversationTag;
  const neighbors = new Set<ConversationTag>([
    ...input.current.conversation_tags,
    ...(TOPIC_NEIGHBORS[primary] ?? []),
  ]);

  const candidates = getActiveQuickPrompts()
    .filter((p) => {
      if (answered.has(p.id)) return false;
      if (inSession.has(p.id)) return false;
      if (p.id === input.current.id) return false;
      if (mode.hide_future_stages && p.life_stage === "teen") return false;
      if (
        input.mode === "babymoon" &&
        p.conversation_tags.includes("money") &&
        !p.conversation_tags.includes("fun")
      ) {
        return false;
      }
      if (p.estimated_time_seconds > input.remainingSeconds + 45) return false;
      return p.conversation_tags.some((t) => neighbors.has(t));
    })
    .sort((a, b) => {
      const aScore = a.conversation_tags.filter((t) => neighbors.has(t)).length;
      const bScore = b.conversation_tags.filter((t) => neighbors.has(t)).length;
      return bScore - aScore;
    });

  // Prefer distinct topics.
  const out: MomentumSuggestion[] = [];
  const usedTopics = new Set<string>();
  for (const p of candidates) {
    if (usedTopics.has(p.topic)) continue;
    usedTopics.add(p.topic);
    out.push({
      prompt_id: p.id,
      label: p.prompt,
      reason: `Related to ${primary.replace(/_/g, " ")}`,
      topic: p.topic,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function momentumTopicLabels(current: ConversationPromptDef): string[] {
  const primary = current.topic;
  const neighbors = TOPIC_NEIGHBORS[primary] ?? [];
  return [primary, ...neighbors].slice(0, 3).map((t) =>
    t.replace(/_/g, " "),
  );
}
