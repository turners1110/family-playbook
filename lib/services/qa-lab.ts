import { id, nowIso, readStore, updateStore } from "@/lib/db/store";
import type {
  AppStore,
  ConversationSession,
  ConversationSessionItem,
  QaManualPhase,
  QaRunRecord,
} from "@/lib/types/models";
import {
  QA_EXPECTED,
  QA_SESSION_ORDER,
  QA_SUGGESTED_TASK_TITLES,
  getQaQuestion,
  isQaQuestionId,
} from "@/lib/qa/question-pack";
import { createDefaultManualPhases } from "@/lib/qa/manual-phases";
import {
  countQaRecords,
  runAutomatedIntegrityCheck,
  type IntegrityReport,
} from "@/lib/qa/integrity";
import { energyLevelToStore } from "@/lib/conversations/response-types";
import { buildSessionSummary } from "@/lib/conversations/summary";

function ensureQa(store: AppStore) {
  if (!store.conversation_sessions) store.conversation_sessions = [];
  if (!store.conversation_session_items) store.conversation_session_items = [];
  if (!store.conversation_quick_answers) store.conversation_quick_answers = [];
  if (!store.conversation_differences) store.conversation_differences = [];
  if (!store.qa_runs) store.qa_runs = [];
  if (!Array.isArray(store.checklist_tasks)) store.checklist_tasks = [];
}

function makeTestRunId(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return `qa_${y}${m}${day}_${rand}`;
}

function qaMeta(testRunId: string, testCaseId: string | null, createdBy: string) {
  return {
    is_test_data: true as const,
    test_run_id: testRunId,
    test_case_id: testCaseId,
    source: "qa_test_lab" as const,
    created_by_meta: createdBy,
  };
}

