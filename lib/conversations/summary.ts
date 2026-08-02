import type {
  ConversationDifference,
  ConversationQuickAnswer,
  ConversationSession,
  ConversationSessionItem,
  ConversationSessionSummary,
} from "@/lib/types/models";
import { resolveConversationPrompt } from "./babymoon-set";

function answerLabel(a: ConversationQuickAnswer): string {
  if (a.short_text) return a.short_text;
  if (a.selected_options.length) return a.selected_options.join(", ");
  if (a.scale != null) return String(a.scale);
  return "(no answer)";
}

export function buildSessionSummary(input: {
  session: ConversationSession;
  items: ConversationSessionItem[];
  answers: ConversationQuickAnswer[];
  differences: ConversationDifference[];
}): ConversationSessionSummary {
  const { session, items, answers, differences } = input;
  const agreed: string[] = [];
  const differed: string[] = [];
  const discussLater: string[] = [];
  let lightMoment: string | null = null;
  let tripMemory: string | null = null;

  for (const item of items) {
    const prompt = resolveConversationPrompt(item.prompt_id);
    const itemAnswers = answers.filter((a) => a.session_item_id === item.id);
    const sam = itemAnswers.find((a) => a.actor === "sam");
    const michelle = itemAnswers.find((a) => a.actor === "michelle");
    const shared = itemAnswers.find((a) => a.actor === "shared");

    if (item.status === "discuss_later") {
      discussLater.push(prompt?.prompt ?? item.prompt_id);
      continue;
    }

    if (prompt?.is_trip_memory) {
      tripMemory =
        shared?.short_text ||
        sam?.short_text ||
        michelle?.short_text ||
        tripMemory;
    }

    if (
      prompt?.conversation_energy === "lightning" &&
      !lightMoment &&
      (sam || michelle || shared)
    ) {
      lightMoment = prompt.prompt;
    }

    if (item.status === "answered_same" || item.status === "shared_answer_saved") {
      const text = shared
        ? answerLabel(shared)
        : sam
          ? answerLabel(sam)
          : michelle
            ? answerLabel(michelle)
            : null;
      if (text && prompt) {
        agreed.push(`${prompt.prompt}: ${text}`);
      }
    }

    if (item.status === "answered_different") {
      const diff = differences.find(
        (d) => d.prompt_id === item.prompt_id && d.session_id === session.id,
      );
      if (prompt) {
        differed.push(
          `${prompt.prompt} — Sam: ${diff?.sam_answer_snapshot ?? sam ? answerLabel(sam!) : "—"}; Michelle: ${diff?.michelle_answer_snapshot ?? (michelle ? answerLabel(michelle) : "—")}`,
        );
      }
    }
  }

  return {
    agreed: agreed.slice(0, 12),
    differed: differed.slice(0, 12),
    discuss_later: discussLater,
    tasks_suggested: [],
    provider_questions: [],
    light_moment: lightMoment,
    trip_memory: tripMemory,
    notes: null,
  };
}
