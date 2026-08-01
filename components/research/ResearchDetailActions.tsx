"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionAddResearchNote,
  actionAddResearchSummary,
  actionApproveResearchSummary,
  actionArchiveResearchSource,
  actionLinkResearchSource,
} from "@/lib/research/actions";
import { RESEARCH_NOTE_SCOPES, RESEARCH_SUMMARY_TYPES } from "@/lib/research/types";

export function ResearchDetailActions({
  sourceId,
  questions,
}: {
  sourceId: string;
  questions: { id: string; short_title: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-5">
      <form
        className="surface space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await actionAddResearchSummary({
              source_id: sourceId,
              summary_type: String(form.get("summary_type")),
              content: String(form.get("content")),
              content_basis: "manual",
            });
            setMessage(result.ok ? "Summary saved (needs review)." : result.error);
            if (result.ok) {
              e.currentTarget.reset();
              router.refresh();
            }
          });
        }}
      >
        <h3 className="font-display text-lg">Add manual summary</h3>
        <select name="summary_type" className="select" defaultValue="short_summary">
          {RESEARCH_SUMMARY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <textarea name="content" className="textarea" rows={4} required />
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          Save summary
        </button>
      </form>

      <form
        className="surface space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await actionAddResearchNote({
              source_id: sourceId,
              note_scope: String(form.get("note_scope")),
              text: String(form.get("text")),
              page_or_chapter: String(form.get("page_or_chapter") || "") || null,
              tags: [],
            });
            setMessage(result.ok ? "Note saved." : result.error);
            if (result.ok) {
              e.currentTarget.reset();
              router.refresh();
            }
          });
        }}
      >
        <h3 className="font-display text-lg">Add note</h3>
        <select name="note_scope" className="select" defaultValue="shared">
          {RESEARCH_NOTE_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {scope === "sam" ? "Sam" : scope === "michelle" ? "Michelle" : "Shared"}
            </option>
          ))}
        </select>
        <input
          name="page_or_chapter"
          className="input"
          placeholder="Page or chapter (optional)"
        />
        <textarea name="text" className="textarea" rows={3} required />
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          Save note
        </button>
      </form>

      <form
        className="surface space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await actionLinkResearchSource({
              source_id: sourceId,
              question_id: String(form.get("question_id")),
              link_type: "informs",
              relevance_note: String(form.get("relevance_note") || "") || null,
            });
            setMessage(result.ok ? "Linked to question." : result.error);
            if (result.ok) {
              e.currentTarget.reset();
              router.refresh();
            }
          });
        }}
      >
        <h3 className="font-display text-lg">Link to question</h3>
        <select name="question_id" className="select" required defaultValue="">
          <option value="" disabled>
            Select a question
          </option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.short_title}
            </option>
          ))}
        </select>
        <textarea
          name="relevance_note"
          className="textarea"
          rows={2}
          placeholder="Why this source is relevant"
        />
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          Link question
        </button>
      </form>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await actionArchiveResearchSource(sourceId);
            setMessage(result.ok ? "Archived." : result.error);
            if (result.ok) router.push("/research");
          });
        }}
      >
        Archive source
      </button>

      {message && <p className="text-sm text-ink-muted">{message}</p>}
    </div>
  );
}

export function ApproveSummaryButton({
  summaryId,
  sourceId,
}: {
  summaryId: string;
  sourceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await actionApproveResearchSummary(summaryId, sourceId);
          router.refresh();
        });
      }}
    >
      Approve
    </button>
  );
}
