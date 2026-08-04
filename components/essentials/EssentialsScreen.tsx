"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Answer, FamilyMember, Question } from "@/lib/types/models";
import type { EssentialsScreenDef } from "@/lib/essentials/pathway";
import { actionSaveEssentialsAnswersBatch } from "@/lib/actions/essentials";
import type { DecisionStatus } from "@/lib/constants/enums";
import type { SaveAnswerInput } from "@/lib/validation/schemas";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  PendingNavigationGuard,
  RetrySavePanel,
  SaveButton,
  SlowSaveNotice,
} from "@/components/ui/save-feedback";
import { essentialsShowSeparateEditors } from "@/lib/discussions/discussion-mode";

type SaveMode =
  | "continue"
  | "pause"
  | "undecided"
  | "discuss_later"
  | "needs_research"
  | "waiting_spouse";

export function EssentialsScreenView({
  screen,
  question,
  pairedQuestions,
  answers,
  pairedAnswers,
  members,
  nextHref,
  moduleTitle,
  progressLabel,
  sessionMode,
}: {
  screen: EssentialsScreenDef;
  question: Question;
  pairedQuestions: Question[];
  answers: Answer[];
  pairedAnswers: Record<string, Answer[]>;
  members: FamilyMember[];
  nextHref: string | null;
  moduleTitle: string;
  progressLabel: string;
  sessionMode?: boolean;
}) {
  const router = useRouter();
  const saveFb = useSaveFeedback();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pending = saveFb.isBusy;

  const sam = members.find((m) => m.display_name === "Sam");
  const michelle = members.find((m) => m.display_name === "Michelle");

  const shared = answers.find((a) => a.is_shared);
  const samAnswer = answers.find((a) => a.member_id === sam?.id);
  const michelleAnswer = answers.find((a) => a.member_id === michelle?.id);

  const optionList = useMemo(() => screen.options ?? [], [screen.options]);
  const optionSet = useMemo(() => new Set(optionList), [optionList]);

  function filterSelected(values: string[]): string[] {
    if (optionSet.size === 0) return values;
    return values.filter((v) => optionSet.has(v));
  }

  const [selected, setSelected] = useState<string[]>(() => {
    const c = shared?.payload.choice;
    if (Array.isArray(c)) return filterSelected(c);
    if (typeof c === "string" && c) return filterSelected([c]);
    return [];
  });
  const [single, setSingle] = useState(() => {
    const v =
      typeof shared?.payload.choice === "string" ? shared.payload.choice : "";
    return v && (optionSet.size === 0 || optionSet.has(v)) ? v : "";
  });
  const [samText, setSamText] = useState(samAnswer?.payload.text ?? "");
  const [michelleText, setMichelleText] = useState(
    michelleAnswer?.payload.text ?? "",
  );
  const [sharedText, setSharedText] = useState(shared?.payload.text ?? "");
  const [notes, setNotes] = useState(shared?.payload.notes ?? "");
  const [matrix, setMatrix] = useState<Record<string, string>>(
    shared?.payload.matrix ?? {},
  );
  const [policy, setPolicy] = useState<Record<string, string>>(() => {
    const lines = (shared?.payload.text ?? "").split("\n");
    const out: Record<string, string> = {};
    for (const field of screen.policy_fields ?? []) {
      const hit = lines.find((l) => l.startsWith(`${field}:`));
      out[field] = hit ? hit.slice(field.length + 1).trim() : "";
    }
    return out;
  });
  const [pairedSam, setPairedSam] = useState(
    () =>
      pairedQuestions[0]
        ? pairedAnswers[pairedQuestions[0].id]?.find((a) => a.member_id === sam?.id)
            ?.payload.text ?? ""
        : "",
  );
  const [pairedMichelle, setPairedMichelle] = useState(
    () =>
      pairedQuestions[0]
        ? pairedAnswers[pairedQuestions[0].id]?.find(
            (a) => a.member_id === michelle?.id,
          )?.payload.text ?? ""
        : "",
  );
  const [identityError, setIdentityError] = useState<string | null>(null);
  const mountQuestionIdRef = useRef(screen.question_id);

  const maxMulti =
    screen.id === "b1_labor_priorities" || screen.id === "f1_success" ? 5 : 99;

  const differences = useMemo(() => {
    if (!samText.trim() || !michelleText.trim()) return null;
    if (samText.trim() === michelleText.trim()) return null;
    return true;
  }, [samText, michelleText]);

  const showSeparate = essentialsShowSeparateEditors(screen, question);

  function toggleMulti(option: string) {
    setSelected((prev) => {
      if (prev.includes(option)) return prev.filter((x) => x !== option);
      if (prev.length >= maxMulti) return prev;
      return [...prev, option];
    });
  }

  function statusFor(mode: SaveMode): DecisionStatus {
    if (mode === "undecided") return "undecided";
    if (mode === "discuss_later") return "review_scheduled";
    if (mode === "needs_research") return "needs_research";
    if (mode === "waiting_spouse") return "in_discussion";
    if (mode === "pause") return "in_discussion";
    return "tentatively_decided";
  }

  function buildSharedPayload(): {
    text?: string;
    choice?: string | string[];
    notes?: string;
    matrix?: Record<string, string>;
  } {
    const notesValue = notes || undefined;
    if (
      screen.response_type === "multi_select" ||
      screen.response_type === "scenario_plan"
    ) {
      return {
        notes: notesValue,
        choice: selected,
        text: selected.join("; "),
      };
    }
    if (screen.response_type === "single_choice") {
      return { notes: notesValue, choice: single, text: single };
    }
    if (screen.response_type === "responsibility_matrix") {
      return {
        notes: notesValue,
        matrix,
        text: Object.entries(matrix)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
      };
    }
    if (screen.response_type === "policy_builder") {
      return {
        notes: notesValue,
        choice: selected,
        text: (screen.policy_fields ?? [])
          .map((f) => `${f}: ${policy[f] ?? ""}`)
          .join("\n"),
      };
    }
    return { notes: notesValue, text: sharedText };
  }

  function buildWrites(mode: SaveMode): SaveAnswerInput[] {
    const status = statusFor(mode);
    const needs_research = mode === "needs_research";
    const writes: SaveAnswerInput[] = [];

    if (
      showSeparate &&
      (screen.separate_answers ||
        screen.response_type === "separate_then_shared")
    ) {
      if (sam?.id && samText.trim()) {
        writes.push({
          question_id: screen.question_id,
          member_id: sam.id,
          is_shared: false,
          payload: { text: samText, notes: notes || undefined },
          status,
          confidence: 3,
          needs_research,
          change_reason: "Essentials separate answer",
        });
      }
      if (michelle?.id && michelleText.trim()) {
        writes.push({
          question_id: screen.question_id,
          member_id: michelle.id,
          is_shared: false,
          payload: { text: michelleText, notes: notes || undefined },
          status,
          confidence: 3,
          needs_research,
          change_reason: "Essentials separate answer",
        });
      }
    }

    if (screen.response_type === "paired_text" && pairedQuestions[0]) {
      const pairedId = pairedQuestions[0].id;
      if (sam?.id) {
        writes.push({
          question_id: pairedId,
          member_id: sam.id,
          is_shared: false,
          payload: { text: pairedSam },
          status,
          confidence: 3,
          change_reason: "Essentials paired answer",
        });
      }
      if (michelle?.id) {
        writes.push({
          question_id: pairedId,
          member_id: michelle.id,
          is_shared: false,
          payload: { text: pairedMichelle },
          status,
          confidence: 3,
          change_reason: "Essentials paired answer",
        });
      }
      if (screen.id === "f3_childhood") {
        if (sam?.id) {
          writes.push({
            question_id: screen.question_id,
            member_id: sam.id,
            is_shared: false,
            payload: { text: samText },
            status,
            confidence: 3,
            change_reason: "Essentials childhood repeat",
          });
        }
        if (michelle?.id) {
          writes.push({
            question_id: screen.question_id,
            member_id: michelle.id,
            is_shared: false,
            payload: { text: michelleText },
            status,
            confidence: 3,
            change_reason: "Essentials childhood repeat",
          });
        }
      }
    }

    writes.push({
      question_id: screen.question_id,
      member_id: null,
      is_shared: true,
      payload: buildSharedPayload(),
      status,
      confidence: 3,
      needs_research,
      change_reason: "Essentials shared answer",
    });
    return writes;
  }

  function assertEssentialsWrites(writes: SaveAnswerInput[]) {
    if (mountQuestionIdRef.current !== screen.question_id) {
      return { ok: false as const, reason: "question_mismatch" };
    }
    const allowedQuestionIds = new Set([
      screen.question_id,
      ...pairedQuestions.map((q) => q.id),
    ]);
    for (const w of writes) {
      if (!allowedQuestionIds.has(w.question_id)) {
        return { ok: false as const, reason: "question_mismatch" };
      }
      const choice = w.payload.choice;
      if (typeof choice === "string" && choice && optionSet.size > 0) {
        if (!optionSet.has(choice)) {
          return { ok: false as const, reason: "stale_option" };
        }
      }
      if (Array.isArray(choice) && optionSet.size > 0) {
        for (const c of choice) {
          if (!optionSet.has(c)) {
            return { ok: false as const, reason: "stale_option" };
          }
        }
      }
    }
    return { ok: true as const };
  }

  function save(mode: SaveMode) {
    setMessage(null);
    setIdentityError(null);
    void saveFb.runSave(
      async () => {
        const writes = buildWrites(mode);
        const check = assertEssentialsWrites(writes);
        if (!check.ok) {
          setIdentityError(
            "This answer no longer matches the current question. Reload and retry.",
          );
          console.info("[stale_payload]", {
            reason: check.reason,
            screenId: screen.id,
            questionId: screen.question_id,
          });
          throw new Error(
            "This answer no longer matches the current question. Reload and retry.",
          );
        }
        await actionSaveEssentialsAnswersBatch({
          answers: writes,
          mutationId: saveFb.mutationId(),
        });
      },
      {
        operation: `essentials_${mode}`,
        route: "/questions/before-birth",
        questionId: screen.question_id,
        advanceAfterSave: mode === "continue" && Boolean(nextHref),
        onSuccess: async () => {
          if (mode === "pause") {
            setMessage("Saved. You can resume anytime.");
            router.push("/questions/before-birth");
            return;
          }
          if (mode === "continue" && nextHref) {
            router.push(nextHref);
            return;
          }
          setMessage("Saved.");
          router.refresh();
        },
      },
    );
  }

  return (
    <div className={clsx("mx-auto max-w-xl space-y-4", sessionMode && "pb-28")}>
      <div className="text-xs text-ink-subtle">
        {moduleTitle} · {progressLabel}
      </div>
      <header className="space-y-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl leading-snug text-ink outline-none sm:text-3xl"
        >
          {screen.title}
        </h1>
        <p className="text-sm text-ink-muted">{screen.purpose}</p>
        <p className="rounded-xl bg-bg-elevated px-3 py-2 text-sm text-ink-muted">
          {screen.helper}
        </p>
        {identityError ? (
          <p className="text-sm text-danger" role="alert">
            {identityError}
          </p>
        ) : null}
        {screen.provider_label ? (
          <p className="text-xs font-medium text-amber-800">{screen.provider_label}</p>
        ) : null}
      </header>

      {optionList.length > 0 &&
      (screen.response_type === "multi_select" ||
        screen.response_type === "scenario_plan" ||
        screen.response_type === "policy_builder") ? (
        <section className="space-y-2">
          <p className="text-sm font-medium">
            {screen.response_type === "multi_select"
              ? maxMulti < 99
                ? `Select up to ${maxMulti}`
                : "Select all that apply"
              : "Select options"}
          </p>
          <div className="grid gap-2">
            {optionList.map((option) => {
              const on = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={clsx(
                    "min-h-12 rounded-xl border px-3 py-3 text-left text-sm",
                    on ? "border-accent bg-accent/10" : "border-border",
                  )}
                  onClick={() => toggleMulti(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {screen.response_type === "single_choice" ? (
        <section className="grid gap-2">
          {optionList.map((option) => (
            <button
              key={option}
              type="button"
              className={clsx(
                "min-h-12 rounded-xl border px-3 py-3 text-left text-sm",
                single === option ? "border-accent bg-accent/10" : "border-border",
              )}
              onClick={() => setSingle(option)}
            >
              {option}
            </button>
          ))}
        </section>
      ) : null}

      {screen.response_type === "responsibility_matrix" ? (
        <section className="space-y-3">
          {(screen.matrix_rows ?? []).map((row) => (
            <label key={row} className="block text-sm">
              <span className="font-medium">{row}</span>
              <select
                className="input mt-1"
                value={matrix[row] ?? ""}
                onChange={(e) =>
                  setMatrix((m) => ({ ...m, [row]: e.target.value }))
                }
              >
                <option value="">Choose…</option>
                {(screen.matrix_owners ?? ["sam", "michelle", "both"]).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      ) : null}

      {screen.response_type === "policy_builder" ? (
        <section className="space-y-3">
          {(screen.policy_fields ?? []).map((field) => (
            <label key={field} className="block text-sm">
              <span className="font-medium">{field}</span>
              <input
                className="input mt-1"
                value={policy[field] ?? ""}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, [field]: e.target.value }))
                }
                placeholder="Your rule…"
              />
            </label>
          ))}
        </section>
      ) : null}

      {screen.response_type === "paired_text" ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-medium">Repeat from childhood</h3>
            <label className="mt-2 block text-sm">
              Sam
              <textarea
                className="input mt-1 min-h-24"
                value={samText}
                onChange={(e) => setSamText(e.target.value)}
              />
            </label>
            <label className="mt-2 block text-sm">
              Michelle
              <textarea
                className="input mt-1 min-h-24"
                value={michelleText}
                onChange={(e) => setMichelleText(e.target.value)}
              />
            </label>
          </div>
          <div>
            <h3 className="font-medium">Change from childhood</h3>
            <label className="mt-2 block text-sm">
              Sam
              <textarea
                className="input mt-1 min-h-24"
                value={pairedSam}
                onChange={(e) => setPairedSam(e.target.value)}
              />
            </label>
            <label className="mt-2 block text-sm">
              Michelle
              <textarea
                className="input mt-1 min-h-24"
                value={pairedMichelle}
                onChange={(e) => setPairedMichelle(e.target.value)}
              />
            </label>
          </div>
        </section>
      ) : null}

      {showSeparate &&
      (screen.separate_answers ||
        screen.response_type === "separate_then_shared") &&
      screen.response_type !== "paired_text" ? (
        <section className="space-y-3">
          <h3 className="font-medium">Separate answers</h3>
          <label className="block text-sm">
            Sam
            <textarea
              className="input mt-1 min-h-24"
              value={samText}
              onChange={(e) => setSamText(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Michelle
            <textarea
              className="input mt-1 min-h-24"
              value={michelleText}
              onChange={(e) => setMichelleText(e.target.value)}
            />
          </label>
          {differences ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Your separate answers differ. Review them before writing a shared
              conclusion — nothing is merged automatically.
            </p>
          ) : null}
          <label className="block text-sm">
            Shared conclusion
            <textarea
              className="input mt-1 min-h-24"
              value={sharedText}
              onChange={(e) => setSharedText(e.target.value)}
              placeholder="What you both agree on for now…"
            />
          </label>
        </section>
      ) : null}

      {!showSeparate &&
      screen.response_type === "separate_then_shared" ? (
        <label className="block text-sm">
          Shared family decision
          <textarea
            className="input mt-1 min-h-28"
            value={sharedText}
            onChange={(e) => setSharedText(e.target.value)}
            placeholder="Write what you decide together…"
          />
        </label>
      ) : null}

      {screen.response_type === "open_with_prompts" ? (
        <label className="block text-sm">
          Shared answer
          <textarea
            className="input mt-1 min-h-28"
            value={sharedText}
            onChange={(e) => setSharedText(e.target.value)}
          />
        </label>
      ) : null}

      <section>
        <h3 className="text-sm font-medium">Useful prompts</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {screen.prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <label className="block text-sm">
        Optional notes
        <textarea
          className="input mt-1 min-h-20"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <p className="text-xs text-ink-subtle">
        Timing: {screen.timing_reason} · Review: {screen.review_trigger}
      </p>
      <p className="text-xs text-ink-subtle">
        Linked library question:{" "}
        <Link href={`/questions/${question.slug}`} className="underline">
          {question.short_title}
        </Link>
      </p>

      {message ? <p className="text-sm text-accent-strong">{message}</p> : null}
      <div className="space-y-2">
        <SlowSaveNotice tier={saveFb.slowTier} />
        <RetrySavePanel
          state={saveFb.state}
          message={saveFb.statusMessage}
          onRetry={() => void saveFb.retry()}
          disabled={saveFb.isBusy}
        />
        <p className="sr-only" aria-live="polite">
          {saveFb.statusMessage}
        </p>
      </div>

      <div
        className={clsx(
          "grid gap-2 sm:grid-cols-2",
          sessionMode &&
            "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 p-3 backdrop-blur",
        )}
      >
        <SaveButton
          state={saveFb.state}
          idleLabel="Save and continue"
          className="min-h-12"
          onClick={() => save("continue")}
        />
        <button
          type="button"
          className="btn btn-secondary min-h-12"
          disabled={pending}
          onClick={() => save("pause")}
        >
          {saveFb.state === "saving" ? "Saving…" : "Save and pause"}
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11"
          disabled={pending}
          onClick={() => save("undecided")}
        >
          Undecided
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11"
          disabled={pending}
          onClick={() => save("discuss_later")}
        >
          Discuss later
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11"
          disabled={pending}
          onClick={() => save("needs_research")}
        >
          Waiting for provider
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11"
          disabled={pending}
          onClick={() => save("waiting_spouse")}
        >
          Waiting for spouse
        </button>
      </div>

      <PendingNavigationGuard
        open={saveFb.showLeaveGuard}
        onStay={saveFb.confirmStay}
        onLeave={saveFb.confirmLeave}
      />
    </div>
  );
}
