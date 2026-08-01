import type { Answer, AppStore, Question } from "@/lib/types/models";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
  type QuestionAnswerStatus,
} from "@/lib/services/question-status";
import {
  ESSENTIALS_MODULES,
  ESSENTIALS_SCREENS,
  type ConditionalRule,
  type EssentialsScreenDef,
  estimatedMinutesRemaining,
  listPrimaryScreens,
  screensForModule,
} from "@/lib/essentials/pathway";

function choiceList(answer: Answer | undefined): string[] {
  if (!answer) return [];
  const c = answer.payload.choice;
  if (!c) return [];
  return Array.isArray(c) ? c : [c];
}

export function isScreenVisible(
  screen: EssentialsScreenDef,
  store: AppStore,
  sharedByQuestionId: Map<string, Answer>,
): boolean {
  const rule = screen.conditional;
  if (!rule) return true;
  const source = ESSENTIALS_SCREENS.find((s) => s.id === rule.source_screen_id);
  if (!source) return true;
  const shared = sharedByQuestionId.get(source.question_id);
  if (rule.hide_when_not_relevant && shared?.status === "not_relevant") {
    return false;
  }
  const choices = choiceList(shared);
  if (rule.hide_when_choice_includes?.some((c) => choices.includes(c))) {
    return false;
  }
  if (rule.show_when_choice_includes?.length) {
    if (!choices.length) return true; // not answered yet → still show in path until source answered
    return rule.show_when_choice_includes.some((c) => choices.includes(c));
  }
  return true;
}

export function evaluateConditional(
  rule: ConditionalRule | undefined,
  sourceShared: Answer | undefined,
): boolean {
  if (!rule) return true;
  if (rule.hide_when_not_relevant && sourceShared?.status === "not_relevant") {
    return false;
  }
  const choices = choiceList(sourceShared);
  if (rule.hide_when_choice_includes?.some((c) => choices.includes(c))) {
    return false;
  }
  if (rule.show_when_choice_includes?.length) {
    if (!choices.length) return false;
    return rule.show_when_choice_includes.some((c) => choices.includes(c));
  }
  return true;
}

function screenStatus(
  screen: EssentialsScreenDef,
  statusIndex: Map<string, QuestionAnswerStatus>,
  store: AppStore,
): {
  state: "completed" | "in_progress" | "not_started" | "needs_follow_up" | "hidden";
  label: string;
} {
  const primary = statusIndex.get(screen.question_id);
  const paired = (screen.paired_question_ids ?? []).map((id) =>
    statusIndex.get(id),
  );
  const answers = store.answers.filter(
    (a) =>
      a.question_id === screen.question_id ||
      screen.paired_question_ids?.includes(a.question_id),
  );
  const undecided = answers.some((a) => a.status === "undecided");
  const needsResearch = answers.some((a) => a.needs_research || a.status === "needs_research");
  const review = answers.some((a) => a.status === "review_scheduled");
  const cooling = answers.some((a) => a.status === "cooling_off");

  if (undecided || needsResearch || review || cooling) {
    return { state: "needs_follow_up", label: "Needs follow-up" };
  }
  if (
    primary?.fullyAnswered &&
    (paired.length === 0 || paired.every((p) => !p || p.fullyAnswered))
  ) {
    return { state: "completed", label: "Completed" };
  }
  if (
    primary?.partiallyAnswered ||
    primary?.shared === "answered" ||
    primary?.sam === "answered" ||
    primary?.michelle === "answered" ||
    paired.some(
      (p) =>
        p &&
        (p.partiallyAnswered ||
          p.shared === "answered" ||
          p.sam === "answered" ||
          p.michelle === "answered"),
    )
  ) {
    return { state: "in_progress", label: "In progress" };
  }
  return { state: "not_started", label: "Not started" };
}

export type EssentialsDashboard = {
  version: string;
  total_primary: number;
  visible_primary: number;
  completed: number;
  in_progress: number;
  not_started: number;
  needs_follow_up: number;
  estimated_minutes_remaining: number;
  resume_screen_id: string | null;
  modules: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    estimated_minutes: number;
    question_count: number;
    completed: number;
    in_progress: number;
    not_started: number;
    needs_follow_up: number;
    progress_percent: number;
  }>;
  screens: Array<{
    screen: EssentialsScreenDef;
    visible: boolean;
    state: string;
    label: string;
    question: Question | null;
  }>;
  unresolved_disagreements: Array<{ screen_id: string; title: string }>;
  waiting_provider: Array<{ screen_id: string; title: string }>;
  discuss_later: Array<{ screen_id: string; title: string }>;
  waiting_research: Array<{ screen_id: string; title: string }>;
};

