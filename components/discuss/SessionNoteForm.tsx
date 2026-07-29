"use client";

import { useState, useTransition } from "react";
import { actionAdvanceSession } from "@/lib/actions";

export function SessionNoteForm({
  sessionId,
  initialNote,
}: {
  sessionId: string;
  initialNote: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await actionAdvanceSession(sessionId, "complete", note);
          setSaved(true);
        });
      }}
    >
      <textarea
        className="textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note about how this conversation went"
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save session note"}
      </button>
      {saved && <p className="text-sm text-accent-strong">Saved.</p>}
    </form>
  );
}
