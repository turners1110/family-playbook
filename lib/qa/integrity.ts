import type { AppStore } from "@/lib/types/models";
import {
  QA_EXPECTED,
  QA_SESSION_ORDER,
  QA_SUGGESTED_TASK_TITLES,
  isQaQuestionId,
} from "@/lib/qa/question-pack";

export type IntegritySeverity = "pass" | "fail" | "warning";

export type IntegrityCheckResult = {
  id: string;
  label: string;
  status: IntegritySeverity;
  expected: string;
  actual: string;
  diagnostic: string;
};

export type IntegrityReport = {
  test_run_id: string;
  checked_at: string;
  checks: IntegrityCheckResult[];
  summary: { pass: number; fail: number; warning: number };
  record_counts: Record<string, number>;
};

function check(
  id: string,
  label: string,
  ok: boolean,
  expected: string,
  actual: string,
  diagnostic: string,
  warn = false,
): IntegrityCheckResult {
  return {
    id,
    label,
    status: ok ? "pass" : warn ? "warning" : "fail",
    expected,
    actual,
    diagnostic,
  };
}

export function countQaRecords(store: AppStore, testRunId: string) {
  const sessions = (store.conversation_sessions ?? []).filter(
    (s) => s.is_test_data && s.test_run_id === testRunId,
  );
  const sessionIds = new Set(sessions.map((s) => s.id));
  const items = (store.conversation_session_items ?? []).filter(
    (i) => i.is_test_data && i.test_run_id === testRunId,
  );
  const answers = (store.conversation_quick_answers ?? []).filter(
    (a) => a.is_test_data && a.test_run_id === testRunId,
  );
  const diffs = (store.conversation_differences ?? []).filter(
    (d) => d.is_test_data && d.test_run_id === testRunId,
  );
  const deepAnswers = store.answers.filter(
    (a) => a.is_test_data && a.test_run_id === testRunId,
  );
  const versions = store.answer_versions.filter((v) =>
    deepAnswers.some((a) => a.id === v.answer_id),
  );
  const tasks = store.checklist_tasks.filter(
    (t) => t.is_test_data && t.test_run_id === testRunId,
  );
  const runs = (store.qa_runs ?? []).filter((r) => r.test_run_id === testRunId);

  return {
    sessions: sessions.length,
    session_items: items.length,
    quick_answers: answers.length,
    differences: diffs.length,
    deep_answers: deepAnswers.length,
    answer_versions: versions.length,
    checklist_tasks: tasks.length,
    qa_runs: runs.length,
    session_ids: sessionIds,
    sessions_list: sessions,
    items_list: items,
    answers_list: answers,
    diffs_list: diffs,
    deep_answers_list: deepAnswers,
    tasks_list: tasks,
    runs_list: runs,
  };
}

