"use client";

import Link from "next/link";
import { ConversationCard } from "@/components/conversations/ConversationCard";
import type {
  ConversationDifference,
  ConversationQuickAnswer,
  ConversationSession,
  ConversationSessionItem,
  FamilyMember,
} from "@/lib/types/models";
import type { MomentumSuggestion } from "@/lib/conversations/momentum";
import { getQaQuestion, QA_EXPECTED } from "@/lib/qa/question-pack";
import type { ConversationPromptDef } from "@/lib/conversations/response-types";
import {
  resolveDeepQuestionTarget,
  type DeepQuestionTarget,
} from "@/lib/conversations/deep-link";

export function QaSessionView({
  testRunId,
  session,
  item,
  prompt,
  answers,
  difference,
  members,
  itemIndex,
  itemCount,
  modeTitle,
  deepTarget: deepTargetProp,
}: {
  testRunId: string;
  session: ConversationSession;
  item: ConversationSessionItem;
  prompt: ConversationPromptDef;
  answers: ConversationQuickAnswer[];
  difference: ConversationDifference | null;
  members: FamilyMember[];
  itemIndex: number;
  itemCount: number;
  modeTitle: string;
  deepTarget?: DeepQuestionTarget | null;
}) {
  const qa = getQaQuestion(prompt.id);
  // Disable momentum replacement for QA — empty list.
  const momentum: MomentumSuggestion[] = [];
  const deepTarget =
    deepTargetProp ??
    resolveDeepQuestionTarget({
      questionId: prompt.follow_up_open_question_id,
      sessionId: session.id,
      sessionItemId: item.id,
      testRunId,
      returnTo: `/conversations/test/${testRunId}`,
    });

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden">
      <div className="mb-3 px-3">
        <div className="rounded-xl border border-warning/40 bg-warning-soft/50 p-3 text-sm">
          <div className="font-medium">QA Integrity Session</div>
          <div className="mt-1 font-mono text-xs">{testRunId}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/settings/test-lab" className="btn btn-ghost">
              Test Lab
            </Link>
            <Link
              href={`/settings/test-lab?run=${testRunId}`}
              className="btn btn-ghost"
            >
              Checklist
            </Link>
          </div>
        </div>
      </div>

      {qa ? (
        <aside className="mx-3 mb-3 rounded-xl border border-border bg-bg-elevated p-4 text-sm">
          <h2 className="font-display text-lg">Expected action</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
            {qa.expected_checks.map((c) => (
              <li key={c.id}>{c.description}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-subtle">
            Hint values (when applicable): short Sam “{QA_EXPECTED.short_sam}”;
            custom “{QA_EXPECTED.custom}”; trip memory “{QA_EXPECTED.trip_memory}
            ”.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-bg-muted px-2 py-1">
              Pass / Fail / Not tested — mark in Test Lab checklist
            </span>
          </div>
        </aside>
      ) : null}

      {item.branch_context?.grouped_with ? (
        <p className="mx-3 mb-2 text-sm text-ink-muted">
          Grouped screen: also answer{" "}
          {(item.branch_context.grouped_with as string[]).join(", ")} on the
          paired card (separate IDs).
        </p>
      ) : null}

      {prompt.follow_up_open_question_id ? (
        <aside className="mx-3 mb-3 rounded-xl border border-border bg-bg-elevated p-3 text-xs">
          <div className="font-medium">Quick → deep diagnostic</div>
          <dl className="mt-2 space-y-1 font-mono text-[11px] text-ink-muted">
            <div>linked: {prompt.follow_up_open_question_id}</div>
            <div>type: {deepTarget.type}</div>
            <div>exists: {deepTarget.exists ? "yes" : "no"}</div>
            <div className="break-all">route: {deepTarget.href ?? "(none)"}</div>
          </dl>
        </aside>
      ) : null}

      <ConversationCard
        session={session}
        item={item}
        prompt={prompt}
        answers={answers}
        difference={difference}
        members={members}
        itemIndex={itemIndex}
        itemCount={itemCount}
        momentum={momentum}
        modeTitle={modeTitle}
        deepTarget={deepTarget}
        sessionBaseHref={`/conversations/test/${testRunId}`}
      />
    </div>
  );
}
