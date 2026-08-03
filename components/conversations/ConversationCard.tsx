"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type {
  ConversationDifference,
  ConversationQuickAnswer,
  ConversationSession,
  ConversationSessionItem,
  FamilyMember,
} from "@/lib/types/models";
import type { ConversationPromptDef } from "@/lib/conversations/response-types";
import {
  ENERGY_LABELS,
  storeEnergyToLevel,
} from "@/lib/conversations/response-types";
import type { MomentumSuggestion } from "@/lib/conversations/momentum";
import {
  actionAdvanceConversation,
  actionAppendMomentum,
  actionCompleteConversation,
  actionOpenConversationItem,
  actionPauseConversation,
  actionResolveDifference,
  actionSaveConversationAnswersBatch,
  actionSkipConversationItem,
} from "@/lib/actions/conversations";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  CardSkeleton,
  PendingNavigationGuard,
  RetrySavePanel,
  SaveButton,
  SaveStatusBanner,
  SlowSaveNotice,
} from "@/components/ui/save-feedback";
import type { DeepQuestionTarget } from "@/lib/conversations/deep-link";
import {
  STALE_PAYLOAD_USER_MESSAGE,
  assertSaveIdentity,
  assertSelectedOptionsValid,
  clearDraft,
  draftStorageKey,
  formIdentityKey,
  readDraft,
  writeDraft,
  type ConversationDraftPayload,
} from "@/lib/ui/form-identity";

function answerSnapshot(a?: ConversationQuickAnswer | null): string {
  if (!a) return "";
  if (a.short_text) return a.short_text;
  if (a.selected_options.length) return a.selected_options.join(", ");
  if (a.scale != null) return String(a.scale);
  return "";
}

function emptyFormState() {
  return {
    samChoices: [] as string[],
    michelleChoices: [] as string[],
    samText: "",
    michelleText: "",
    samExplain: "",
    michelleExplain: "",
    samScale: null as number | null,
    michelleScale: null as number | null,
    customSam: "",
    customMichelle: "",
    sharedText: "",
    keepGoing: false,
  };
}

function stateFromAnswers(
  samAns?: ConversationQuickAnswer | null,
  michelleAns?: ConversationQuickAnswer | null,
) {
  return {
    ...emptyFormState(),
    samChoices: samAns?.selected_options ?? [],
    michelleChoices: michelleAns?.selected_options ?? [],
    samText: samAns?.short_text ?? "",
    michelleText: michelleAns?.short_text ?? "",
    samExplain: samAns?.explanation ?? "",
    michelleExplain: michelleAns?.explanation ?? "",
    samScale: samAns?.scale ?? null,
    michelleScale: michelleAns?.scale ?? null,
  };
}

