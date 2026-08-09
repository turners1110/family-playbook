/**
 * Sync Question Experience V2 metadata to the remote JSON store.
 *
 * Updates only on matching question IDs (exact or unique fuzzy):
 * - response_schema
 * - estimated_minutes
 *
 * Never mutates answers, answer_versions, decisions, or question IDs.
 *
 * Usage:
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/sync-question-experience-v2-remote.ts
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/sync-question-experience-v2-remote.ts --apply
 */
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";
process.env.USE_LOCAL_STORE = "false";

import { readStore, updateStore } from "@/lib/db/store";
import seedQuestions from "@/data/seed/questions.json";

const apply = process.argv.includes("--apply");

function related(a: string, b: string) {
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Stable stringify so key-order differences do not create false sync deltas. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

async function main() {
  const seed = seedQuestions as Array<{
    id: string;
    response_schema: Record<string, unknown>;
    estimated_minutes: number;
  }>;

  const store = await readStore();
  const planned: Array<{
    live_id: string;
    seed_id: string;
    from_schema: unknown;
    to_schema: unknown;
    from_minutes: unknown;
    to_minutes: unknown;
  }> = [];

  for (const sq of seed) {
    const schema = sq.response_schema;
    if (!schema || schema.version !== 2) continue;
    const live =
      store.questions.find((q) => q.id === sq.id) ??
      (() => {
        const fuzzy = store.questions.filter((q) => related(q.id, sq.id));
        return fuzzy.length === 1 ? fuzzy[0] : undefined;
      })();
    if (!live) continue;

    const schemaChanged =
      stableStringify(live.response_schema ?? {}) !== stableStringify(schema);
    const minutesChanged = live.estimated_minutes !== sq.estimated_minutes;
    if (!schemaChanged && !minutesChanged) continue;

    planned.push({
      live_id: live.id,
      seed_id: sq.id,
      from_schema: live.response_schema,
      to_schema: schema,
      from_minutes: live.estimated_minutes,
      to_minutes: sq.estimated_minutes,
    });
  }

  const report = {
    apply,
    generated_at: new Date().toISOString(),
    planned_updates: planned.length,
    answer_count_before: store.answers.length,
    decision_count_before: store.decisions.length,
    planned: planned.map((p) => ({
      live_id: p.live_id,
      seed_id: p.seed_id,
      from_minutes: p.from_minutes,
      to_minutes: p.to_minutes,
      from_mode: (p.from_schema as { mode?: string } | null)?.mode,
      to_mode: (p.to_schema as { mode?: string } | null)?.mode,
    })),
  };
  writeFileSync(
    path.join(process.cwd(), "docs/question-experience-v2-remote-sync.json"),
    JSON.stringify(report, null, 2),
  );

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          planned: planned.length,
          report: "docs/question-experience-v2-remote-sync.json",
        },
        null,
        2,
      ),
    );
    return;
  }

  const answerCountBefore = store.answers.length;
  const versionCountBefore = store.answer_versions.length;
  const decisionCountBefore = store.decisions.length;
  const questionIdsBefore = store.questions.map((q) => q.id).sort();

  await updateStore(
    (draft) => {
      for (const row of planned) {
        const q = draft.questions.find((x) => x.id === row.live_id);
        if (!q) continue;
        q.response_schema = row.to_schema as Record<string, unknown>;
        q.estimated_minutes = row.to_minutes as number;
      }
      return draft;
    },
    { operation: "syncQuestionExperienceV2" },
  );

  const after = await readStore();
  const verify = {
    apply: true,
    updated: planned.length,
    answers_unchanged: after.answers.length === answerCountBefore,
    answer_versions_unchanged: after.answer_versions.length === versionCountBefore,
    decisions_unchanged: after.decisions.length === decisionCountBefore,
    ids_unchanged:
      JSON.stringify(after.questions.map((q) => q.id).sort()) ===
      JSON.stringify(questionIdsBefore),
    answer_count_before: answerCountBefore,
    answer_count_after: after.answers.length,
  };
  writeFileSync(
    path.join(process.cwd(), "docs/question-experience-v2-remote-sync-result.json"),
    JSON.stringify({ ...report, verify }, null, 2),
  );
  console.log(JSON.stringify(verify, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