export async function listQaRuns() {
  const store = await readStore();
  ensureQa(store);
  return [...(store.qa_runs ?? [])]
    .filter((r) => r.status !== "cleaned")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getQaRun(testRunId: string) {
  const store = await readStore();
  ensureQa(store);
  const run = store.qa_runs!.find((r) => r.test_run_id === testRunId) ?? null;
  const counts = countQaRecords(store, testRunId);
  return { run, counts, storeSnapshotSafe: true };
}

export async function createQaTestPack(createdBy: string) {
  const testRunId = makeTestRunId();
  const ts = nowIso();
  const sessionId = id("csess");

  await updateStore(
    (store) => {
      ensureQa(store);

      // Safety: never inject QA questions into the real library.
      store.questions = store.questions.filter((q) => !isQaQuestionId(q.id));

      const session: ConversationSession = {
        id: sessionId,
        family_id: store.family.id,
        mode: "qa_integrity",
        title: `QA Integrity Session · ${testRunId}`,
        planned_minutes: 45,
        status: "active",
        started_at: ts,
        paused_at: null,
        completed_at: null,
        active_seconds: 0,
        session_tag: "qa_integrity",
        created_by: createdBy,
        current_item_index: 0,
        summary: null,
        created_at: ts,
        updated_at: ts,
        is_test_data: true,
        test_run_id: testRunId,
        test_case_id: "qa_session",
        source: "qa_test_lab",
      };
      store.conversation_sessions!.push(session);

      QA_SESSION_ORDER.forEach((promptId, displayOrder) => {
        const prompt = getQaQuestion(promptId);
        if (!prompt) return;
        const item: ConversationSessionItem = {
          id: id("citem"),
          session_id: sessionId,
          prompt_id: promptId,
          source_question_id: prompt.follow_up_open_question_id,
          item_type: prompt.response_type,
          display_order: displayOrder,
          energy: energyLevelToStore(prompt.conversation_energy),
          estimated_time_seconds: prompt.estimated_time_seconds,
          actual_time_seconds: 0,
          status: "pending",
          opened_at: null,
          answered_at: null,
          paused_duration_seconds: 0,
          branch_context:
            promptId === "qa_grouped_a"
              ? { grouped_with: ["qa_grouped_b"] }
              : null,
          created_at: ts,
          updated_at: ts,
          is_test_data: true,
          test_run_id: testRunId,
          test_case_id: prompt.test_case_id,
          source: "qa_test_lab",
        };
        store.conversation_session_items!.push(item);
      });

      const run: QaRunRecord = {
        id: id("qarun"),
        test_run_id: testRunId,
        family_id: store.family.id,
        session_id: sessionId,
        created_by: createdBy,
        created_at: ts,
        updated_at: ts,
        completed_at: null,
        is_test_data: true,
        source: "qa_test_lab",
        status: "active",
        manual_phases: createDefaultManualPhases(),
        integrity_last_run_at: null,
        integrity_summary: null,
        suggested_tasks: QA_SUGGESTED_TASK_TITLES.map((title) => ({
          id: id("qatask"),
          title,
          confirmed: false,
          checklist_task_id: null,
        })),
      };
      store.qa_runs!.push(run);
      return store;
    },
    { operation: "createQaTestPack" },
  );

  return { testRunId, sessionId };
}

/** Seed a deterministic answer set for automated integrity tests. */
export async function seedQaExpectedAnswers(testRunId: string) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureQa(store);
      const session = store.conversation_sessions!.find(
        (s) => s.test_run_id === testRunId,
      );
      if (!session) return store;
      const items = store.conversation_session_items!.filter(
        (i) => i.session_id === session.id,
      );

      const upsert = (
        item: ConversationSessionItem,
        actor: "sam" | "michelle" | "shared",
        data: {
          selected?: string[];
          text?: string | null;
          scale?: number | null;
        },
      ) => {
        const existing = store.conversation_quick_answers!.find(
          (a) => a.session_item_id === item.id && a.actor === actor,
        );
        if (existing) {
          existing.selected_options = data.selected ?? existing.selected_options;
          existing.short_text =
            data.text !== undefined ? data.text : existing.short_text;
          existing.scale =
            data.scale !== undefined ? data.scale : existing.scale;
          existing.updated_at = ts;
          return;
        }
        store.conversation_quick_answers!.push({
          id: id("cqans"),
          family_id: store.family.id,
          session_id: session.id,
          session_item_id: item.id,
          prompt_id: item.prompt_id,
          actor,
          selected_options: data.selected ?? [],
          short_text: data.text ?? null,
          explanation: null,
          scale: data.scale ?? null,
          created_at: ts,
          updated_at: ts,
          is_test_data: true,
          test_run_id: testRunId,
          test_case_id: item.test_case_id ?? null,
          source: "qa_test_lab",
        });
      };

      const byPrompt = (pid: string) => items.find((i) => i.prompt_id === pid);

      const same = byPrompt("qa_quick_pick_same");
      if (same) {
        upsert(same, "sam", { selected: ["option_a"] });
        upsert(same, "michelle", { selected: ["option_a"] });
        same.status = "answered_same";
      }

      const diff = byPrompt("qa_quick_pick_different");
      if (diff) {
        upsert(diff, "sam", { selected: ["morning"] });
        upsert(diff, "michelle", { selected: ["night"] });
        diff.status = "answered_different";
        if (
          !store.conversation_differences!.some(
            (d) =>
              d.test_run_id === testRunId &&
              d.prompt_id === "qa_quick_pick_different",
          )
        ) {
          store.conversation_differences!.push({
            id: id("cdiff"),
            family_id: store.family.id,
            session_id: session.id,
            prompt_id: "qa_quick_pick_different",
            sam_answer_snapshot: "morning",
            michelle_answer_snapshot: "night",
            sam_reason: null,
            michelle_reason: null,
            resolution_status: "kept_separate",
            shared_answer_text: null,
            created_at: ts,
            updated_at: ts,
            is_test_data: true,
            test_run_id: testRunId,
            test_case_id: "qa_2_different",
            source: "qa_test_lab",
          });
        }
      }

      const short = byPrompt("qa_short_text");
      if (short) {
        upsert(short, "sam", { text: QA_EXPECTED.short_sam });
        upsert(short, "michelle", { text: QA_EXPECTED.short_michelle });
        short.status = "answered_different";
      }

      const deep = byPrompt("qa_open_time_boxed");
      if (deep) {
        upsert(deep, "sam", { text: QA_EXPECTED.deep_sam });
        upsert(deep, "michelle", { text: QA_EXPECTED.deep_michelle });
        upsert(deep, "shared", { text: QA_EXPECTED.deep_shared });
        deep.status = "shared_answer_saved";
      }

      const scale = byPrompt("qa_reaction_scale");
      if (scale) {
        upsert(scale, "sam", { scale: 2 });
        upsert(scale, "michelle", { scale: 4 });
        scale.status = "answered_different";
      }

      const multi = byPrompt("qa_multi_select");
      if (multi) {
        upsert(multi, "sam", { selected: ["alpha", "gamma"] });
        upsert(multi, "michelle", { selected: ["beta", "gamma"] });
        multi.status = "answered_different";
      }

      const custom = byPrompt("qa_custom_option");
      if (custom) {
        upsert(custom, "sam", { selected: ["Custom QA Choice"] });
        custom.status = "opened";
      }

      const und = byPrompt("qa_undecided");
      if (und) und.status = "undecided";

      const later = byPrompt("qa_discuss_later");
      if (later) later.status = "discuss_later";

      const provider = byPrompt("qa_waiting_provider");
      if (provider) {
        upsert(provider, "shared", { selected: ["need_provider"] });
        provider.status = "needs_follow_up";
      }

      const ga = byPrompt("qa_grouped_a");
      const gb = byPrompt("qa_grouped_b");
      if (ga) {
        upsert(ga, "sam", { text: QA_EXPECTED.grouped_a });
        ga.status = "opened";
      }
      if (gb) {
        upsert(gb, "sam", { text: QA_EXPECTED.grouped_b });
        gb.status = "opened";
      }

      const quick = byPrompt("qa_quick_to_deep");
      const deepFu = byPrompt("qa_deep_follow_up");
      if (quick) {
        upsert(quick, "sam", { selected: ["simple"] });
        quick.status = "needs_follow_up";
      }
      if (deepFu) {
        upsert(deepFu, "sam", { text: QA_EXPECTED.deep_follow_up });
        deepFu.status = "opened";
      }

      const sharedQ = byPrompt("qa_shared_answer");
      if (sharedQ) {
        upsert(sharedQ, "sam", { text: QA_EXPECTED.shared_sam });
        upsert(sharedQ, "michelle", { text: QA_EXPECTED.shared_michelle });
        upsert(sharedQ, "shared", { text: QA_EXPECTED.shared_agreed });
        sharedQ.status = "shared_answer_saved";
      }

      const hist = byPrompt("qa_edit_history");
      if (hist) {
        upsert(hist, "sam", { text: "Version three" });
        hist.status = "opened";
        const existingAns = store.answers.find(
          (a) =>
            a.question_id === "qa_edit_history" &&
            a.test_run_id === testRunId &&
            a.is_shared,
        );
        if (!existingAns) {
          const answerId = id("answer");
          store.answers.push({
            id: answerId,
            family_id: store.family.id,
            question_id: "qa_edit_history",
            member_id: null,
            is_shared: true,
            payload: { text: "Version three" },
            status: "tentatively_decided",
            confidence: 3,
            bookmarked: false,
            needs_research: false,
            review_date: null,
            version: 3,
            created_at: ts,
            updated_at: ts,
            is_test_data: true,
            test_run_id: testRunId,
            test_case_id: "qa_15_history",
            source: "qa_test_lab",
          });
          (["Version one", "Version two", "Version three"] as const).forEach(
            (text, i) => {
              store.answer_versions.push({
                id: id("av"),
                answer_id: answerId,
                version: i + 1,
                payload: { text },
                status: "tentatively_decided",
                confidence: 3,
                changed_by: "qa_lab",
                change_reason: `QA revision ${i + 1}`,
                created_at: ts,
              });
            },
          );
        }
      }

      const special = byPrompt("qa_special_characters");
      if (special) {
        upsert(special, "sam", { text: QA_EXPECTED.special });
        special.status = "opened";
      }

      const long = byPrompt("qa_long_valid_text");
      if (long) {
        const longText = "QA long ".repeat(200).slice(0, 1800);
        upsert(long, "sam", { text: longText });
        long.status = "opened";
      }

      const limit = byPrompt("qa_validation_limit");
      if (limit) {
        upsert(limit, "sam", { text: "x".repeat(50) });
        limit.status = "opened";
      }

      return store;
    },
    { operation: "seedQaExpectedAnswers" },
  );
}

