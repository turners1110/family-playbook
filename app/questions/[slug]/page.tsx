import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { conversationReturnHref } from "@/lib/conversations/deep-link";
import { PriorityBadge } from "@/components/shared/ui";
import {
  AnswerStatusBadge,
  AnswerStatusHeader,
} from "@/components/questions/AnswerStatusBadge";
import { readStore } from "@/lib/db/store";
import { AnswerEditor } from "@/components/questions/AnswerEditor";
import { LIFE_STAGE_LABELS } from "@/lib/constants/enums";
import {
  buildQuestionStatusIndex,
  getQuestionAnswerStatus,
} from "@/lib/services/question-status";
import { getResearchForQuestion } from "@/lib/research/services";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { ResearchGuidancePanel } from "@/components/questions/ResearchGuidancePanel";
import { formatAnswerPayload } from "@/lib/questions/answer-display";
import { groundedFindingsFromLinks } from "@/lib/research/ground-findings";
import { synthesizeEvidence } from "@/lib/research/synthesis";
import { classifyResearchValue } from "@/lib/research/research-value";
import { CreateChecklistTaskButton } from "@/components/checklists/CreateChecklistTaskButton";
import {
  decisionHref,
  getDecisionsForQuestion,
} from "@/lib/knowledge";
import {
  resolveDiscussionMode,
  shouldShowSeparateEditors,
} from "@/lib/discussions/discussion-mode";
import { filterAnswersForClient } from "@/lib/discussions/answer-privacy";
import { DiscussionModeDebug } from "@/components/discussions/DiscussionModeDebug";
import { QuestionContextPanel } from "@/components/questions/QuestionContextPanel";
import { sharedContextFromLibraryQuestion } from "@/lib/content/resolve-question-context";
import {
  previewLibraryAnswerText,
  previouslyAnsweredLabel,
} from "@/lib/services/previously-answered";