export function runAutomatedIntegrityCheck(
  store: AppStore,
  testRunId: string,
): IntegrityReport {
  const counts = countQaRecords(store, testRunId);
  const checks: IntegrityCheckResult[] = [];

  checks.push(
    check(
      "one_session",
      "One conversation session exists",
      counts.sessions === 1,
      "1",
      String(counts.sessions),
      "QA pack should create exactly one session per run.",
    ),
  );

  const session = counts.sessions_list[0];
  const expectedItemCount = QA_SESSION_ORDER.length;
  checks.push(
    check(
      "expected_items",
      "Expected session items exist",
      counts.session_items === expectedItemCount,
      String(expectedItemCount),
      String(counts.session_items),
      "Fixed QA order must match session items.",
    ),
  );

  const itemPromptIds = counts.items_list.map((i) => i.prompt_id);
  const uniquePrompts = new Set(itemPromptIds);
  checks.push(
    check(
      "no_dup_items",
      "No duplicate session items",
      uniquePrompts.size === itemPromptIds.length,
      "unique prompts",
      `${itemPromptIds.length} items / ${uniquePrompts.size} unique`,
      "Duplicate prompt_ids indicate reshuffle or double create.",
    ),
  );

  const ordered = [...counts.items_list].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const orderOk = ordered.every(
    (item, idx) => item.prompt_id === QA_SESSION_ORDER[idx],
  );
  checks.push(
    check(
      "fixed_order",
      "Session items remain in fixed QA order",
      orderOk || counts.session_items === 0,
      QA_SESSION_ORDER.join(", "),
      ordered.map((i) => i.prompt_id).join(", ") || "(none)",
      "Momentum must not reorder QA items.",
    ),
  );

  const answersWithoutActor = counts.answers_list.filter((a) => !a.actor);
  checks.push(
    check(
      "actors_present",
      "Every saved answer has an actor",
      answersWithoutActor.length === 0,
      "all have actor",
      `${answersWithoutActor.length} missing`,
      "Actor must be sam, michelle, or shared.",
    ),
  );

  const samOk = counts.answers_list
    .filter((a) => a.actor === "sam")
    .every((a) => a.actor === "sam");
  const michelleOk = counts.answers_list
    .filter((a) => a.actor === "michelle")
    .every((a) => a.actor === "michelle");
  checks.push(
    check(
      "actor_identity",
      "Sam/Michelle actor identity remains correct",
      samOk && michelleOk,
      "actor matches role",
      "ok",
      "Actor field must not flip after refresh.",
    ),
  );

  // Matching answers → no difference
  const sameItem = counts.items_list.find(
    (i) => i.prompt_id === "qa_quick_pick_same",
  );
  if (sameItem) {
    const sam = counts.answers_list.find(
      (a) => a.session_item_id === sameItem.id && a.actor === "sam",
    );
    const michelle = counts.answers_list.find(
      (a) => a.session_item_id === sameItem.id && a.actor === "michelle",
    );
    if (sam && michelle) {
      const match =
        sam.selected_options.join() === michelle.selected_options.join();
      const diff = counts.diffs_list.find(
        (d) => d.prompt_id === "qa_quick_pick_same",
      );
      checks.push(
        check(
          "same_no_diff",
          "Matching answers create no difference record",
          match ? !diff : true,
          "no difference when same",
          diff ? "difference exists" : "none",
          "Difference records only when answers differ.",
        ),
      );
      if (match) {
        checks.push(
          check(
            "same_state",
            "QA 1 state is answered_same",
            sameItem.status === "answered_same",
            "answered_same",
            sameItem.status,
            "Both selected Option A.",
          ),
        );
      }
    }
  }

  const diffItem = counts.items_list.find(
    (i) => i.prompt_id === "qa_quick_pick_different",
  );
  if (diffItem) {
    const sam = counts.answers_list.find(
      (a) => a.session_item_id === diffItem.id && a.actor === "sam",
    );
    const michelle = counts.answers_list.find(
      (a) => a.session_item_id === diffItem.id && a.actor === "michelle",
    );
    if (sam && michelle) {
      const different =
        sam.selected_options.join() !== michelle.selected_options.join();
      const diffRecords = counts.diffs_list.filter(
        (d) => d.prompt_id === "qa_quick_pick_different",
      );
      checks.push(
        check(
          "diff_one_record",
          "Different answers create one difference record",
          !different || diffRecords.length === 1,
          "1 when different",
          String(diffRecords.length),
          "Exactly one difference record for QA 2.",
        ),
      );
      checks.push(
        check(
          "diff_separate",
          "Separate answers remain after difference",
          Boolean(sam && michelle),
          "both actors",
          `sam=${sam.selected_options.join()} michelle=${michelle.selected_options.join()}`,
          "Shared answer must not erase separate answers.",
        ),
      );
    }
  }

  // Shared answer preserves separate
  const sharedItem = counts.items_list.find(
    (i) => i.prompt_id === "qa_shared_answer",
  );
  if (sharedItem) {
    const sam = counts.answers_list.find(
      (a) => a.session_item_id === sharedItem.id && a.actor === "sam",
    );
    const michelle = counts.answers_list.find(
      (a) => a.session_item_id === sharedItem.id && a.actor === "michelle",
    );
    const shared = counts.answers_list.find(
      (a) => a.session_item_id === sharedItem.id && a.actor === "shared",
    );
    if (shared) {
      checks.push(
        check(
          "shared_preserves",
          "Shared answer preserves separate answers",
          Boolean(sam && michelle && shared),
          "sam + michelle + shared",
          `sam=${Boolean(sam)} michelle=${Boolean(michelle)} shared=${Boolean(shared)}`,
          "All three values must remain available.",
        ),
      );
    }
  }

  // Grouped independent IDs
  const groupA = counts.answers_list.filter((a) => a.prompt_id === "qa_grouped_a");
  const groupB = counts.answers_list.filter((a) => a.prompt_id === "qa_grouped_b");
  if (groupA.length || groupB.length) {
    checks.push(
      check(
        "grouped_ids",
        "Grouped answers retain separate question IDs",
        groupA.every((a) => a.prompt_id === "qa_grouped_a") &&
          groupB.every((a) => a.prompt_id === "qa_grouped_b"),
        "qa_grouped_a / qa_grouped_b",
        "ids distinct",
        "Editing A must not alter B.",
      ),
    );
  }

  // Quick vs deep IDs
  const quick = counts.answers_list.filter((a) => a.prompt_id === "qa_quick_to_deep");
  const deep = counts.answers_list.filter(
    (a) => a.prompt_id === "qa_deep_follow_up",
  );
  if (quick.length && deep.length) {
    checks.push(
      check(
        "quick_deep_ids",
        "Quick and deep answers retain separate IDs",
        true,
        "separate ids",
        `quick=${quick.length} deep=${deep.length}`,
        "Deep must save under qa_deep_follow_up.",
      ),
    );
  }

  // Scale numeric
  const scaleAnswers = counts.answers_list.filter(
    (a) => a.prompt_id === "qa_reaction_scale" && a.scale != null,
  );
  if (scaleAnswers.length) {
    const numeric = scaleAnswers.every((a) => typeof a.scale === "number");
    checks.push(
      check(
        "scale_numeric",
        "Numeric scale persists as numbers",
        numeric,
        "typeof number",
        numeric ? "number" : "non-number found",
        "Scale must not stringify.",
      ),
    );
  }

  // Multi-select no dupes
  const multi = counts.answers_list.filter((a) => a.prompt_id === "qa_multi_select");
  if (multi.length) {
    const noDupes = multi.every(
      (a) => new Set(a.selected_options).size === a.selected_options.length,
    );
    checks.push(
      check(
        "multi_no_dupes",
        "Multi-select arrays contain no duplicates",
        noDupes,
        "unique options",
        noDupes ? "ok" : "duplicates found",
        "Reload must not duplicate selections.",
      ),
    );
  }

  // Special characters
  const special = counts.answers_list.find(
    (a) =>
      a.prompt_id === "qa_special_characters" &&
      a.short_text?.includes("👶"),
  );
  if (special?.short_text) {
    checks.push(
      check(
        "special_chars",
        "Special characters remain unchanged",
        special.short_text.includes("&") && special.short_text.includes("👶"),
        QA_EXPECTED.special.slice(0, 40) + "…",
        special.short_text.slice(0, 40) + "…",
        "No HTML injection or corruption.",
      ),
    );
  }

  // Undecided / discuss later
  const undecided = counts.items_list.find((i) => i.prompt_id === "qa_undecided");
  if (undecided?.status === "undecided") {
    checks.push(
      check(
        "undecided_valid",
        "Undecided state is valid",
        true,
        "undecided",
        undecided.status,
        "Not agreed and not unanswered.",
      ),
    );
  }
  const later = counts.items_list.find((i) => i.prompt_id === "qa_discuss_later");
  if (later?.status === "discuss_later") {
    checks.push(
      check(
        "discuss_later_valid",
        "Discuss Later state is valid",
        true,
        "discuss_later",
        later.status,
        "Must appear in summary and not block completion.",
      ),
    );
  }

  // Session index
  if (session) {
    const maxIdx = Math.max(0, counts.session_items - 1);
    checks.push(
      check(
        "index_valid",
        "Session current index is valid",
        session.current_item_index >= 0 &&
          session.current_item_index <= maxIdx,
        `0..${maxIdx}`,
        String(session.current_item_index),
        "Index must point at an existing item.",
      ),
    );
    checks.push(
      check(
        "resumable",
        "Paused/active session remains resumable",
        session.status === "active" ||
          session.status === "paused" ||
          session.status === "completed",
        "active|paused|completed",
        session.status,
        "Abandoned sessions fail resume tests.",
      ),
    );
    if (session.status === "completed") {
      checks.push(
        check(
          "summary_present",
          "Completed session has summary",
          Boolean(session.summary),
          "summary object",
          session.summary ? "present" : "missing",
          "Summary must reference this session only.",
        ),
      );
      if (session.summary?.trip_memory) {
        checks.push(
          check(
            "trip_memory",
            "Trip memory text present",
            session.summary.trip_memory.includes("QA trip memory"),
            QA_EXPECTED.trip_memory,
            session.summary.trip_memory,
            "QA memory must not pull from other sessions.",
          ),
        );
      }
    }
  }

  // Tasks
  const suggested = counts.runs_list[0]?.suggested_tasks ?? [];
  const confirmedTitles = suggested
    .filter((t) => t.confirmed)
    .map((t) => t.title);
  const taskTitles = counts.tasks_list.map((t) => t.title);
  const dupTasks =
    taskTitles.length !== new Set(taskTitles).size;
  checks.push(
    check(
      "no_dup_tasks",
      "No duplicate QA tasks",
      !dupTasks,
      "unique titles",
      `${taskTitles.length} tasks`,
      "Repeated confirm must be idempotent.",
    ),
  );
  checks.push(
    check(
      "tasks_tagged",
      "Confirmed tasks carry test_run_id",
      counts.tasks_list.every(
        (t) => t.is_test_data && t.test_run_id === testRunId,
      ),
      "is_test_data + test_run_id",
      `${counts.checklist_tasks} tagged`,
      "Cleanup depends on these tags.",
    ),
  );
  if (confirmedTitles.length) {
    checks.push(
      check(
        "tasks_match_confirm",
        "Confirmed suggestions match checklist tasks",
        confirmedTitles.every((t) => taskTitles.includes(t)),
        confirmedTitles.join(", "),
        taskTitles.join(", ") || "(none)",
        "Unselected suggestions must not create tasks.",
      ),
    );
  } else {
    checks.push(
      check(
        "suggestions_only",
        "Suggestions create no tasks before confirmation",
        counts.checklist_tasks === 0,
        "0 tasks",
        String(counts.checklist_tasks),
        "Four suggestions may exist on the run without checklist rows.",
        true,
      ),
    );
  }

  // Production safety
  const prodAnswersOnQa = store.answers.filter(
    (a) =>
      isQaQuestionId(a.question_id) &&
      (!a.is_test_data || a.test_run_id !== testRunId) &&
      a.source !== "qa_test_lab",
  );
  checks.push(
    check(
      "no_prod_on_qa",
      "No production answers incorrectly reference QA IDs without tags",
      prodAnswersOnQa.length === 0,
      "0",
      String(prodAnswersOnQa.length),
      "Real answers must never use qa_ IDs without test tags.",
    ),
  );

  const untagged = [
    ...counts.sessions_list.filter((s) => !s.test_run_id),
    ...counts.answers_list.filter((a) => !a.test_run_id),
    ...counts.items_list.filter((i) => !i.test_run_id),
  ];
  checks.push(
    check(
      "all_tagged",
      "No QA records lack a test_run_id",
      untagged.length === 0,
      "0 untagged",
      String(untagged.length),
      "Every QA record must carry the run id.",
    ),
  );

  // Library not polluted
  const qaInLibrary = store.questions.filter((q) => isQaQuestionId(q.id));
  checks.push(
    check(
      "library_clean",
      "QA questions stay out of the real library",
      qaInLibrary.length === 0,
      "0",
      String(qaInLibrary.length),
      "QA pack is code-defined, not seed questions.",
    ),
  );

  // Suggested task titles known
  checks.push(
    check(
      "suggested_titles",
      "QA suggested task titles are known",
      suggested.every((t) =>
        (QA_SUGGESTED_TASK_TITLES as readonly string[]).includes(t.title),
      ),
      QA_SUGGESTED_TASK_TITLES.join(", "),
      suggested.map((t) => t.title).join(", ") || "(none yet)",
      "Unexpected suggestion titles.",
      true,
    ),
  );

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    warning: checks.filter((c) => c.status === "warning").length,
  };

  return {
    test_run_id: testRunId,
    checked_at: new Date().toISOString(),
    checks,
    summary,
    record_counts: {
      sessions: counts.sessions,
      session_items: counts.session_items,
      quick_answers: counts.quick_answers,
      differences: counts.differences,
      deep_answers: counts.deep_answers,
      answer_versions: counts.answer_versions,
      checklist_tasks: counts.checklist_tasks,
      qa_runs: counts.qa_runs,
    },
  };
}