export async function runQaIntegrityCheck(testRunId: string) {
  const store = await readStore();
  const report = runAutomatedIntegrityCheck(store, testRunId);
  await updateStore(
    (s) => {
      ensureQa(s);
      const run = s.qa_runs!.find((r) => r.test_run_id === testRunId);
      if (run) {
        run.integrity_last_run_at = report.checked_at;
        run.integrity_summary = report.summary;
        run.updated_at = nowIso();
      }
      return s;
    },
    { operation: "runQaIntegrityCheck" },
  );
  return report;
}

export async function updateQaManualPhase(
  testRunId: string,
  phaseId: string,
  patch: Partial<QaManualPhase>,
) {
  await updateStore(
    (store) => {
      ensureQa(store);
      const run = store.qa_runs!.find((r) => r.test_run_id === testRunId);
      if (!run) return store;
      const phase = run.manual_phases.find((p) => p.id === phaseId);
      if (!phase) return store;
      Object.assign(phase, patch);
      run.updated_at = nowIso();
      return store;
    },
    { operation: "updateQaManualPhase" },
  );
}

export async function confirmQaTasks(
  testRunId: string,
  titles: string[],
) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureQa(store);
      const run = store.qa_runs!.find((r) => r.test_run_id === testRunId);
      if (!run) return store;

      let checklist = store.checklist_instances.find(
        (c) => c.template_slug === "before-baby",
      );
      if (!checklist) {
        checklist = {
          id: id("chk"),
          family_id: store.family.id,
          template_slug: "before-baby",
          title: "Before Baby",
          description: "QA temporary checklist host",
          created_at: ts,
          updated_at: ts,
        };
        store.checklist_instances.push(checklist);
      }

      for (const suggestion of run.suggested_tasks) {
        if (!titles.includes(suggestion.title)) continue;
        // Idempotent: skip if already confirmed with a live task.
        if (suggestion.confirmed && suggestion.checklist_task_id) {
          const existing = store.checklist_tasks.find(
            (t) => t.id === suggestion.checklist_task_id,
          );
          if (existing) continue;
        }
        const already = store.checklist_tasks.find(
          (t) =>
            t.is_test_data &&
            t.test_run_id === testRunId &&
            t.title === suggestion.title,
        );
        if (already) {
          suggestion.confirmed = true;
          suggestion.checklist_task_id = already.id;
          continue;
        }
        const taskId = id("ctask");
        store.checklist_tasks.push({
          id: taskId,
          checklist_id: checklist.id,
          template_task_slug: null,
          title: suggestion.title,
          category: "qa",
          category_label: "QA",
          completed: false,
          completed_at: null,
          due_date: null,
          priority: "medium",
          owner: "both",
          notes: `QA suggestion from ${testRunId}`,
          is_custom: true,
          is_default: false,
          archived: false,
          sort_order: 9000 + store.checklist_tasks.length,
          created_at: ts,
          updated_at: ts,
          is_test_data: true,
          test_run_id: testRunId,
          test_case_id: "qa_tasks",
          source: "qa_test_lab",
        });
        suggestion.confirmed = true;
        suggestion.checklist_task_id = taskId;
      }
      run.updated_at = ts;
      return store;
    },
    { operation: "confirmQaTasks" },
  );
}

