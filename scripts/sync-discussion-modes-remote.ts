/**
 * Sync discussion_mode metadata onto the live Turner Family remote store.
 * Metadata only — never mutates answers, history, or question text.
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/sync-discussion-modes-remote.ts
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/sync-discussion-modes-remote.ts --apply
 */
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";
process.env.USE_LOCAL_STORE = "false";

import { readStore, updateStore, getRemoteStoreHealth } from "@/lib/db/store";
import {
  classifyDiscussionMode,
  summarizeClassification,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";
import seedQuestions from "@/data/seed/questions.json";

const apply = process.argv.includes("--apply");

type SeedQ = {
  id: string;
  slug: string;
  discussion_mode?: DiscussionMode;
  discussion_reason?: string;
  separate_answers_recommended?: boolean;
  short_title?: string;
  text?: string;
  categories?: string[];
  why_it_matters?: string;
};

async function main() {
  const store = await readStore();
  const health = await getRemoteStoreHealth();
  const seedById = new Map(
    (seedQuestions as SeedQ[]).map((q) => [q.id, q]),
  );
  const seedBySlug = new Map(
    (seedQuestions as SeedQ[]).map((q) => [q.slug, q]),
  );

  // Ensure seed file modes are current via classifier
  const expectedModes: DiscussionMode[] = [];
  for (const sq of seedQuestions as SeedQ[]) {
    const c = classifyDiscussionMode({
      id: sq.id,
      slug: sq.slug,
      short_title: sq.short_title ?? "",
      text: sq.text ?? "",
      categories: sq.categories ?? [],
      why_it_matters: sq.why_it_matters,
    });
    expectedModes.push(c.discussion_mode);
  }
  const expectedDist = summarizeClassification(expectedModes);

  const beforeModes: Array<string> = [];
  let missing = 0;
  let incorrectMode = 0;
  let incorrectSepRec = 0;
  let unchanged = 0;
  let customSkipped = 0;
  let toUpdate = 0;

  type Change = {
    id: string;
    slug: string;
    before: {
      discussion_mode: string | null;
      discussion_reason: string | null;
      separate_answers_recommended: boolean | null;
    };
    after: {
      discussion_mode: DiscussionMode;
      discussion_reason: string;
      separate_answers_recommended: boolean;
    };
  };
  const changes: Change[] = [];

  for (const q of store.questions) {
    beforeModes.push(q.discussion_mode ?? "missing");

    // Seeded library questions use q_ ids. Skip only clearly non-library rows.
    const looksSeeded =
      q.id.startsWith("q_") ||
      seedById.has(q.id) ||
      seedBySlug.has(q.slug);
    if (!looksSeeded) {
      customSkipped += 1;
      continue;
    }

    const classified = classifyDiscussionMode({
      id: q.id,
      slug: q.slug,
      short_title: q.short_title,
      text: q.text,
      categories: q.categories,
      why_it_matters: q.why_it_matters,
    });

    const targetMode = classified.discussion_mode;
    const targetReason = classified.discussion_reason;
    const targetSep = classified.separate_answers_recommended;

    if (!q.discussion_mode) missing += 1;
    if (q.discussion_mode && q.discussion_mode !== targetMode) {
      incorrectMode += 1;
    }
    if (Boolean(q.separate_answers_recommended) !== Boolean(targetSep)) {
      incorrectSepRec += 1;
    }

    const same =
      q.discussion_mode === targetMode &&
      (q.discussion_reason ?? null) === targetReason &&
      Boolean(q.separate_answers_recommended) === Boolean(targetSep);

    if (same) {
      unchanged += 1;
      continue;
    }

    toUpdate += 1;
    changes.push({
      id: q.id,
      slug: q.slug,
      before: {
        discussion_mode: q.discussion_mode ?? null,
        discussion_reason: q.discussion_reason ?? null,
        separate_answers_recommended: q.separate_answers_recommended ?? null,
      },
      after: {
        discussion_mode: targetMode,
        discussion_reason: targetReason,
        separate_answers_recommended: targetSep,
      },
    });
  }

  const afterModesPredicted = store.questions.map((q) =>
    classifyDiscussionMode({
      id: q.id,
      slug: q.slug,
      short_title: q.short_title,
      text: q.text,
      categories: q.categories,
      why_it_matters: q.why_it_matters,
    }).discussion_mode,
  );

  const report = {
    apply,
    family: store.family?.name,
    health,
    live_question_count: store.questions.length,
    answer_count: store.answers?.length ?? 0,
    questions_missing_discussion_mode: missing,
    questions_incorrect_discussion_mode: incorrectMode,
    questions_incorrect_separate_answers_recommended: incorrectSepRec,
    questions_unchanged: unchanged,
    custom_questions_skipped: customSkipped,
    questions_to_update: toUpdate,
    before_distribution: summarizeClassification(
      beforeModes.map((m) =>
        m === "missing" ? ("shared_first" as DiscussionMode) : (m as DiscussionMode),
      ),
    ),
    before_raw: beforeModes.reduce(
      (acc, m) => {
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    expected_seed_classifier_distribution: expectedDist,
    after_distribution_predicted: summarizeClassification(afterModesPredicted),
    sample_changes: changes.slice(0, 20),
  };

  const outPath = path.join(
    process.cwd(),
    "docs",
    "discussion-mode-sync-dry-run.json",
  );
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (!apply) {
    console.log("\nDry-run only. Pass --apply to write metadata.");
    return;
  }

  const changedIds = new Set(changes.map((c) => c.id));
  await updateStore(
    (s) => {
      for (const q of s.questions) {
        if (!changedIds.has(q.id)) continue;
        const classified = classifyDiscussionMode({
          id: q.id,
          slug: q.slug,
          short_title: q.short_title,
          text: q.text,
          categories: q.categories,
          why_it_matters: q.why_it_matters,
        });
        q.discussion_mode = classified.discussion_mode;
        q.discussion_reason = classified.discussion_reason;
        q.separate_answers_recommended =
          classified.separate_answers_recommended;
      }
      return s;
    },
    { operation: "sync_discussion_modes" },
  );

  // Verify idempotency + answer integrity
  const after = await readStore();
  const answerCountAfter = after.answers?.length ?? 0;
  const modesAfter = after.questions.map(
    (q) => q.discussion_mode ?? "missing",
  );
  const verify = {
    answer_count_before: store.answers?.length ?? 0,
    answer_count_after: answerCountAfter,
    answers_unchanged: answerCountAfter === (store.answers?.length ?? 0),
    after_raw: modesAfter.reduce(
      (acc, m) => {
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    after_distribution: summarizeClassification(
      after.questions
        .map((q) => q.discussion_mode)
        .filter(Boolean) as DiscussionMode[],
    ),
  };
  console.log("\nAPPLY VERIFY", JSON.stringify(verify, null, 2));

  // Second apply should be no-op
  let secondUpdates = 0;
  await updateStore(
    (s) => {
      for (const q of s.questions) {
        if (!(q.id.startsWith("q_") || seedById.has(q.id) || seedBySlug.has(q.slug))) {
          continue;
        }
        const classified = classifyDiscussionMode({
          id: q.id,
          slug: q.slug,
          short_title: q.short_title,
          text: q.text,
          categories: q.categories,
          why_it_matters: q.why_it_matters,
        });
        const same =
          q.discussion_mode === classified.discussion_mode &&
          q.discussion_reason === classified.discussion_reason &&
          Boolean(q.separate_answers_recommended) ===
            Boolean(classified.separate_answers_recommended);
        if (!same) secondUpdates += 1;
        q.discussion_mode = classified.discussion_mode;
        q.discussion_reason = classified.discussion_reason;
        q.separate_answers_recommended =
          classified.separate_answers_recommended;
      }
      return s;
    },
    { operation: "sync_discussion_modes_idempotent" },
  );
  console.log("Idempotent second pass updates:", secondUpdates);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