export function ConversationCard({
  session,
  item,
  prompt,
  answers,
  difference: _difference,
  members,
  itemIndex,
  itemCount,
  momentum,
  modeTitle,
  deepTarget = null,
  sessionBaseHref,
  familyId = "family",
}: {
  session: ConversationSession;
  item: ConversationSessionItem;
  prompt: ConversationPromptDef;
  answers: ConversationQuickAnswer[];
  difference: ConversationDifference | null;
  members: FamilyMember[];
  itemIndex: number;
  itemCount: number;
  momentum: MomentumSuggestion[];
  modeTitle: string;
  deepTarget?: DeepQuestionTarget | null;
  sessionBaseHref?: string;
  familyId?: string;
}) {
  void _difference;
  const router = useRouter();
  const save = useSaveFeedback();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [showMomentum, setShowMomentum] = useState(false);
  const pending = save.isBusy;
  const baseHref =
    sessionBaseHref ??
    (session.test_run_id
      ? `/conversations/test/${session.test_run_id}`
      : `/conversations/session/${session.id}`);

  const identity = useMemo(
    () => ({
      sessionId: session.id,
      sessionItemId: item.id,
      questionId: prompt.id,
      screenGroup: item.branch_context?.grouped_with
        ? [prompt.id, ...(item.branch_context.grouped_with as string[])].join("+")
        : undefined,
    }),
    [session.id, item.id, prompt.id, item.branch_context],
  );
  const identityKey = formIdentityKey(identity);
  const draftKey = draftStorageKey(familyId, identity);

  const samMember = members.find((m) => m.display_name === "Sam");
  const michelleMember = members.find((m) => m.display_name === "Michelle");

  const samAns = answers.find((a) => a.actor === "sam");
  const michelleAns = answers.find((a) => a.actor === "michelle");

  const validOptionValues = useMemo(
    () => (prompt.answer_options ?? []).map((o) => o.value),
    [prompt.answer_options],
  );

  function filterChoices(choices: string[]): string[] {
    if (validOptionValues.length === 0 || prompt.allow_custom_answer) {
      return choices;
    }
    const allowed = new Set(validOptionValues);
    return choices.filter((c) => allowed.has(c));
  }

  const [form, setForm] = useState(() => {
    if (typeof window !== "undefined") {
      const draft = readDraft(draftKey);
      if (draft?.identityKey === identityKey) {
        return {
          samChoices: filterChoices(draft.samChoices),
          michelleChoices: filterChoices(draft.michelleChoices),
          samText: draft.samText,
          michelleText: draft.michelleText,
          samExplain: draft.samExplain,
          michelleExplain: draft.michelleExplain,
          samScale: draft.samScale,
          michelleScale: draft.michelleScale,
          customSam: draft.customSam,
          customMichelle: draft.customMichelle,
          sharedText: draft.sharedText,
          keepGoing: false,
        };
      }
    }
    const fromAnswers = stateFromAnswers(samAns, michelleAns);
    return {
      ...fromAnswers,
      samChoices: filterChoices(fromAnswers.samChoices),
      michelleChoices: filterChoices(fromAnswers.michelleChoices),
    };
  });
  const [draftRestored, setDraftRestored] = useState(() => {
    if (typeof window === "undefined") return false;
    const draft = readDraft(draftKey);
    return Boolean(draft?.identityKey === identityKey);
  });
  const [identityError, setIdentityError] = useState<string | null>(null);
  // Frozen at mount — parent must remount on identity change via key=.
  // Detects props drift if a key is missing (blocks stale saves).
  const mountIdentityRef = useRef({
    sessionId: session.id,
    sessionItemId: item.id,
    questionId: prompt.id,
  });

  useEffect(() => {
    void actionOpenConversationItem(session.id, item.id);
    headingRef.current?.focus();
    if (itemIndex < itemCount - 1) {
      router.prefetch(baseHref);
      if (deepTarget?.href) router.prefetch(deepTarget.href);
    }
  }, [
    item.id,
    session.id,
    itemIndex,
    itemCount,
    router,
    baseHref,
    deepTarget?.href,
  ]);

  // Persist unsaved draft for THIS identity only (external sessionStorage).
  useEffect(() => {
    const payload: ConversationDraftPayload = {
      identityKey,
      samChoices: form.samChoices,
      michelleChoices: form.michelleChoices,
      samText: form.samText,
      michelleText: form.michelleText,
      samExplain: form.samExplain,
      michelleExplain: form.michelleExplain,
      samScale: form.samScale,
      michelleScale: form.michelleScale,
      customSam: form.customSam,
      customMichelle: form.customMichelle,
      sharedText: form.sharedText,
      updatedAt: new Date().toISOString(),
    };
    writeDraft(draftKey, payload);
  }, [form, draftKey, identityKey]);

  const {
    samChoices,
    michelleChoices,
    samText,
    michelleText,
    samExplain,
    michelleExplain,
    samScale,
    michelleScale,
    customSam,
    customMichelle,
    sharedText,
    keepGoing,
  } = form;

  const setSamChoices = (v: string[] | ((p: string[]) => string[])) =>
    setForm((f) => ({
      ...f,
      samChoices: typeof v === "function" ? v(f.samChoices) : v,
    }));
  const setMichelleChoices = (v: string[] | ((p: string[]) => string[])) =>
    setForm((f) => ({
      ...f,
      michelleChoices: typeof v === "function" ? v(f.michelleChoices) : v,
    }));
  const setSamText = (v: string) => setForm((f) => ({ ...f, samText: v }));
  const setMichelleText = (v: string) =>
    setForm((f) => ({ ...f, michelleText: v }));
  const setSamExplain = (v: string) =>
    setForm((f) => ({ ...f, samExplain: v }));
  const setMichelleExplain = (v: string) =>
    setForm((f) => ({ ...f, michelleExplain: v }));
  const setSamScale = (v: number | null) =>
    setForm((f) => ({ ...f, samScale: v }));
  const setMichelleScale = (v: number | null) =>
    setForm((f) => ({ ...f, michelleScale: v }));
  const setCustomSam = (v: string) => setForm((f) => ({ ...f, customSam: v }));
  const setCustomMichelle = (v: string) =>
    setForm((f) => ({ ...f, customMichelle: v }));
  const setSharedText = (v: string) =>
    setForm((f) => ({ ...f, sharedText: v }));
  const setKeepGoing = (v: boolean) => setForm((f) => ({ ...f, keepGoing: v }));

  const energyLabel = ENERGY_LABELS[storeEnergyToLevel(item.energy)];
  const differs =
    item.status === "answered_different" ||
    (Boolean(answerSnapshot(samAns)) &&
      Boolean(answerSnapshot(michelleAns)) &&
      answerSnapshot(samAns) !== answerSnapshot(michelleAns));

  const deepHref =
    deepTarget?.exists && deepTarget.href ? deepTarget.href : null;
  const deepUnavailable =
    Boolean(prompt.follow_up_open_question_id) &&
    (!deepTarget || deepTarget.type === "unavailable" || !deepTarget.href);

  const progressPct = Math.round(((itemIndex + 1) / Math.max(itemCount, 1)) * 100);

  function toggleChoice(
    actor: "sam" | "michelle",
    value: string,
    multi: boolean,
  ) {
    const setter = actor === "sam" ? setSamChoices : setMichelleChoices;
    setter((prev) => {
      if (multi) {
        return prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
      }
      return [value];
    });
  }

  function buildActorWrite(actor: "sam" | "michelle") {
    const choices = actor === "sam" ? samChoices : michelleChoices;
    const custom = actor === "sam" ? customSam : customMichelle;
    const text = actor === "sam" ? samText : michelleText;
    const explain = actor === "sam" ? samExplain : michelleExplain;
    const scale = actor === "sam" ? samScale : michelleScale;
    const selected =
      prompt.allow_custom_answer && custom.trim()
        ? [...choices, custom.trim()]
        : choices;
    return {
      actor,
      selectedOptions:
        prompt.response_type === "short_text" ||
        prompt.response_type === "open_time_boxed"
          ? []
          : selected,
      shortText:
        prompt.response_type === "short_text" ||
        prompt.response_type === "open_time_boxed"
          ? text
          : null,
      explanation: explain || null,
      scale: prompt.response_type === "reaction_scale" ? scale : null,
    };
  }

  function assertCurrentPayload(writes: ReturnType<typeof buildActorWrite>[]) {
    const mounted = mountIdentityRef.current;
    const idCheck = assertSaveIdentity({
      expectedSessionId: mounted.sessionId,
      expectedSessionItemId: mounted.sessionItemId,
      expectedQuestionId: mounted.questionId,
      payloadSessionId: session.id,
      payloadSessionItemId: item.id,
      payloadQuestionId: prompt.id,
    });
    if (!idCheck.ok) return idCheck;
    for (const w of writes) {
      const optCheck = assertSelectedOptionsValid(
        w.selectedOptions ?? [],
        validOptionValues,
        Boolean(prompt.allow_custom_answer),
      );
      if (!optCheck.ok) return optCheck;
    }
    return { ok: true as const };
  }

  function saveActor(actor: "sam" | "michelle") {
    void save.runSave(
      async () => {
        const writes = [buildActorWrite(actor)];
        const check = assertCurrentPayload(writes);
        if (!check.ok) {
          setIdentityError(STALE_PAYLOAD_USER_MESSAGE);
          console.info("[stale_payload]", {
            reason: check.reason,
            sessionId: session.id,
            sessionItemId: item.id,
            questionId: prompt.id,
          });
          throw new Error(STALE_PAYLOAD_USER_MESSAGE);
        }
        const ack = await actionSaveConversationAnswersBatch({
          sessionId: session.id,
          itemId: item.id,
          answers: writes,
          mutationId: save.mutationId(),
          testRunId: session.test_run_id,
          expectedPromptId: prompt.id,
        });
        if (!ack.ok || !ack.verified) {
          throw new Error(
            "Save could not be verified. Your answer is still on this screen.",
          );
        }
        clearDraft(draftKey);
        setDraftRestored(false);
        return ack;
      },
      {
        operation: `save_actor_${actor}`,
        route: "/conversations/session",
        sessionId: session.id,
        testRunId: session.test_run_id,
        questionId: prompt.id,
        onSuccess: async () => {
          router.refresh();
        },
      },
    );
  }

  function saveAndNext() {
    void save.runSave(
      async () => {
        const writes = [buildActorWrite("sam"), buildActorWrite("michelle")];
        const check = assertCurrentPayload(writes);
        if (!check.ok) {
          setIdentityError(STALE_PAYLOAD_USER_MESSAGE);
          console.info("[stale_payload]", {
            reason: check.reason,
            sessionId: session.id,
            sessionItemId: item.id,
            questionId: prompt.id,
          });
          throw new Error(STALE_PAYLOAD_USER_MESSAGE);
        }
        const ack = await actionSaveConversationAnswersBatch({
          sessionId: session.id,
          itemId: item.id,
          answers: writes,
          mutationId: save.mutationId(),
          testRunId: session.test_run_id,
          expectedPromptId: prompt.id,
          advance: itemIndex < itemCount - 1,
        });
        if (!ack.ok || !ack.verified) {
          throw new Error(
            "Save could not be verified. Your answer is still on this screen.",
          );
        }
        clearDraft(draftKey);
        setDraftRestored(false);
        return ack;
      },
      {
        operation: "save_and_next",
        route: "/conversations/session",
        sessionId: session.id,
        testRunId: session.test_run_id,
        questionId: prompt.id,
        advanceAfterSave: itemIndex < itemCount - 1,
        onSuccess: async () => {
          if (itemIndex >= itemCount - 1) {
            setShowMomentum(true);
            router.push(baseHref);
            router.refresh();
            return;
          }
          router.push(baseHref);
          router.refresh();
        },
      },
    );
  }

  function runGuarded(fn: () => Promise<unknown>) {
    void save.runSave(fn, {
      operation: "conversation_action",
      sessionId: session.id,
      testRunId: session.test_run_id,
      questionId: prompt.id,
      onSuccess: async () => router.refresh(),
    });
  }

  const scalePoints = useMemo(() => {
    const min = prompt.scale_min ?? 1;
    const max = prompt.scale_max ?? 5;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [prompt.scale_max, prompt.scale_min]);

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-3 pb-28 pt-3">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span>{modeTitle}</span>
          <span>{energyLabel}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {itemIndex + 1} of {itemCount}
        </p>
      </header>

      <article
        className="surface animate-[fadeUp_280ms_ease-out] p-5"
        key={identityKey}
      >
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl leading-snug text-ink outline-none"
        >
          {prompt.prompt}
        </h1>
        {draftRestored ? (
          <p className="mt-2 text-sm text-accent-strong" role="status">
            Unsaved draft restored
          </p>
        ) : null}
        {identityError ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {identityError}
          </p>
        ) : null}
        {prompt.suggested_discussion_minutes ? (
          <p className="mt-2 text-sm text-ink-muted">
            Suggested discussion: about {prompt.suggested_discussion_minutes}{" "}
            minutes. No timer — wrap up when you are ready.
          </p>
        ) : null}

        <div className="mt-6 space-y-6">
          <ParentBlock
            name="Sam"
            memberHint={samMember?.display_name}
            prompt={prompt}
            choices={samChoices}
            text={samText}
            explain={samExplain}
            scale={samScale}
            custom={customSam}
            scalePoints={scalePoints}
            onToggle={(v) =>
              toggleChoice("sam", v, prompt.allow_multiple_selections)
            }
            onText={setSamText}
            onExplain={setSamExplain}
            onScale={setSamScale}
            onCustom={setCustomSam}
            onSave={() => saveActor("sam")}
            pending={pending}
          />
          <ParentBlock
            name="Michelle"
            memberHint={michelleMember?.display_name}
            prompt={prompt}
            choices={michelleChoices}
            text={michelleText}
            explain={michelleExplain}
            scale={michelleScale}
            custom={customMichelle}
            scalePoints={scalePoints}
            onToggle={(v) =>
              toggleChoice("michelle", v, prompt.allow_multiple_selections)
            }
            onText={setMichelleText}
            onExplain={setMichelleExplain}
            onScale={setMichelleScale}
            onCustom={setCustomMichelle}
            onSave={() => saveActor("michelle")}
            pending={pending}
          />
        </div>

        {prompt.response_type === "either_or" ||
        prompt.response_type === "quick_pick" ? (
          <div className="mt-4">
            <label className="text-sm text-ink-muted">
              Optional short explanation
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
              rows={2}
              value={samExplain}
              onChange={(e) => setSamExplain(e.target.value)}
              placeholder="What matters most behind your answer?"
            />
          </div>
        ) : null}

        {prompt.response_type === "open_time_boxed" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => setKeepGoing(true)}
            >
              Keep going
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={saveAndNext}
            >
              Wrap up
            </button>
            {keepGoing ? (
              <p className="w-full text-sm text-ink-muted">
                Take the time you need. Save when you are ready.
              </p>
            ) : null}
          </div>
        ) : null}

        {differs ? (
          <DifferencePanel
            sam={answerSnapshot(samAns) || samChoices.join(", ") || samText}
            michelle={
              answerSnapshot(michelleAns) ||
              michelleChoices.join(", ") ||
              michelleText
            }
            samReason={samExplain}
            michelleReason={michelleExplain}
            onSamReason={setSamExplain}
            onMichelleReason={setMichelleExplain}
            sharedText={sharedText}
            onSharedText={setSharedText}
            pending={pending}
            onResolve={(resolution) =>
              runGuarded(() =>
                actionResolveDifference({
                  sessionId: session.id,
                  promptId: prompt.id,
                  resolution,
                  samReason: samExplain || null,
                  michelleReason: michelleExplain || null,
                  sharedAnswerText:
                    resolution === "shared_answer_created"
                      ? sharedText || null
                      : null,
                  mutationId: save.mutationId(),
                }),
              )
            }
            deepHref={deepHref}
            deepUnavailable={deepUnavailable}
          />
        ) : null}

        {prompt.follow_up_open_question_id ? (
          <div className="mt-5 rounded-xl bg-accent-soft/60 p-4">
            <p className="text-sm font-medium text-ink">Talk more about this</p>
            <p className="mt-1 text-sm text-ink-muted">
              Your quick answers stay as context when you open the deeper
              discussion.
            </p>
            {deepHref ? (
              <Link
                href={deepHref}
                className="btn btn-secondary mt-3"
                onClick={async (e) => {
                  if (save.isBusy) {
                    e.preventDefault();
                    const leave = await save.requestLeave();
                    if (leave) router.push(deepHref);
                  }
                }}
              >
                Open deeper question
              </Link>
            ) : (
              <p className="mt-3 text-sm text-ink-muted" role="status">
                Deeper discussion is not available yet.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          <SlowSaveNotice tier={save.slowTier} />
          <RetrySavePanel
            state={save.state}
            message={save.statusMessage}
            onRetry={() => void save.retry()}
            disabled={save.isBusy}
          />
          <p className="sr-only" aria-live="polite">
            {save.statusMessage}
          </p>
        </div>
      </article>

      {save.state === "moving_to_next" ? (
        <div className="mt-4">
          <CardSkeleton />
        </div>
      ) : null}

      {showMomentum || itemIndex >= itemCount - 1 ? (
        <section className="surface mt-4 p-5">
          <h2 className="font-display text-xl">You&apos;re on a roll</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Continue this topic, switch topics, or wrap up.
          </p>
          <ul className="mt-3 space-y-2">
            {momentum.map((m) => (
              <li key={m.prompt_id}>
                <button
                  type="button"
                  className="btn btn-secondary w-full justify-start text-left"
                  disabled={pending}
                  onClick={() =>
                    runGuarded(async () => {
                      await actionAppendMomentum(session.id, m.prompt_id);
                      setShowMomentum(false);
                    })
                  }
                >
                  <span>
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-xs text-ink-muted">
                      {m.reason}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                runGuarded(async () => {
                  await actionCompleteConversation(session.id);
                  router.push(`/conversations/session/${session.id}/summary`);
                })
              }
            >
              Wrap up session
            </button>
            {itemIndex < itemCount - 1 ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pending}
                onClick={() =>
                  runGuarded(() =>
                    actionAdvanceConversation(session.id, "next"),
                  )
                }
              >
                Continue session
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-elevated/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <SaveStatusBanner state={save.state} message={save.statusMessage} />
          <SlowSaveNotice tier={save.slowTier} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary min-h-11 flex-1"
              disabled={pending || itemIndex === 0}
              onClick={() =>
                runGuarded(() => actionAdvanceConversation(session.id, "back"))
              }
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11"
              disabled={pending}
              onClick={() =>
                runGuarded(() =>
                  actionSkipConversationItem(
                    session.id,
                    item.id,
                    "skipped",
                    save.mutationId(),
                  ),
                )
              }
            >
              Skip
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11"
              disabled={pending}
              onClick={() =>
                runGuarded(() =>
                  actionSkipConversationItem(
                    session.id,
                    item.id,
                    "discuss_later",
                    save.mutationId(),
                  ),
                )
              }
            >
              Later
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11"
              disabled={pending}
              onClick={() =>
                void save.runSave(
                  async () => {
                    await actionPauseConversation(session.id);
                  },
                  {
                    operation: "pause_session",
                    sessionId: session.id,
                    testRunId: session.test_run_id,
                    questionId: prompt.id,
                    onSuccess: async () => router.push("/conversations"),
                  },
                )
              }
            >
              {save.state === "saving" ? "Saving…" : "Pause"}
            </button>
            <SaveButton
              state={save.state}
              className="min-h-11 flex-[1.4]"
              onClick={saveAndNext}
            />
          </div>
        </div>
      </div>

      <PendingNavigationGuard
        open={save.showLeaveGuard}
        onStay={save.confirmStay}
        onLeave={save.confirmLeave}
      />
    </div>
  );
}

function ParentBlock({
  name,
  prompt,
  choices,
  text,
  explain,
  scale,
  custom,
  scalePoints,
  onToggle,
  onText,
  onExplain,
  onScale,
  onCustom,
  onSave,
  pending,
}: {
  name: string;
  memberHint?: string;
  prompt: ConversationPromptDef;
  choices: string[];
  text: string;
  explain: string;
  scale: number | null;
  custom: string;
  scalePoints: number[];
  onToggle: (v: string) => void;
  onText: (v: string) => void;
  onExplain: (v: string) => void;
  onScale: (v: number) => void;
  onCustom: (v: string) => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {name}
        </h2>
        <button
          type="button"
          className="text-sm text-accent underline"
          disabled={pending}
          onClick={onSave}
        >
          Save {name}
        </button>
      </div>

      {(prompt.response_type === "quick_pick" ||
        prompt.response_type === "either_or") && (
        <div className="flex flex-col gap-2">
          {prompt.answer_options.map((opt) => {
            const selected = choices.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={clsx(
                  "min-h-12 w-full rounded-xl border px-4 py-3 text-left text-base transition-colors",
                  selected
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-border bg-bg-elevated text-ink",
                )}
              >
                {opt.label}
              </button>
            );
          })}
          {prompt.allow_custom_answer ? (
            <input
              className="min-h-12 w-full rounded-xl border border-border bg-bg-elevated px-4 text-base"
              placeholder="Custom answer"
              value={custom}
              onChange={(e) => onCustom(e.target.value)}
            />
          ) : null}
        </div>
      )}

      {(prompt.response_type === "short_text" ||
        prompt.response_type === "open_time_boxed") && (
        <textarea
          className="min-h-20 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
          rows={prompt.response_type === "open_time_boxed" ? 4 : 2}
          maxLength={prompt.short_text_max_length ?? undefined}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Your answer"
        />
      )}

      {prompt.response_type === "reaction_scale" && (
        <div>
          <div className="mb-2 flex justify-between text-xs text-ink-muted">
            <span>{prompt.scale_low_label}</span>
            <span>{prompt.scale_high_label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {scalePoints.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onScale(n)}
                className={clsx(
                  "min-h-12 min-w-12 rounded-xl border text-base",
                  scale === n
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-bg-elevated",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            className="mt-2 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
            rows={2}
            value={explain}
            onChange={(e) => onExplain(e.target.value)}
            placeholder="Optional explanation"
          />
        </div>
      )}
    </div>
  );
}

function DifferencePanel({
  sam,
  michelle,
  samReason,
  michelleReason,
  onSamReason,
  onMichelleReason,
  sharedText,
  onSharedText,
  onResolve,
  pending,
  deepHref,
  deepUnavailable,
}: {
  sam: string;
  michelle: string;
  samReason: string;
  michelleReason: string;
  onSamReason: (v: string) => void;
  onMichelleReason: (v: string) => void;
  sharedText: string;
  onSharedText: (v: string) => void;
  onResolve: (
    r:
      | "shared_answer_created"
      | "kept_separate"
      | "discuss_later"
      | "opened_deep",
  ) => void;
  pending: boolean;
  deepHref: string | null;
  deepUnavailable?: boolean;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-info-soft/40 p-4">
      <h3 className="font-display text-lg">You answered differently</h3>
      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium">Sam selected:</span> {sam || "—"}
        </p>
        <p>
          <span className="font-medium">Michelle selected:</span>{" "}
          {michelle || "—"}
        </p>
      </div>
      <p className="mt-3 text-sm text-ink-muted">
        What matters most behind your answer?
      </p>
      <label className="mt-2 block text-xs text-ink-muted">Sam</label>
      <textarea
        className="mt-1 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
        rows={2}
        value={samReason}
        onChange={(e) => onSamReason(e.target.value)}
      />
      <label className="mt-2 block text-xs text-ink-muted">Michelle</label>
      <textarea
        className="mt-1 w-full rounded-xl border border-border bg-bg-elevated p-3 text-base"
        rows={2}
        value={michelleReason}
        onChange={(e) => onMichelleReason(e.target.value)}
      />
      <label className="mt-3 block text-xs text-ink-muted">
        Optional shared answer
      </label>
      <input
        className="mt-1 w-full rounded-xl border border-border bg-bg-elevated px-3 py-3 text-base"
        value={sharedText}
        onChange={(e) => onSharedText(e.target.value)}
        placeholder="Only if you want one shared note"
      />
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={pending || !sharedText.trim()}
          onClick={() => onResolve("shared_answer_created")}
        >
          Create shared answer
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={pending}
          onClick={() => onResolve("kept_separate")}
        >
          Keep both answers
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={pending}
          onClick={() => onResolve("discuss_later")}
        >
          Discuss later
        </button>
        {deepHref ? (
          <Link
            href={deepHref}
            className="btn btn-secondary min-h-11"
            onClick={() => onResolve("opened_deep")}
          >
            Open deeper question
          </Link>
        ) : deepUnavailable ? (
          <p className="text-sm text-ink-muted" role="status">
            Deeper discussion is not available yet.
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={pending}
          onClick={() => onResolve("discuss_later")}
        >
          Add to review list
        </button>
      </div>
    </section>
  );
}
