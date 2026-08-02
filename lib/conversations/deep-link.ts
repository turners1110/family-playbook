import {
  getEssentialsScreenByQuestionId,
  type EssentialsScreenDef,
} from "@/lib/essentials/pathway";
import { getActiveQuickPrompts } from "@/lib/conversations/quick-prompts";
import { getBabymoonRoundPrompts } from "@/lib/conversations/babymoon-set";
import {
  getQaQuestion,
  isQaQuestionId,
  QA_QUESTIONS,
} from "@/lib/qa/question-pack";
import type { ConversationPromptDef } from "@/lib/conversations/response-types";

export type DeepTargetType =
  | "normal_question"
  | "essentials_screen"
  | "essentials_grouped"
  | "qa_deep"
  | "unavailable";

export type DeepQuestionTarget = {
  type: DeepTargetType;
  /** Null when unavailable — never navigate. */
  href: string | null;
  questionId: string | null;
  screenId?: string;
  slug?: string;
  exists: boolean;
  reason?: string;
};

export type ResolveDeepQuestionInput = {
  questionId: string | null | undefined;
  sessionId?: string | null;
  sessionItemId?: string | null;
  testRunId?: string | null;
  returnTo?: string | null;
  /** Library questions for slug resolution. */
  questions?: ReadonlyArray<{ id: string; slug: string }>;
};

function buildReturnQuery(input: ResolveDeepQuestionInput): string {
  const q = new URLSearchParams();
  q.set("source", "conversation");
  if (input.returnTo) q.set("returnTo", input.returnTo);
  else if (input.testRunId) {
    q.set("returnTo", `/conversations/test/${input.testRunId}`);
  } else if (input.sessionId) {
    q.set("returnTo", `/conversations/session/${input.sessionId}`);
  }
  if (input.sessionId) q.set("sessionId", input.sessionId);
  if (input.sessionItemId) q.set("sessionItemId", input.sessionItemId);
  if (input.testRunId) q.set("testRunId", input.testRunId);
  // Legacy keys still read by Essentials deep pages
  if (input.sessionId) q.set("fromSession", input.sessionId);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

function essentialsType(
  screen: EssentialsScreenDef,
  questionId: string,
): "essentials_screen" | "essentials_grouped" {
  if (
    screen.question_id !== questionId &&
    screen.paired_question_ids?.includes(questionId)
  ) {
    return "essentials_grouped";
  }
  return "essentials_screen";
}

/**
 * Canonical quick→deep resolver. UI must not build deep hrefs ad hoc.
 */
export function resolveDeepQuestionTarget(
  input: ResolveDeepQuestionInput,
): DeepQuestionTarget {
  const questionId = input.questionId?.trim() || null;
  if (!questionId) {
    return {
      type: "unavailable",
      href: null,
      questionId: null,
      exists: false,
      reason: "No follow-up question linked.",
    };
  }

  const qs = buildReturnQuery(input);

  // QA test questions stay inside the QA route — never /questions/[slug].
  if (isQaQuestionId(questionId)) {
    const qa = getQaQuestion(questionId);
    if (!qa) {
      console.info("[deep_link]", {
        operation: "resolveDeepQuestionTarget",
        questionId,
        result: "unavailable",
        reason: "unknown_qa_id",
        testRunId: input.testRunId ?? null,
      });
      return {
        type: "unavailable",
        href: null,
        questionId,
        exists: false,
        reason: "QA deep question is not in the test pack.",
      };
    }
    if (!input.testRunId) {
      console.info("[deep_link]", {
        operation: "resolveDeepQuestionTarget",
        questionId,
        result: "unavailable",
        reason: "missing_test_run_id",
      });
      return {
        type: "unavailable",
        href: null,
        questionId,
        exists: true,
        reason: "QA deep questions require a test run context.",
      };
    }
    return {
      type: "qa_deep",
      href: `/conversations/test/${input.testRunId}/deep/${questionId}${qs}`,
      questionId,
      exists: true,
    };
  }

  const screen = getEssentialsScreenByQuestionId(questionId);
  if (screen) {
    const type = essentialsType(screen, questionId);
    return {
      type,
      href: `/questions/before-birth/screen/${screen.id}${qs}`,
      questionId,
      screenId: screen.id,
      exists: true,
    };
  }

  const question = input.questions?.find((q) => q.id === questionId);
  if (question?.slug) {
    // Never put a raw question ID into the slug route.
    if (question.slug === questionId && questionId.startsWith("q_")) {
      console.info("[deep_link]", {
        operation: "resolveDeepQuestionTarget",
        questionId,
        result: "unavailable",
        reason: "slug_equals_raw_id",
      });
      return {
        type: "unavailable",
        href: null,
        questionId,
        exists: true,
        reason: "Question slug is missing; cannot open library route.",
      };
    }
    return {
      type: "normal_question",
      href: `/questions/${question.slug}${qs}`,
      questionId,
      slug: question.slug,
      exists: true,
    };
  }

  console.info("[deep_link]", {
    operation: "resolveDeepQuestionTarget",
    questionId,
    result: "unavailable",
    reason: "missing_question",
    sessionId: input.sessionId ?? null,
    testRunId: input.testRunId ?? null,
  });
  return {
    type: "unavailable",
    href: null,
    questionId,
    exists: false,
    reason: "Deeper discussion is not available yet.",
  };
}

export type QuickToDeepAuditRow = {
  promptId: string;
  promptSource: "quick" | "babymoon" | "qa";
  deepQuestionId: string;
  type: DeepTargetType;
  href: string | null;
  exists: boolean;
  screenId?: string;
  slug?: string;
  reason?: string;
};

export type QuickToDeepAuditReport = {
  total: number;
  valid_normal: number;
  valid_essentials: number;
  valid_essentials_grouped: number;
  valid_qa: number;
  unavailable: number;
  missing_question_ids: string[];
  missing_slugs: string[];
  invalid_routes: string[];
  grouped_screen_mappings: Array<{ promptId: string; screenId: string }>;
  rows: QuickToDeepAuditRow[];
};

function collectPrompts(): Array<{
  prompt: ConversationPromptDef;
  source: QuickToDeepAuditRow["promptSource"];
}> {
  const out: Array<{
    prompt: ConversationPromptDef;
    source: QuickToDeepAuditRow["promptSource"];
  }> = [];
  const seen = new Set<string>();

  for (const p of getActiveQuickPrompts()) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ prompt: p, source: "quick" });
  }
  for (const round of [1, 2, 3] as const) {
    for (const p of getBabymoonRoundPrompts(round)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ prompt: p, source: "babymoon" });
    }
  }
  for (const p of QA_QUESTIONS.filter((q) => q.active)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ prompt: p, source: "qa" });
  }
  return out;
}

