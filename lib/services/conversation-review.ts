/**
 * Read-first conversation session review.
 * Answering uses /conversations/session/[id].
 * Reviewing uses /conversations/session/[id]/review.
 */

import type {
  AppStore,
  ConversationDifference,
  ConversationQuickAnswer,
  ConversationSession,
  ConversationSessionItem,
} from "@/lib/types/models";
import { resolveConversationPrompt } from "@/lib/conversations/babymoon-set";
import { formatApproximateActiveTime } from "@/lib/conversations/timing";
import {
  evaluateSessionCompletion,
  parseBabymoonRound,
} from "@/lib/services/round-status";
import { conversationItemIsComplete } from "@/lib/services/answered-status";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";
import { resolveLibraryQuestionId } from "@/lib/conversations/deep-link";

function isQaRecord(row: {
  is_test_data?: boolean;
  test_run_id?: string | null;
}): boolean {
  return Boolean(row.is_test_data || row.test_run_id);
}

export function formatQuickAnswerText(
  answer: ConversationQuickAnswer | undefined | null,
): string | null {
  if (!answer) return null;
  if (answer.short_text?.trim()) return answer.short_text.trim();
  if (answer.selected_options?.length) {
    return answer.selected_options.join(", ");
  }
  if (answer.scale != null) return String(answer.scale);
  return null;
}

export function isSessionIncomplete(session: ConversationSession): boolean {
  return session.status === "active" || session.status === "paused";
}

export function sessionReviewHref(sessionId: string): string {
  return `/conversations/session/${sessionId}/review`;
}

export function sessionFlowHref(sessionId: string): string {
  return `/conversations/session/${sessionId}`;
}

export function sessionPrimaryHref(session: ConversationSession): string {
  return isSessionIncomplete(session)
    ? sessionFlowHref(session.id)
    : sessionReviewHref(session.id);
}

export type AnswerPreviewKind =
  | "shared"
  | "different"
  | "single"
  | "discuss_later"
  | "research"
  | "provider"
  | "undecided"
  | "skipped"
  | "empty";

export type AnswerPreview = {
  kind: AnswerPreviewKind;
  label: string;
  sharedText: string | null;
  samText: string | null;
  michelleText: string | null;
  snippet: string;
};

