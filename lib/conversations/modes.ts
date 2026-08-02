import type { ConversationModeId } from "@/lib/types/models";
import type { ConversationEnergyLevel, ConversationTag } from "./response-types";

export type ConversationModeDef = {
  id: ConversationModeId;
  title: string;
  description: string;
  expected_minutes_label: string;
  default_planned_minutes: number;
  energy_mix: Partial<Record<ConversationEnergyLevel, number>>;
  topics: ConversationTag[];
  hide_future_stages: boolean;
  session_tag: string | null;
};

export const CONVERSATION_MODES: ConversationModeDef[] = [
  {
    id: "babymoon",
    title: "Babymoon",
    description:
      "Foundation, birth, first weeks, visitors, feeding, overnight roles, partnership, Lulu, and wrap-up memories.",
    expected_minutes_label: "15–45 minutes",
    default_planned_minutes: 15,
    energy_mix: { lightning: 4, coffee: 2, big_conversation: 1 },
    topics: [
      "warm_up",
      "identity",
      "birth",
      "visitors",
      "feeding",
      "sleep",
      "partnership",
      "lulu",
      "wrap_up",
    ],
    hide_future_stages: true,
    session_tag: "babymoon",
  },
  {
    id: "date_night",
    title: "Date Night",
    description:
      "Relationship, family identity, dreams, traditions, future memories, and fun choices.",
    expected_minutes_label: "20–45 minutes",
    default_planned_minutes: 30,
    energy_mix: { lightning: 3, coffee: 3, big_conversation: 1 },
    topics: ["identity", "traditions", "partnership", "fun", "values", "family"],
    hide_future_stages: true,
    session_tag: "date_night",
  },
  {
    id: "morning_coffee",
    title: "Morning Coffee",
    description:
      "Five to fifteen minutes. Mostly Lightning and Coffee prompts, with one optional deeper question.",
    expected_minutes_label: "5–15 minutes",
    default_planned_minutes: 10,
    energy_mix: { lightning: 4, coffee: 2, big_conversation: 0 },
    topics: ["warm_up", "identity", "partnership", "fun", "reflection"],
    hide_future_stages: true,
    session_tag: "morning_coffee",
  },
  {
    id: "airport",
    title: "Airport Mode",
    description:
      "Fast, easy to pause, mostly Lightning prompts. Built for short windows between flights.",
    expected_minutes_label: "5–10 minutes",
    default_planned_minutes: 5,
    energy_mix: { lightning: 5, coffee: 1 },
    topics: ["warm_up", "fun", "identity", "visitors", "privacy"],
    hide_future_stages: true,
    session_tag: "airport",
  },
  {
    id: "deep_dive",
    title: "Deep Dive",
    description:
      "One topic for 20–60 minutes, from a quick prompt through to a shared decision.",
    expected_minutes_label: "20–60 minutes",
    default_planned_minutes: 45,
    energy_mix: { lightning: 2, coffee: 2, big_conversation: 2, planning: 1 },
    topics: ["values", "birth", "visitors", "partnership", "sleep", "feeding"],
    hide_future_stages: false,
    session_tag: "deep_dive",
  },
  {
    id: "first_month",
    title: "First Month",
    description:
      "Postpartum recovery, sleep, feeding, visitors, workload, support, and Lulu adjustment.",
    expected_minutes_label: "15–40 minutes",
    default_planned_minutes: 20,
    energy_mix: { lightning: 3, coffee: 3, big_conversation: 1, planning: 1 },
    topics: [
      "sleep",
      "feeding",
      "visitors",
      "partnership",
      "lulu",
      "advice",
    ],
    hide_future_stages: true,
    session_tag: "first_month",
  },
  {
    id: "random_mix",
    title: "Random Mix",
    description:
      "A balanced mix that avoids recently completed questions and hidden future-stage topics.",
    expected_minutes_label: "10–30 minutes",
    default_planned_minutes: 15,
    energy_mix: { lightning: 4, coffee: 2, big_conversation: 1 },
    topics: [
      "warm_up",
      "identity",
      "partnership",
      "fun",
      "values",
      "traditions",
    ],
    hide_future_stages: true,
    session_tag: "random_mix",
  },
  {
    id: "qa_integrity",
    title: "QA Integrity Session",
    description:
      "Fixed test pack for storage integrity. Not shown in normal Conversation Modes.",
    expected_minutes_label: "Test run",
    default_planned_minutes: 45,
    energy_mix: { lightning: 10, coffee: 4 },
    topics: ["warm_up"],
    hide_future_stages: true,
    session_tag: "qa_integrity",
  },
];

export function getConversationMode(
  id: ConversationModeId,
): ConversationModeDef {
  const mode = CONVERSATION_MODES.find((m) => m.id === id);
  if (!mode) throw new Error(`Unknown conversation mode: ${id}`);
  return mode;
}

export const SESSION_LENGTH_OPTIONS = [
  { minutes: 5, label: "5 minutes" },
  { minutes: 10, label: "10 minutes" },
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "60 minutes" },
  { minutes: 0, label: "Continue until paused" },
] as const;