/** Audit every active quick→deep mapping (for Test Lab + unit tests). */
export function auditQuickToDeepLinks(
  questions: ReadonlyArray<{ id: string; slug: string }> = [],
): QuickToDeepAuditReport {
  const rows: QuickToDeepAuditRow[] = [];
  const missing_question_ids: string[] = [];
  const missing_slugs: string[] = [];
  const invalid_routes: string[] = [];
  const grouped_screen_mappings: Array<{ promptId: string; screenId: string }> =
    [];

  for (const { prompt, source } of collectPrompts()) {
    const deepId = prompt.follow_up_open_question_id;
    if (!deepId) continue;

    const target = resolveDeepQuestionTarget({
      questionId: deepId,
      sessionId: "audit_session",
      sessionItemId: "audit_item",
      testRunId: source === "qa" || isQaQuestionId(deepId) ? "audit_run" : null,
      questions,
    });

    rows.push({
      promptId: prompt.id,
      promptSource: source,
      deepQuestionId: deepId,
      type: target.type,
      href: target.href,
      exists: target.exists,
      screenId: target.screenId,
      slug: target.slug,
      reason: target.reason,
    });

    if (target.type === "unavailable") {
      if (!target.exists) missing_question_ids.push(deepId);
      if (target.reason?.includes("slug")) missing_slugs.push(deepId);
      invalid_routes.push(`${prompt.id}→${deepId}`);
    }
    if (target.type === "essentials_grouped" && target.screenId) {
      grouped_screen_mappings.push({
        promptId: prompt.id,
        screenId: target.screenId,
      });
    }
    // Flag accidental raw-ID slug routes
    if (
      target.href?.startsWith("/questions/") &&
      !target.href.startsWith("/questions/before-birth/") &&
      target.slug == null
    ) {
      invalid_routes.push(`${prompt.id}→${deepId}:raw_id_slug`);
    }
  }

  return {
    total: rows.length,
    valid_normal: rows.filter((r) => r.type === "normal_question").length,
    valid_essentials: rows.filter((r) => r.type === "essentials_screen").length,
    valid_essentials_grouped: rows.filter((r) => r.type === "essentials_grouped")
      .length,
    valid_qa: rows.filter((r) => r.type === "qa_deep").length,
    unavailable: rows.filter((r) => r.type === "unavailable").length,
    missing_question_ids: [...new Set(missing_question_ids)],
    missing_slugs: [...new Set(missing_slugs)],
    invalid_routes,
    grouped_screen_mappings,
    rows,
  };
}

export function conversationReturnHref(input: {
  returnTo?: string | null;
  sessionId?: string | null;
  testRunId?: string | null;
}): string {
  if (input.returnTo?.startsWith("/")) return input.returnTo;
  if (input.testRunId) return `/conversations/test/${input.testRunId}`;
  if (input.sessionId) return `/conversations/session/${input.sessionId}`;
  return "/conversations";
}