export function buildAnswerPreview(input: {
  item: ConversationSessionItem;
  sam?: ConversationQuickAnswer;
  michelle?: ConversationQuickAnswer;
  shared?: ConversationQuickAnswer;
  difference?: ConversationDifference;
}): AnswerPreview {
  const { item, sam, michelle, shared, difference } = input;
  const samText = formatQuickAnswerText(sam);
  const michelleText = formatQuickAnswerText(michelle);
  const sharedText = formatQuickAnswerText(shared);

  if (item.status === "discuss_later") {
    return {
      kind: "discuss_later",
      label: "Discuss later",
      sharedText,
      samText,
      michelleText,
      snippet: "Discuss later",
    };
  }
  if (item.status === "needs_follow_up") {
    return {
      kind: "provider",
      label: "Waiting for provider",
      sharedText,
      samText,
      michelleText,
      snippet: "Waiting for provider",
    };
  }
  if (item.status === "undecided") {
    return {
      kind: "undecided",
      label: "Undecided",
      sharedText,
      samText,
      michelleText,
      snippet: "Undecided",
    };
  }
  if (item.status === "skipped") {
    return {
      kind: "skipped",
      label: "Skipped",
      sharedText,
      samText,
      michelleText,
      snippet: "Skipped",
    };
  }
  if (sharedText) {
    return {
      kind: "shared",
      label: "Shared decision",
      sharedText,
      samText,
      michelleText,
      snippet: sharedText.length > 100 ? `${sharedText.slice(0, 97)}…` : sharedText,
    };
  }
  if (
    item.status === "answered_different" ||
    difference?.resolution_status === "kept_separate" ||
    (samText && michelleText && samText !== michelleText)
  ) {
    return {
      kind: "different",
      label: "Different views",
      sharedText,
      samText,
      michelleText,
      snippet: [
        samText ? `Sam: ${samText}` : null,
        michelleText ? `Michelle: ${michelleText}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (samText || michelleText) {
    const text = sharedText ?? samText ?? michelleText ?? "";
    return {
      kind: "single",
      label: samText && michelleText ? "Both answered" : "Answered",
      sharedText,
      samText,
      michelleText,
      snippet: text.length > 100 ? `${text.slice(0, 97)}…` : text,
    };
  }
  return {
    kind: "empty",
    label: "No answer text",
    sharedText: null,
    samText: null,
    michelleText: null,
    snippet: "—",
  };
}

export type ReviewCardLinks = {
  canonicalQuestionHref: string | null;
  essentialsScreenHref: string | null;
  checklistHref: string | null;
  researchHref: string | null;
  booksHref: string | null;
  providerHref: string | null;
  relatedConversationHrefs: Array<{ id: string; title: string; href: string }>;
  editAnswerHref: string;
  copyPath: string;
};

export type ConversationReviewCard = {
  itemId: string;
  promptId: string;
  promptText: string;
  answerType: string;
  status: ConversationSessionItem["status"];
  statusLabel: string;
  samAnswer: string | null;
  michelleAnswer: string | null;
  sharedAnswer: string | null;
  samNotes: string | null;
  michelleNotes: string | null;
  createdAt: string;
  updatedAt: string;
  discussLater: boolean;
  waitingProvider: boolean;
  needsResearch: boolean;
  keepSeparate: boolean;
  resolved: boolean;
  preview: AnswerPreview;
  links: ReviewCardLinks;
  taskCount: number;
};

export type ConversationTimelineEvent = {
  id: string;
  label: string;
  at: string;
  kind: "started" | "decision" | "task" | "completed" | "activity";
};

export type ConversationReviewModel = {
  session: ConversationSession;
  incomplete: boolean;
  round: 1 | 2 | 3 | null;
  title: string;
  statusLabel: string;
  completedAt: string | null;
  participants: string[];
  durationLabel: string;
  questionsAnswered: number;
  itemCount: number;
  sharedDecisions: number;
  openFollowUps: number;
  cards: ConversationReviewCard[];
  timeline: ConversationTimelineEvent[];
  tasks: Array<{ id: string; title: string; href: string }>;
  summaryHref: string;
  flowHref: string;
  reviewHref: string;
};

const STATUS_LABELS: Record<ConversationSessionItem["status"], string> = {
  pending: "Pending",
  opened: "Opened",
  answered_same: "Same answer",
  answered_different: "Different answers",
  shared_answer_saved: "Shared answer",
  undecided: "Undecided",
  discuss_later: "Discuss later",
  skipped: "Skipped",
  needs_follow_up: "Needs follow-up",
};

function essentialsHrefForQuestion(questionId: string): string | null {
  const screen = ESSENTIALS_SCREENS.find(
    (s) =>
      s.question_id === questionId ||
      s.paired_question_ids?.includes(questionId),
  );
  return screen ? `/questions/before-birth/screen/${screen.id}` : null;
}

export function buildConversationReview(
  store: AppStore,
  sessionId: string,
): ConversationReviewModel | null {
  const session = (store.conversation_sessions ?? []).find(
    (s) => s.id === sessionId,
  );
  if (!session) return null;

  const items = (store.conversation_session_items ?? [])
    .filter((i) => i.session_id === sessionId)
    .sort((a, b) => a.display_order - b.display_order);
  const answers = (store.conversation_quick_answers ?? []).filter(
    (a) => a.session_id === sessionId && !isQaRecord(a),
  );
  const differences = (store.conversation_differences ?? []).filter(
    (d) => d.session_id === sessionId && !isQaRecord(d),
  );
  const eval_ = evaluateSessionCompletion(store, session);
  const incomplete = isSessionIncomplete(session);
  const round = parseBabymoonRound(session.session_tag);

  const tasks = (store.checklist_tasks ?? [])
    .filter(
      (t) =>
        !t.archived &&
        (t.linked_conversation_ids?.includes(sessionId) ||
          items.some((i) =>
            t.linked_question_ids?.includes(
              resolveConversationPrompt(i.prompt_id)?.follow_up_open_question_id ??
                "",
            ),
          )),
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      href: `/before-baby?task=${t.id}`,
    }));

  const cards: ConversationReviewCard[] = items.map((item) => {
    const prompt = resolveConversationPrompt(item.prompt_id);
    const itemAnswers = answers.filter((a) => a.session_item_id === item.id);
    const sam = itemAnswers.find((a) => a.actor === "sam");
    const michelle = itemAnswers.find((a) => a.actor === "michelle");
    const shared = itemAnswers.find((a) => a.actor === "shared");
    const difference = differences.find((d) => d.prompt_id === item.prompt_id);
    const preview = buildAnswerPreview({
      item,
      sam,
      michelle,
      shared,
      difference,
    });

    const deepRaw =
      prompt?.follow_up_open_question_id ?? item.source_question_id;
    const deepId = deepRaw
      ? resolveLibraryQuestionId(deepRaw, store.questions)
      : null;
    const deepQuestion = deepId
      ? store.questions.find((q) => q.id === deepId)
      : null;

    const needsResearch = deepId
      ? (store.answers ?? []).some(
          (a) =>
            !isQaRecord(a) &&
            a.question_id === deepId &&
            (a.needs_research || a.status === "needs_research"),
        )
      : false;

    const related = (store.conversation_sessions ?? [])
      .filter(
        (s) =>
          s.id !== sessionId &&
          !isQaRecord(s) &&
          (store.conversation_session_items ?? []).some(
            (i) =>
              i.session_id === s.id &&
              (i.prompt_id === item.prompt_id ||
                (deepId &&
                  resolveConversationPrompt(i.prompt_id)
                    ?.follow_up_open_question_id === deepId)),
          ),
      )
      .slice(0, 4)
      .map((s) => ({
        id: s.id,
        title: s.title,
        href: sessionPrimaryHref(s),
      }));

    const cardTasks = tasks.filter((t) =>
      (store.checklist_tasks ?? [])
        .find((x) => x.id === t.id)
        ?.linked_question_ids?.some(
          (qid) => qid === deepId || qid === item.prompt_id,
        ),
    );

    const reviewPath = `${sessionReviewHref(sessionId)}#card-${item.id}`;

    return {
      itemId: item.id,
      promptId: item.prompt_id,
      promptText: prompt?.prompt ?? item.prompt_id,
      answerType: prompt?.response_type ?? item.item_type,
      status: item.status,
      statusLabel: STATUS_LABELS[item.status],
      samAnswer: formatQuickAnswerText(sam),
      michelleAnswer: formatQuickAnswerText(michelle),
      sharedAnswer: formatQuickAnswerText(shared),
      samNotes: sam?.explanation?.trim() || null,
      michelleNotes: michelle?.explanation?.trim() || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      discussLater: item.status === "discuss_later",
      waitingProvider: item.status === "needs_follow_up",
      needsResearch,
      keepSeparate: difference?.resolution_status === "kept_separate",
      resolved:
        difference?.resolution_status === "shared_answer_created" ||
        item.status === "shared_answer_saved" ||
        item.status === "answered_same",
      preview,
      taskCount: cardTasks.length,
      links: {
        canonicalQuestionHref: deepQuestion
          ? `/questions/${deepQuestion.slug}`
          : null,
        essentialsScreenHref: deepId ? essentialsHrefForQuestion(deepId) : null,
        checklistHref: cardTasks[0]?.href ?? (tasks[0]?.href ?? null),
        researchHref: deepId
          ? `/research?question=${encodeURIComponent(deepId)}`
          : "/research",
        booksHref: "/research",
        providerHref: item.status === "needs_follow_up" ? reviewPath : null,
        relatedConversationHrefs: related,
        editAnswerHref: `${sessionFlowHref(sessionId)}?item=${item.id}`,
        copyPath: reviewPath,
      },
    };
  });

  const answeredCards = cards.filter((c) =>
    conversationItemIsComplete(c.status) || c.status === "needs_follow_up",
  );

  const timeline: ConversationTimelineEvent[] = [
    {
      id: "started",
      label: "Started",
      at: session.started_at,
      kind: "started",
    },
  ];
  for (const c of answeredCards.filter((x) => x.sharedAnswer)) {
    timeline.push({
      id: `decision-${c.itemId}`,
      label: `Shared decision: ${c.promptText.slice(0, 60)}`,
      at: c.updatedAt,
      kind: "decision",
    });
  }
  for (const t of tasks) {
    const row = (store.checklist_tasks ?? []).find((x) => x.id === t.id);
    timeline.push({
      id: `task-${t.id}`,
      label: `Task created: ${t.title}`,
      at: row?.created_at ?? session.updated_at,
      kind: "task",
    });
  }
  if (session.completed_at) {
    timeline.push({
      id: "completed",
      label: "Completed",
      at: session.completed_at,
      kind: "completed",
    });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const actors = new Set(
    answers.map((a) => a.actor).filter((a) => a === "sam" || a === "michelle"),
  );
  const participants = [
    actors.has("sam") ? "Sam" : null,
    actors.has("michelle") ? "Michelle" : null,
  ].filter(Boolean) as string[];
  if (!participants.length) participants.push("Family");

  const statusLabel = incomplete
    ? eval_.status === "in_progress"
      ? "In progress"
      : "Not started"
    : session.status === "completed_with_followups"
      ? "Completed"
      : session.status === "completed"
        ? "Completed"
        : session.status;

  return {
    session,
    incomplete,
    round,
    title: round ? `Babymoon Round ${round}` : session.title,
    statusLabel,
    completedAt: session.completed_at,
    participants,
    durationLabel: formatApproximateActiveTime(session.active_seconds),
    questionsAnswered: answeredCards.length,
    itemCount: items.length,
    sharedDecisions: cards.filter((c) => Boolean(c.sharedAnswer)).length,
    openFollowUps: eval_.openFollowupCount,
    cards,
    timeline,
    tasks,
    summaryHref: `/conversations/session/${sessionId}/summary`,
    flowHref: sessionFlowHref(sessionId),
    reviewHref: sessionReviewHref(sessionId),
  };
}

export type ConversationPromptListFilter =
  | "all"
  | "shared"
  | "different"
  | "discuss_later"
  | "research"
  | "provider"
  | "babymoon"
  | "date_night"
  | "morning_coffee"
  | "deep_dive"
  | "completed";

export type ConversationPromptListRow = {
  id: string;
  promptId: string;
  prompt: string;
  round: number | null;
  date: string;
  participants: string;
  preview: AnswerPreview;
  statusLabel: string;
  mode: string;
  sessionId: string;
  sessionCompleted: boolean;
  href: string;
  searchBlob: string;
};

export function listConversationPromptReviewRows(
  store: AppStore,
): ConversationPromptListRow[] {
  const sessions = new Map(
    (store.conversation_sessions ?? [])
      .filter((s) => !isQaRecord(s))
      .map((s) => [s.id, s]),
  );
  const rows: ConversationPromptListRow[] = [];

  for (const item of store.conversation_session_items ?? []) {
    const session = sessions.get(item.session_id);
    if (!session) continue;
    if (!conversationItemIsComplete(item.status)) {
      continue;
    }
    const prompt = resolveConversationPrompt(item.prompt_id);
    const answers = (store.conversation_quick_answers ?? []).filter(
      (a) => a.session_item_id === item.id && !isQaRecord(a),
    );
    const sam = answers.find((a) => a.actor === "sam");
    const michelle = answers.find((a) => a.actor === "michelle");
    const shared = answers.find((a) => a.actor === "shared");
    const difference = (store.conversation_differences ?? []).find(
      (d) =>
        d.session_id === session.id &&
        d.prompt_id === item.prompt_id &&
        !isQaRecord(d),
    );
    const preview = buildAnswerPreview({
      item,
      sam,
      michelle,
      shared,
      difference,
    });
    const promptText = prompt?.prompt ?? item.prompt_id;
    const completed = !isSessionIncomplete(session);
    const actors = [
      ...new Set(
        answers
          .map((a) => a.actor)
          .filter((a) => a === "sam" || a === "michelle" || a === "shared"),
      ),
    ].join(", ");

    rows.push({
      id: item.id,
      promptId: item.prompt_id,
      prompt: promptText,
      round: parseBabymoonRound(session.session_tag),
      date: item.updated_at || item.created_at,
      participants: actors || "—",
      preview,
      statusLabel: STATUS_LABELS[item.status],
      mode: session.mode,
      sessionId: session.id,
      sessionCompleted: completed,
      href: `${sessionPrimaryHref(session)}#card-${item.id}`,
      searchBlob: [
        promptText,
        preview.snippet,
        preview.sharedText,
        preview.samText,
        preview.michelleText,
        sam?.explanation,
        michelle?.explanation,
        session.title,
        session.mode,
        item.status,
        prompt?.conversation_tags?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function filterConversationPromptRows(
  rows: ConversationPromptListRow[],
  opts: { q?: string; filter?: ConversationPromptListFilter },
): ConversationPromptListRow[] {
  let next = rows;
  const filter = opts.filter ?? "all";
  if (filter === "shared") {
    next = next.filter((r) => r.preview.kind === "shared");
  } else if (filter === "different") {
    next = next.filter((r) => r.preview.kind === "different");
  } else if (filter === "discuss_later") {
    next = next.filter((r) => r.preview.kind === "discuss_later");
  } else if (filter === "research") {
    next = next.filter((r) => r.preview.kind === "research");
  } else if (filter === "provider") {
    next = next.filter((r) => r.preview.kind === "provider");
  } else if (filter === "babymoon") {
    next = next.filter((r) => r.mode === "babymoon");
  } else if (filter === "date_night") {
    next = next.filter((r) => r.mode === "date_night");
  } else if (filter === "morning_coffee") {
    next = next.filter((r) => r.mode === "morning_coffee");
  } else if (filter === "deep_dive") {
    next = next.filter((r) => r.mode === "deep_dive");
  } else if (filter === "completed") {
    next = next.filter((r) => r.sessionCompleted);
  }

  const q = opts.q?.trim().toLowerCase();
  if (q) {
    next = next.filter((r) => r.searchBlob.includes(q));
  }
  return next;
}

export function exportConversationReviewMarkdown(
  model: ConversationReviewModel,
): string {
  const lines: string[] = [
    `# ${model.title}`,
    "",
    `- Status: ${model.statusLabel}`,
    `- Completed: ${model.completedAt ?? "—"}`,
    `- Participants: ${model.participants.join(", ")}`,
    `- Duration: ${model.durationLabel}`,
    `- Answered: ${model.questionsAnswered} of ${model.itemCount}`,
    `- Shared decisions: ${model.sharedDecisions}`,
    `- Open follow-ups: ${model.openFollowUps}`,
    "",
    "## Timeline",
    "",
  ];
  for (const ev of model.timeline) {
    lines.push(`- ${ev.at}: ${ev.label}`);
  }
  lines.push("", "## Answers", "");
  for (const card of model.cards) {
    lines.push(`### ${card.promptText}`);
    lines.push("");
    lines.push(`- Type: ${card.answerType}`);
    lines.push(`- Status: ${card.statusLabel}`);
    if (card.samAnswer) lines.push(`- Sam: ${card.samAnswer}`);
    if (card.michelleAnswer) lines.push(`- Michelle: ${card.michelleAnswer}`);
    if (card.sharedAnswer) lines.push(`- Shared: ${card.sharedAnswer}`);
    if (card.samNotes) lines.push(`- Sam notes: ${card.samNotes}`);
    if (card.michelleNotes) {
      lines.push(`- Michelle notes: ${card.michelleNotes}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function exportConversationReviewJson(
  model: ConversationReviewModel,
): string {
  return JSON.stringify(
    {
      sessionId: model.session.id,
      title: model.title,
      status: model.session.status,
      completedAt: model.completedAt,
      participants: model.participants,
      duration: model.durationLabel,
      questionsAnswered: model.questionsAnswered,
      sharedDecisions: model.sharedDecisions,
      openFollowUps: model.openFollowUps,
      timeline: model.timeline,
      cards: model.cards.map((c) => ({
        promptId: c.promptId,
        prompt: c.promptText,
        answerType: c.answerType,
        status: c.status,
        sam: c.samAnswer,
        michelle: c.michelleAnswer,
        shared: c.sharedAnswer,
        samNotes: c.samNotes,
        michelleNotes: c.michelleNotes,
        updatedAt: c.updatedAt,
      })),
      tasks: model.tasks,
    },
    null,
    2,
  );
}

export function exportConversationReviewHtml(
  model: ConversationReviewModel,
): string {
  const md = exportConversationReviewMarkdown(model)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${model.title}</title>
<style>body{font-family:Georgia,serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5;white-space:pre-wrap}</style>
</head><body>${md}</body></html>`;
}
