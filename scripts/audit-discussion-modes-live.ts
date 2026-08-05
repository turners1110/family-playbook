/**
 * Investigate live discussion_mode vs seed vs UI resolution.
 * Read-only. Does not mutate the remote store.
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/audit-discussion-modes-live.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";
process.env.USE_LOCAL_STORE = "false";

import { readStore, getStorageMode, getRemoteStoreHealth } from "@/lib/db/store";
import {
  classifyDiscussionMode,
  resolveEffectiveDiscussionMode,
  summarizeClassification,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { essentialsShowSeparateEditors } from "@/lib/discussions/discussion-mode";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";
import seedQuestions from "@/data/seed/questions.json";

function tally(arr: Array<string | null | undefined>) {
  const m: Record<string, number> = {};
  for (const x of arr) {
    const k = x ?? "missing";
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const store = await readStore();
  const health = await getRemoteStoreHealth();
  const live = store.questions ?? [];
  const members = store.members ?? [];
  const sam = members.find((m) => m.display_name === "Sam");
  const michelle = members.find((m) => m.display_name === "Michelle");

  const storedModes: string[] = [];
  const resolvedModes: DiscussionMode[] = [];
  const classifiedModes: DiscussionMode[] = [];
  const uiModes: Array<"shared" | "separate"> = [];
  let withMode = 0;
  let withoutMode = 0;
  let hasSeparateAnswerCount = 0;
  let sepRecTrue = 0;

  const byId = new Map(live.map((q) => [q.id, q]));
  const seedById = new Map(
    (seedQuestions as Array<{ id: string; discussion_mode?: string }>).map(
      (q) => [q.id, q],
    ),
  );

  let seedMatch = 0;
  let seedMismatch = 0;
  let missingInSeed = 0;
  let resolvedDiffersFromSeed = 0;

  for (const q of live) {
    if (q.discussion_mode) withMode += 1;
    else withoutMode += 1;
    if (q.separate_answers_recommended) sepRecTrue += 1;

    const answers = (store.answers ?? []).filter((a) => a.question_id === q.id);
    const hasSeparate = answers.some(
      (a) =>
        !a.is_shared &&
        (a.member_id === sam?.id || a.member_id === michelle?.id),
    );
    if (hasSeparate) hasSeparateAnswerCount += 1;

    storedModes.push(q.discussion_mode ?? "missing");
    const classified = classifyDiscussionMode(q).discussion_mode;
    classifiedModes.push(classified);
    const resolved = resolveEffectiveDiscussionMode({
      discussion_mode: q.discussion_mode ?? null,
      separate_answers_recommended: q.separate_answers_recommended,
      hasSeparateAnswers: hasSeparate,
      question: q,
    });
    resolvedModes.push(resolved);

    // Mirror AnswerEditor initial uiMode
    const ui: "shared" | "separate" =
      hasSeparate || resolved === "separate_first" ? "separate" : "shared";
    uiModes.push(ui);

    const seed = seedById.get(q.id);
    if (!seed) missingInSeed += 1;
    else if ((seed.discussion_mode ?? null) === (q.discussion_mode ?? null)) {
      seedMatch += 1;
    } else {
      seedMismatch += 1;
    }
    if (seed?.discussion_mode && seed.discussion_mode !== resolved) {
      resolvedDiffersFromSeed += 1;
    }
  }

  // Essentials screens
  const essentialsRows = ESSENTIALS_SCREENS.map((screen) => {
    const q = byId.get(screen.question_id);
    if (!q) {
      return {
        screenId: screen.id,
        questionId: screen.question_id,
        missingQuestion: true,
      };
    }
    const resolved = resolveEffectiveDiscussionMode({
      discussion_mode: q.discussion_mode ?? null,
      separate_answers_recommended: q.separate_answers_recommended,
      question: q,
    });
    const showSeparate = essentialsShowSeparateEditors(screen, q);
    return {
      screenId: screen.id,
      title: screen.title,
      slug: q.slug,
      stored_mode: q.discussion_mode ?? "missing",
      resolved,
      screen_separate_answers: Boolean(screen.separate_answers),
      response_type: screen.response_type,
      essentialsShowsSeparate: showSeparate,
    };
  });

  const essentialsSeparateUi = essentialsRows.filter(
    (r) => "essentialsShowsSeparate" in r && r.essentialsShowsSeparate,
  ).length;

  // Deterministic sample of 25 live questions
  const rng = mulberry32(20260804);
  const shuffled = [...live].sort(() => rng() - 0.5).slice(0, 25);
  const sample = shuffled.map((q) => {
    const answers = (store.answers ?? []).filter((a) => a.question_id === q.id);
    const hasSeparate = answers.some((a) => !a.is_shared);
    const resolved = resolveEffectiveDiscussionMode({
      discussion_mode: q.discussion_mode ?? null,
      separate_answers_recommended: q.separate_answers_recommended,
      hasSeparateAnswers: hasSeparate,
      question: q,
    });
    const essentialsScreen = ESSENTIALS_SCREENS.find(
      (s) => s.question_id === q.id,
    );
    const screen =
      essentialsScreen != null
        ? `essentials:${essentialsScreen.id}`
        : "questions/[slug] or conversations";
    const uiMode =
      hasSeparate || resolved === "separate_first" ? "separate" : "shared";
    return {
      slug: q.slug,
      title: q.short_title,
      stored_discussion_mode: q.discussion_mode ?? null,
      separate_answers_recommended: q.separate_answers_recommended,
      categories: q.categories,
      hasSeparateAnswers: hasSeparate,
      resolved_mode: resolved,
      classified_if_missing: classifyDiscussionMode(q).discussion_mode,
      seed_mode:
        (seedById.get(q.id) as { discussion_mode?: string } | undefined)
          ?.discussion_mode ?? null,
      screen,
      actual_ui_mode: uiMode,
      essentials_override:
        essentialsScreen != null
          ? essentialsShowSeparateEditors(essentialsScreen, q)
          : null,
    };
  });

  // Before-birth most-used proxy: essentials screens + required_before_birth
  const beforeBirth = live.filter(
    (q) => q.required_before_birth || q.babymoon_priority,
  );
  const beforeBirthResolved = beforeBirth.map((q) =>
    resolveEffectiveDiscussionMode({
      discussion_mode: q.discussion_mode ?? null,
      separate_answers_recommended: q.separate_answers_recommended,
      question: q,
    }),
  );

  const report = {
    storage: {
      mode: getStorageMode(),
      health,
      family: store.family?.name,
      questionCount: live.length,
      answerCount: store.answers?.length ?? 0,
    },
    live_stored_discussion_mode: tally(storedModes),
    live_field_presence: {
      withMode,
      withoutMode,
      pctMissing: live.length
        ? Math.round((withoutMode / live.length) * 1000) / 10
        : 0,
      separate_answers_recommended_true: sepRecTrue,
      questions_with_existing_separate_answers: hasSeparateAnswerCount,
    },
    live_resolved_modes: summarizeClassification(resolvedModes),
    live_ui_initial_mode: tally(uiModes),
    live_reclassified_via_runtime_classifier:
      summarizeClassification(classifiedModes),
    seed_file_modes: tally(
      (seedQuestions as Array<{ discussion_mode?: string }>).map(
        (q) => q.discussion_mode ?? "missing",
      ),
    ),
    seed_vs_live: {
      seedMatch,
      seedMismatch,
      missingInSeed,
      resolvedDiffersFromSeed,
    },
    essentials: {
      screenCount: ESSENTIALS_SCREENS.length,
      showsSeparateEditors: essentialsSeparateUi,
      showsSharedOnly: ESSENTIALS_SCREENS.length - essentialsSeparateUi,
      sampleSeparate: essentialsRows
        .filter((r) => "essentialsShowsSeparate" in r && r.essentialsShowsSeparate)
        .slice(0, 15),
      sampleSharedForced: essentialsRows
        .filter(
          (r) =>
            "essentialsShowsSeparate" in r &&
            !r.essentialsShowsSeparate &&
            (r.screen_separate_answers ||
              r.response_type === "separate_then_shared"),
        )
        .slice(0, 15),
    },
    before_birth_live_resolved: summarizeClassification(beforeBirthResolved),
    sample_25: sample,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
