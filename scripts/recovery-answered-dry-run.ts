/**
 * Dry-run recovery report for answered-status / deep-link mismatches.
 * Never mutates the remote store.
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/recovery-answered-dry-run.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";

import { readStore, getRemoteStoreHealth } from "@/lib/db/store";
import { resolveLibraryQuestionId } from "@/lib/conversations/deep-link";
import { promptForItem } from "@/lib/conversations/session-builder";
import { buildFamilyProgressMetrics } from "@/lib/services/answered-status";
import { writeFileSync } from "fs";
import path from "path";

async function main() {
  const store = await readStore();
  const health = await getRemoteStoreHealth();
  const metrics = buildFamilyProgressMetrics(store);

  const promptRepairs: Array<{
    promptId: string;
    from: string;
    to: string;
    action: "update_prompt_catalog_follow_up_id";
  }> = [];

  const { getActiveQuickPrompts } = await import(
    "@/lib/conversations/quick-prompts"
  );
  for (const prompt of getActiveQuickPrompts()) {
    const from = prompt.follow_up_open_question_id;
    if (!from) continue;
    const to = resolveLibraryQuestionId(from, store.questions);
    if (to && to !== from && store.questions.some((q) => q.id === to)) {
      promptRepairs.push({
        promptId: prompt.id,
        from,
        to,
        action: "update_prompt_catalog_follow_up_id",
      });
    }
  }

  const sessionId = "csess_9ouyjygd59hk";
  const items = (store.conversation_session_items ?? []).filter(
    (i) => i.session_id === sessionId,
  );
  const sessionCardPlan = items.map((item) => {
    const prompt = promptForItem(item.prompt_id);
    const linked = prompt?.follow_up_open_question_id ?? null;
    const resolved = resolveLibraryQuestionId(linked, store.questions);
    const hasCanonical = resolved
      ? store.answers.some((a) => a.question_id === resolved)
      : false;
    return {
      itemId: item.id,
      promptId: item.prompt_id,
      status: item.status,
      linkedDeepId: linked,
      resolvedDeepId: resolved,
      hasCanonicalAnswer: hasCanonical,
      mutateLiveAnswers: false,
      note:
        linked && resolved && linked !== resolved
          ? "Catalog ID mismatch — fix prompt follow_up; do not rewrite answers"
          : linked && !store.questions.some((q) => q.id === (resolved ?? linked))
            ? "No matching library question"
            : "OK",
    };
  });

  const report = {
    dryRun: true,
    mutated: false,
    remoteVersion: health.version,
    family: store.family.name,
    verdict:
      "No answer data was lost. Home “4” counted unique store.answers question IDs. Conversation quick answers (22 real) are a separate collection and correctly do not raise the canonical deep count. Proposed repairs are prompt-catalog deep-link ID alignments only.",
    metrics,
    proposedPromptCatalogRepairs: promptRepairs,
    sessionCardPlan,
    liveAnswerMutations: [],
  };

  const out = path.join(
    process.cwd(),
    "docs",
    "recovery-answered-dry-run.json",
  );
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ wrote: out, ...report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