export async function completeQaSession(testRunId: string) {
  const ts = nowIso();
  await updateStore(
    (store) => {
      ensureQa(store);
      const run = store.qa_runs!.find((r) => r.test_run_id === testRunId);
      const session = store.conversation_sessions!.find(
        (s) => s.test_run_id === testRunId,
      );
      if (!session || !run) return store;
      const items = store.conversation_session_items!.filter(
        (i) => i.session_id === session.id,
      );
      const answers = store.conversation_quick_answers!.filter(
        (a) => a.session_id === session.id,
      );
      const differences = store.conversation_differences!.filter(
        (d) => d.session_id === session.id,
      );
      const summary = buildSessionSummary({
        session,
        items,
        answers,
        differences,
      });
      summary.trip_memory = QA_EXPECTED.trip_memory;
      summary.undecided = items
        .filter((i) => i.status === "undecided")
        .map((i) => i.prompt_id);
      summary.waiting_provider = items
        .filter((i) => i.prompt_id === "qa_waiting_provider")
        .map((i) => i.prompt_id);
      summary.tasks_suggested = run.suggested_tasks.map((t) => t.title);
      summary.confirmed_tasks = run.suggested_tasks
        .filter((t) => t.confirmed)
        .map((t) => t.title);
      summary.kept_separate = differences
        .filter((d) => d.resolution_status === "kept_separate")
        .map((d) => d.prompt_id);
      summary.matching_answers = items
        .filter((i) => i.status === "answered_same")
        .map((i) => i.prompt_id);
      summary.shared_answers = items
        .filter((i) => i.status === "shared_answer_saved")
        .map((i) => i.prompt_id);
      summary.quick_to_deep = ["qa_quick_to_deep → qa_deep_follow_up"];

      session.summary = summary;
      session.status = "completed";
      session.completed_at = ts;
      session.updated_at = ts;
      run.status = "completed";
      run.completed_at = ts;
      run.updated_at = ts;
      return store;
    },
    { operation: "completeQaSession" },
  );
}