export const dynamic = "force-dynamic";

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    returnTo?: string;
    sessionId?: string;
    sessionItemId?: string;
    testRunId?: string;
    source?: string;
  }>;
}) {
  const ctx = await requireFamilyContext();
  const { slug } = await params;
  const sp = await searchParams;
  const store = await readStore();
  const question = store.questions.find((q) => q.slug === slug);
  if (!question) {
    const byId = store.questions.find((q) => q.id === slug);
    // Never treat a raw question ID as a slug.
    return (
      <AppShell title="Question not found" subtitle="Unknown slug">
        <div className="surface space-y-3 p-5">
          <p className="text-sm text-ink-muted">
            No question uses the slug <code>{slug}</code>.
          </p>
          {byId ? (
            <p className="text-sm">
              That value matches question ID <code>{byId.id}</code>. Open it with
              its slug instead:{" "}
              <Link
                href={`/questions/${byId.slug}`}
                className="font-medium underline"
              >
                /questions/{byId.slug}
              </Link>
              .
            </p>
          ) : null}
          <Link href="/questions" className="btn btn-secondary">
            Back to questions
          </Link>
        </div>
      </AppShell>
    );
  }
  const rawAnswers = store.answers.filter((a) => a.question_id === question.id);
  const hasSeparateAnswers = rawAnswers.some((a) => !a.is_shared);
  const discussion = resolveDiscussionMode({
    question,
    hasSeparateAnswers,
    preferExistingSeparate: true,
  });
  const separateEditorsVisible = shouldShowSeparateEditors({
    resolvedMode: discussion.mode,
    hasSeparateAnswers,
  });
  const filtered = filterAnswersForClient({
    answers: rawAnswers,
    members: store.members,
    hideUntilBoth: store.settings.hide_partner_answers_until_both_saved,
    currentMemberId:
      store.members.find((m) => m.user_id === store.current_user_id)?.id ?? "",
    separateEditorsVisible,
  });
  const answers = filtered.answers;
  const status = getQuestionAnswerStatus(question.id, store);
  const statusIndex = buildQuestionStatusIndex(store);
  const versions = store.answer_versions
    .filter((v) => answers.some((a) => a.id === v.answer_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const related = question.related_questions
    .map((id) => store.questions.find((q) => q.id === id))
    .filter(Boolean);
  const knowledge = store.knowledge_items.filter((k) =>
    k.related_question_ids.includes(question.id),
  );
  const member = store.members.find((m) => m.user_id === store.current_user_id)!;
  const research = await getResearchForQuestion(question.id, ctx);
  const researchFindings = groundedFindingsFromLinks(research, question.id);
  const researchSynthesis = synthesizeEvidence(researchFindings);
  const researchValue = classifyResearchValue({
    id: question.id,
    title: question.short_title,
    text: question.text,
    categories: question.categories,
    evidence_needed: question.evidence_needed,
    research_mode: question.research_mode,
    priority: question.priority,
  });
  const relatedDecisions = getDecisionsForQuestion(store, question.id);
  const returnHref =
    sp.source === "conversation" || sp.returnTo || sp.sessionId || sp.testRunId
      ? conversationReturnHref({
          returnTo: sp.returnTo,
          sessionId: sp.sessionId,
          testRunId: sp.testRunId,
        })
      : null;
  const priorLabel = previouslyAnsweredLabel(status);
  const questionContext = sharedContextFromLibraryQuestion(question, {
    previouslyAnswered: priorLabel
      ? {
          label: priorLabel,
          previewText: previewLibraryAnswerText(rawAnswers),
          fullyAnswered: status.fullyAnswered,
        }
      : null,
    whySeeingThis: sp.source === "conversation"
      ? "Opened from a conversation prompt so you can go deeper."
      : question.required_before_birth
        ? "Flagged as useful to discuss before birth."
        : null,
  });

  return (
    <AppShell
      title={question.short_title}
      subtitle="Question detail, perspectives, and history"
      actions={
        <div className="flex flex-wrap gap-2">
          {returnHref ? (
            <Link href={returnHref} className="btn btn-secondary">
              Return to conversation
            </Link>
          ) : null}
          <Link href={`/discuss?category=${question.categories[0]}`} className="btn btn-primary">
            Discuss related topic
          </Link>
        </div>
      }
    >
      {returnHref ? (
        <section className="surface mb-4 p-4 text-sm">
          <p className="font-medium">From a conversation</p>
          <p className="mt-1 text-ink-muted">
            Your quick answers stay in that session. After you save here, return
            to continue.
          </p>
          <Link href={returnHref} className="btn btn-secondary mt-3">
            Return to conversation
          </Link>
        </section>
      ) : null}

      {relatedDecisions.length > 0 ? (
        <section className="surface mb-4 p-4">
          <h2 className="font-display text-lg">Related family topics</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {relatedDecisions.map((d) => (
              <li key={d.id}>
                <Link
                  href={decisionHref(d)}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-5">
        <AnswerStatusHeader status={status} />
      </section>

      <ResearchGuidancePanel
        synthesis={researchSynthesis}
        findings={researchFindings}
        researchValue={researchValue.class}
        evidenceNeeded={Boolean(question.evidence_needed)}
        questionSlug={question.slug}
      />

      <section className="surface p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <AnswerStatusBadge status={status} />
          <PriorityBadge priority={question.priority} />
          {question.babymoon_priority && <span className="badge badge-accent">Babymoon</span>}
          {question.required_before_birth && (
            <span className="badge badge-danger">Before birth</span>
          )}
        </div>
        <h2 className="font-display text-3xl leading-snug">{question.text}</h2>
        <div className="mt-4">
          <QuestionContextPanel context={questionContext} />
        </div>
        <div className="mt-4 grid gap-2 text-sm text-ink-subtle sm:grid-cols-2">
          <div>
            Primary stage:{" "}
            {question.primary_discussion_stage
              ? LIFE_STAGE_LABELS[question.primary_discussion_stage]
              : "Not set"}
          </div>
          <div>
            Life stages:{" "}
            {question.life_stages.map((s) => LIFE_STAGE_LABELS[s]).join(", ")}
          </div>
          <div>Categories: {question.categories.join(", ")}</div>
          <div>Outcomes: {question.outcomes.join(", ") || "—"}</div>
          <div>
            Type: {question.question_type} · ~{question.estimated_minutes} min · Research:{" "}
            {question.research_mode.replaceAll("_", " ")}
          </div>
        </div>
        {question.evidence_summary && (
          <div className="mt-4 rounded-xl bg-info-soft p-3 text-sm text-info">
            <strong>Evidence summary (sample where noted):</strong> {question.evidence_summary}
          </div>
        )}
      </section>

      <section className="surface mt-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl">Answer this question</h3>
          <CreateChecklistTaskButton
            label="Create task"
            defaults={{
              title: `Research: ${question.short_title}`.slice(0, 120),
              source: "question",
              created_from_label: question.short_title,
              linked_question_ids: [question.id],
            }}
          />
        </div>
        <DiscussionModeDebug
          questionId={question.id}
          storedMode={question.discussion_mode ?? null}
          resolvedMode={discussion.mode}
          source={discussion.source}
          surface="questions/[slug]"
        />
        <AnswerEditor
          key={question.id}
          question={question}
          questionId={question.id}
          members={store.members}
          answers={answers}
          hideUntilBoth={store.settings.hide_partner_answers_until_both_saved}
          currentMemberId={member.id}
        />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Family decision</h3>
          <div className="mt-3 space-y-3">
            {answers.filter((a) => a.is_shared).length === 0 && (
              <p className="text-sm text-ink-muted">No shared decision yet.</p>
            )}
            {answers
              .filter((a) => a.is_shared)
              .map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border p-3 text-sm"
                >
                  <span className="badge">Shared</span>
                  <p className="mt-2 whitespace-pre-wrap">
                    {formatAnswerPayload(
                      a.payload,
                      question.response_schema as Record<string, unknown>,
                    ) || "—"}
                  </p>
                </div>
              ))}
          </div>
          {answers.some((a) => !a.is_shared) ? (
            <div className="mt-4 space-y-3">
              <h4 className="font-medium">Separate perspectives</h4>
              {answers
                .filter((a) => !a.is_shared)
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-border p-3 text-sm"
                  >
                    <span className="badge">Individual</span>
                    <p className="mt-2 whitespace-pre-wrap">
                      {formatAnswerPayload(
                        a.payload,
                        question.response_schema as Record<string, unknown>,
                      ) || "—"}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}
        </section>

        <section className="surface p-5">
          <h3 className="font-display text-xl">Answer history</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {versions.length === 0 && <li>No history yet.</li>}
            {versions.map((v) => (
              <li key={v.id} className="rounded-xl border border-border p-3">
                v{v.version} · {v.created_at.slice(0, 10)} · {v.change_reason}
                <div className="mt-1 whitespace-pre-wrap text-ink">
                  {formatAnswerPayload(
                    v.payload,
                    question.response_schema as Record<string, unknown>,
                  ) || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="font-display text-xl">Related questions</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((q) =>
              q ? (
                <li key={q.id} className="flex flex-wrap items-center gap-2">
                  <AnswerStatusBadge status={statusIndex.get(q.id)!} compact />
                  <Link href={`/questions/${q.slug}`} className="hover:text-accent">
                    {q.short_title}
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
        <section className="surface p-5">
          <h3 className="font-display text-xl">Knowledge & evidence</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {knowledge.length === 0 && (
              <li className="text-ink-muted">No linked knowledge items.</li>
            )}
            {knowledge.map((k) => (
              <li key={k.id}>
                <Link href={`/knowledge/${k.id}`} className="hover:text-accent">
                  {k.title}
                </Link>
                {k.is_sample && <span className="badge ml-2">Sample</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-sm text-ink-muted">
            Principles:{" "}
            {question.related_principles.length
              ? question.related_principles.join(", ")
              : store.principles.map((p) => p.title).join(", ")}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