export function buildEssentialsDashboard(store: AppStore): EssentialsDashboard {
  const statusIndex = buildQuestionStatusIndex(store);
  const sharedByQuestionId = new Map(
    store.answers.filter((a) => a.is_shared).map((a) => [a.question_id, a]),
  );
  const qById = new Map(store.questions.map((q) => [q.id, q]));

  const screens = listPrimaryScreens().map((screen) => {
    const visible = isScreenVisible(screen, store, sharedByQuestionId);
    const status = visible
      ? screenStatus(screen, statusIndex, store)
      : { state: "hidden" as const, label: "Hidden" };
    return {
      screen,
      visible,
      state: status.state,
      label: status.label,
      question: qById.get(screen.question_id) ?? null,
    };
  });

  const visible = screens.filter((s) => s.visible);
  const completed = visible.filter((s) => s.state === "completed").length;
  const in_progress = visible.filter((s) => s.state === "in_progress").length;
  const not_started = visible.filter((s) => s.state === "not_started").length;
  const needs_follow_up = visible.filter((s) => s.state === "needs_follow_up").length;

  const resume =
    visible.find(
      (s) =>
        s.state === "in_progress" ||
        s.state === "not_started" ||
        s.state === "needs_follow_up",
    )?.screen.id ?? null;

  const modules = ESSENTIALS_MODULES.map((mod) => {
    const modScreens = visible.filter((s) => s.screen.module_id === mod.id);
    const c = modScreens.filter((s) => s.state === "completed").length;
    const ip = modScreens.filter((s) => s.state === "in_progress").length;
    const ns = modScreens.filter((s) => s.state === "not_started").length;
    const nf = modScreens.filter((s) => s.state === "needs_follow_up").length;
    const total = modScreens.length || 1;
    return {
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      estimated_minutes: mod.estimated_minutes,
      question_count: modScreens.length,
      completed: c,
      in_progress: ip,
      not_started: ns,
      needs_follow_up: nf,
      progress_percent: Math.round((c / total) * 100),
    };
  });

  const unresolved_disagreements: EssentialsDashboard["unresolved_disagreements"] =
    [];
  const waiting_provider: EssentialsDashboard["waiting_provider"] = [];
  const discuss_later: EssentialsDashboard["discuss_later"] = [];
  const waiting_research: EssentialsDashboard["waiting_research"] = [];

  for (const row of visible) {
    const answers = store.answers.filter(
      (a) =>
        a.question_id === row.screen.question_id ||
        row.screen.paired_question_ids?.includes(a.question_id),
    );
    const sam = answers.find((a) => !a.is_shared && a.member_id);
    const michelle = answers.filter((a) => !a.is_shared);
    if (
      michelle.length >= 2 &&
      michelle[0]?.payload.text &&
      michelle[1]?.payload.text &&
      michelle[0].payload.text !== michelle[1].payload.text &&
      !answers.some((a) => a.is_shared && a.payload.text)
    ) {
      unresolved_disagreements.push({
        screen_id: row.screen.id,
        title: row.screen.title,
      });
    }
    void sam;
    if (answers.some((a) => a.status === "review_scheduled")) {
      discuss_later.push({ screen_id: row.screen.id, title: row.screen.title });
    }
    if (answers.some((a) => a.needs_research || a.status === "needs_research")) {
      waiting_research.push({
        screen_id: row.screen.id,
        title: row.screen.title,
      });
    }
    if (
      row.screen.provider_label &&
      (row.state === "needs_follow_up" ||
        answers.some((a) => a.status === "needs_research"))
    ) {
      waiting_provider.push({
        screen_id: row.screen.id,
        title: row.screen.title,
      });
    }
  }

  return {
    version: "before-birth-pathway-v1",
    total_primary: listPrimaryScreens().length,
    visible_primary: visible.length,
    completed,
    in_progress,
    not_started,
    needs_follow_up,
    estimated_minutes_remaining: estimatedMinutesRemaining(
      not_started + in_progress + needs_follow_up,
    ),
    resume_screen_id: resume,
    modules,
    screens,
    unresolved_disagreements,
    waiting_provider,
    discuss_later,
    waiting_research,
  };
}

export function nextScreenId(
  currentId: string,
  store: AppStore,
): string | null {
  const dash = buildEssentialsDashboard(store);
  const visible = dash.screens.filter((s) => s.visible).map((s) => s.screen);
  const idx = visible.findIndex((s) => s.id === currentId);
  if (idx < 0) return dash.resume_screen_id;
  return visible[idx + 1]?.id ?? null;
}

export function moduleProgressFor(
  moduleId: string,
  store: AppStore,
) {
  const dash = buildEssentialsDashboard(store);
  return dash.modules.find((m) => m.id === moduleId) ?? null;
}

export function getScreenQuestionStatus(
  questionId: string,
  store: AppStore,
) {
  return getQuestionAnswerStatus(questionId, store);
}

export { screensForModule };