export type CleanupPreview = {
  test_run_id: string;
  counts: Record<string, number>;
  confirmation_token: string;
};

export async function previewQaCleanup(testRunId: string): Promise<CleanupPreview> {
  const store = await readStore();
  const counts = countQaRecords(store, testRunId);
  return {
    test_run_id: testRunId,
    counts: {
      sessions: counts.sessions,
      session_items: counts.session_items,
      quick_answers: counts.quick_answers,
      differences: counts.differences,
      deep_answers: counts.deep_answers,
      answer_versions: counts.answer_versions,
      checklist_tasks: counts.checklist_tasks,
      qa_runs: counts.qa_runs,
    },
    confirmation_token: testRunId.slice(-6),
  };
}

export async function cleanupQaData(
  testRunId: string,
  confirmation: string,
): Promise<{ removed: Record<string, number> }> {
  const expected = `DELETE QA ${testRunId.slice(-6)}`;
  if (confirmation.trim() !== expected) {
    throw new Error(`Typed confirmation must be exactly: ${expected}`);
  }

  const before = await readStore();
  const realQuestions = before.questions.length;
  const realAnswers = before.answers.filter((a) => !a.is_test_data).length;
  const preview = countQaRecords(before, testRunId);

  await updateStore(
    (store) => {
      ensureQa(store);
      const deepIds = new Set(
        store.answers
          .filter((a) => a.is_test_data && a.test_run_id === testRunId)
          .map((a) => a.id),
      );

      store.conversation_quick_answers = store.conversation_quick_answers!.filter(
        (a) => !(a.is_test_data && a.test_run_id === testRunId),
      );
      store.conversation_differences = store.conversation_differences!.filter(
        (d) => !(d.is_test_data && d.test_run_id === testRunId),
      );
      store.conversation_session_items = store.conversation_session_items!.filter(
        (i) => !(i.is_test_data && i.test_run_id === testRunId),
      );
      store.conversation_sessions = store.conversation_sessions!.filter(
        (s) => !(s.is_test_data && s.test_run_id === testRunId),
      );
      store.checklist_tasks = store.checklist_tasks.filter(
        (t) => !(t.is_test_data && t.test_run_id === testRunId),
      );
      store.answer_versions = store.answer_versions.filter(
        (v) => !deepIds.has(v.answer_id),
      );
      store.answers = store.answers.filter(
        (a) => !(a.is_test_data && a.test_run_id === testRunId),
      );
      // Mark run cleaned rather than delete audit trail of the run id itself
      for (const run of store.qa_runs!) {
        if (run.test_run_id === testRunId) {
          run.status = "cleaned";
          run.session_id = null;
          run.suggested_tasks = [];
          run.updated_at = nowIso();
        }
      }
      // Never remove real questions
      store.questions = store.questions.filter((q) => !isQaQuestionId(q.id));
      return store;
    },
    { operation: "cleanupQaData" },
  );

  const after = await readStore();
  if (after.questions.length !== realQuestions) {
    throw new Error("Safety abort: real question count changed during cleanup.");
  }
  const afterRealAnswers = after.answers.filter((a) => !a.is_test_data).length;
  if (afterRealAnswers !== realAnswers) {
    throw new Error("Safety abort: real answer count changed during cleanup.");
  }

  return {
    removed: {
      sessions: preview.sessions,
      session_items: preview.session_items,
      quick_answers: preview.quick_answers,
      differences: preview.differences,
      deep_answers: preview.deep_answers,
      answer_versions: preview.answer_versions,
      checklist_tasks: preview.checklist_tasks,
    },
  };
}

