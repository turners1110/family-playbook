/**
 * Report Essentials screen discussion modes (read-only).
 */
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";

import { readStore } from "@/lib/db/store";
import {
  essentialsShowSeparateEditors,
  resolveDiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";

async function main() {
  const store = await readStore();
  const byId = new Map(store.questions.map((q) => [q.id, q]));
  const rows = ESSENTIALS_SCREENS.filter((s) => s.is_primary).map((screen) => {
    const q = byId.get(screen.question_id);
    const resolved = q
      ? resolveDiscussionMode({ question: q, preferExistingSeparate: false })
      : null;
    const uiSeparate = q
      ? essentialsShowSeparateEditors(screen, q)
      : null;
    return {
      screen_id: screen.id,
      title: screen.title,
      linked_question_ids: [
        screen.question_id,
        ...(screen.paired_question_ids ?? []),
      ],
      stored_mode: q?.discussion_mode ?? "missing",
      resolved_mode: resolved?.mode ?? null,
      reason: resolved?.reason ?? null,
      source: resolved?.source ?? null,
      actual_ui: uiSeparate ? "separate" : "shared",
      response_type: screen.response_type,
      flag_separate: resolved?.mode === "separate_first",
    };
  });

  const report = {
    total: rows.length,
    shared_ui: rows.filter((r) => r.actual_ui === "shared").length,
    separate_ui: rows.filter((r) => r.actual_ui === "separate").length,
    flagged_separate_first: rows.filter((r) => r.flag_separate),
    screens: rows,
  };
  const out = path.join(process.cwd(), "docs", "essentials-discussion-modes.json");
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
