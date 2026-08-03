/**
 * Resolve whether prompt deep-link IDs exist in the question bank.
 * USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/audit-deep-links.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";

import { readStore } from "@/lib/db/store";
import { promptForItem } from "@/lib/conversations/session-builder";

async function main() {
  const store = await readStore();
  const session = store.conversation_sessions?.find(
    (s) => s.id === "csess_9ouyjygd59hk",
  );
  const items = (store.conversation_session_items ?? []).filter(
    (i) => i.session_id === "csess_9ouyjygd59hk",
  );
  const rows = items.map((item) => {
    const prompt = promptForItem(item.prompt_id);
    const deepId =
      prompt?.follow_up_open_question_id ?? item.source_question_id ?? null;
    const exact = deepId
      ? store.questions.find((q) => q.id === deepId)
      : null;
    const fuzzy = deepId
      ? store.questions
          .filter(
            (q) =>
              q.id.startsWith(deepId.slice(0, 36)) ||
              deepId.startsWith(q.id.slice(0, 36)),
          )
          .map((q) => q.id)
          .slice(0, 5)
      : [];
    return {
      promptId: item.prompt_id,
      deepId,
      exactMatch: Boolean(exact),
      fuzzyIds: fuzzy,
      proposedRepair:
        !exact && fuzzy.length === 1
          ? { from: deepId, to: fuzzy[0] }
          : null,
    };
  });

  const answered = store.answers.map((a) => ({
    question_id: a.question_id,
    is_shared: a.is_shared,
    member_id: a.member_id,
    status: a.status,
    updated_at: a.updated_at,
  }));

  console.log(
    JSON.stringify(
      {
        sessionId: session?.id,
        sessionStatus: session?.status,
        deepLinkAudit: rows,
        proposedRepairs: rows
          .map((r) => r.proposedRepair)
          .filter(Boolean),
        canonicalAnswerMeta: answered,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