export function buildQaReport(input: {
  testRunId: string;
  report: IntegrityReport;
  authMode: string;
  actor: string;
  host: string;
  startedAt: string | null;
  completedAt: string | null;
  phases: QaManualPhase[];
}) {
  const json = {
    schema: "turner-family-qa-report-v1",
    test_run_id: input.testRunId,
    started_time: input.startedAt,
    completed_time: input.completedAt,
    environment: process.env.NODE_ENV ?? "development",
    deployment_host: input.host,
    auth_mode: input.authMode,
    actor: input.actor,
    integrity: {
      summary: input.report.summary,
      checks: input.report.checks,
      record_counts: input.report.record_counts,
    },
    manual_phases: input.phases.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      notes: p.notes,
    })),
    privacy: {
      secrets_excluded: true,
      tokens_excluded: true,
      cookies_excluded: true,
      service_role_excluded: true,
      signed_urls_excluded: true,
      unrelated_answers_excluded: true,
    },
  };

  const md = [
    `# Turner Family QA Report`,
    ``,
    `- Test run ID: \`${input.testRunId}\``,
    `- Started: ${input.startedAt ?? "—"}`,
    `- Completed: ${input.completedAt ?? "—"}`,
    `- Environment: ${json.environment}`,
    `- Host: ${input.host}`,
    `- Auth mode: ${input.authMode}`,
    `- Actor: ${input.actor}`,
    ``,
    `## Integrity summary`,
    ``,
    `- Pass: ${input.report.summary.pass}`,
    `- Fail: ${input.report.summary.fail}`,
    `- Warning: ${input.report.summary.warning}`,
    ``,
    `## Record counts`,
    ``,
    ...Object.entries(input.report.record_counts).map(
      ([k, v]) => `- ${k}: ${v}`,
    ),
    ``,
    `## Checks`,
    ``,
    ...input.report.checks.map(
      (c) =>
        `- **${c.status.toUpperCase()}** ${c.label} — expected \`${c.expected}\`, actual \`${c.actual}\``,
    ),
    ``,
    `## Manual phases`,
    ``,
    ...input.phases.map(
      (p) => `- ${p.title}: ${p.status}${p.notes ? ` — ${p.notes}` : ""}`,
    ),
    ``,
    `Secrets, tokens, cookies, and unrelated answers are excluded.`,
  ].join("\n");

  return { json, md };
}

void qaMeta;
