"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSaveDecision } from "@/lib/actions";
import type { Decision, Outcome, Principle, Question } from "@/lib/types/models";
import { DECISION_STATUSES, DECISION_TYPES, EVIDENCE_QUALITY, CONFIDENCE_LABELS } from "@/lib/constants/enums";

export function DecisionForm({
  decision,
  outcomes,
  principles,
  questions,
}: {
  decision?: Decision;
  outcomes: Outcome[];
  principles: Principle[];
  questions: Question[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(decision?.title ?? "");
  const [statement, setStatement] = useState(decision?.statement ?? "");
  const [status, setStatus] = useState(decision?.status ?? "in_discussion");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(
    decision?.confidence ?? 3,
  );
  const [decisionType, setDecisionType] = useState(decision?.decision_type ?? "operational");
  const [reasoning, setReasoning] = useState(decision?.reasoning ?? "");
  const [sam, setSam] = useState(decision?.sam_perspective ?? "");
  const [michelle, setMichelle] = useState(decision?.michelle_perspective ?? "");
  const [shared, setShared] = useState(decision?.shared_conclusion ?? "");
  const [outcomeIds, setOutcomeIds] = useState<string[]>(decision?.outcome_ids ?? []);
  const [sourceQuestions, setSourceQuestions] = useState<string[]>(
    decision?.source_question_ids ?? [],
  );

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await actionSaveDecision({
            id: decision?.id,
            title,
            statement,
            status: status as never,
            confidence: confidence as 1 | 2 | 3 | 4 | 5 | null,
            decision_type: decisionType as never,
            reasoning,
            sam_perspective: sam || null,
            michelle_perspective: michelle || null,
            shared_conclusion: shared || null,
            outcome_ids: outcomeIds,
            source_question_ids: sourceQuestions,
            principle_ids: principles.slice(0, 1).map((p) => p.id),
            evidence_strength: decision?.evidence_strength ?? "practical_guidance",
            change_reason: decision ? "Updated decision" : "Created decision",
          });
          router.refresh();
          if (!decision) {
            setTitle("");
            setStatement("");
          }
        });
      }}
    >
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="statement">Decision statement</label>
        <textarea id="statement" className="textarea" value={statement} onChange={(e) => setStatement(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="confidence">Confidence</label>
          <select
            id="confidence"
            className="select"
            value={confidence ?? ""}
            onChange={(e) =>
              setConfidence(
                e.target.value === ""
                  ? null
                  : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
              )
            }
          >
            <option value="">Not rated</option>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{CONFIDENCE_LABELS[n]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" className="select" value={decisionType} onChange={(e) => setDecisionType(e.target.value as typeof decisionType)}>
            {DECISION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="reasoning">Reasoning</label>
        <textarea id="reasoning" className="textarea" value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="field">
          <label htmlFor="sam">Sam’s perspective</label>
          <textarea id="sam" className="textarea" value={sam} onChange={(e) => setSam(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="michelle">Michelle’s perspective</label>
          <textarea id="michelle" className="textarea" value={michelle} onChange={(e) => setMichelle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="shared">Shared conclusion</label>
          <textarea id="shared" className="textarea" value={shared} onChange={(e) => setShared(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Linked outcomes</label>
        <div className="max-h-40 overflow-auto rounded-xl border border-border p-3">
          {outcomes.slice(0, 40).map((o) => (
            <label key={o.id} className="mb-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={outcomeIds.includes(o.id)}
                onChange={(e) => {
                  setOutcomeIds((ids) =>
                    e.target.checked ? [...ids, o.id] : ids.filter((id) => id !== o.id),
                  );
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Source questions</label>
        <div className="max-h-40 overflow-auto rounded-xl border border-border p-3">
          {questions.map((q) => (
            <label key={q.id} className="mb-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sourceQuestions.includes(q.id)}
                onChange={(e) => {
                  setSourceQuestions((ids) =>
                    e.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id),
                  );
                }}
              />
              {q.short_title}
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Evidence quality options include: {EVIDENCE_QUALITY.join(", ")}.
      </p>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : decision ? "Update decision" : "Create decision"}
      </button>
    </form>
  );
}
