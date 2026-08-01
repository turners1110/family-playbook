"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateResearchSource } from "@/lib/research/actions";
import {
  RESEARCH_EVIDENCE_BASES,
  RESEARCH_EVIDENCE_RATINGS,
  RESEARCH_OWNERSHIP_STATUSES,
  RESEARCH_SOURCE_TYPES,
  RESEARCH_SOURCE_TYPE_LABELS,
  RESEARCH_TOPIC_KEYS,
  RESEARCH_TOPIC_LABELS,
  RESEARCH_MAX_FILE_BYTES,
} from "@/lib/research/types";
import { LIFE_STAGE_LABELS, LIFE_STAGES } from "@/lib/constants/enums";
import type { CreateResearchSourceInput } from "@/lib/research/validation";

export function AddSourceForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ingestion, setIngestion] =
    useState<CreateResearchSourceInput["ingestion_path"]>("metadata_only");
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [lifeStages, setLifeStages] = useState<string[]>([]);
  const [rights, setRights] = useState(false);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <form
      className="surface space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);
        const publicationYearRaw = String(form.get("publication_year") || "").trim();
        const input: CreateResearchSourceInput = {
          title: String(form.get("title") || ""),
          subtitle: String(form.get("subtitle") || "") || null,
          source_type: String(form.get("source_type") || "book") as never,
          author_text: String(form.get("author_text") || "") || null,
          organization: String(form.get("organization") || "") || null,
          publisher: String(form.get("publisher") || "") || null,
          publication_year: publicationYearRaw ? Number(publicationYearRaw) : null,
          edition: String(form.get("edition") || "") || null,
          isbn: String(form.get("isbn") || "") || null,
          description: String(form.get("description") || "") || null,
          source_url: String(form.get("source_url") || "") || null,
          cover_image_url: String(form.get("cover_image_url") || "") || null,
          ownership_status: (String(form.get("ownership_status") || "") ||
            null) as never,
          topics,
          life_stages: lifeStages,
          evidence_rating: (String(form.get("evidence_rating") || "") ||
            null) as never,
          evidence_rating_reason:
            String(form.get("evidence_rating_reason") || "") || null,
          evidence_basis: (String(form.get("evidence_basis") || "") || null) as never,
          notes_from_sam: String(form.get("notes_from_sam") || "") || undefined,
          notes_from_michelle:
            String(form.get("notes_from_michelle") || "") || undefined,
          shared_notes: String(form.get("shared_notes") || "") || undefined,
          pasted_excerpts: String(form.get("pasted_excerpts") || "") || undefined,
          rights_attested: rights,
          ingestion_path: ingestion,
        };

        startTransition(async () => {
          let filePayload = null;
          if (file) {
            if (file.size > RESEARCH_MAX_FILE_BYTES) {
              setError(`File exceeds the ${RESEARCH_MAX_FILE_BYTES / (1024 * 1024)} MiB limit.`);
              return;
            }
            if (!rights) {
              setError("Confirm you have the right to upload and privately process this file.");
              return;
            }
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i += 1) {
              binary += String.fromCharCode(bytes[i]!);
            }
            filePayload = {
              name: file.name,
              size: file.size,
              type: file.type,
              base64: btoa(binary),
            };
          }

          const result = await actionCreateResearchSource(input, filePayload);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/research/${result.sourceId}`);
        });
      }}
    >
      <div className="rounded-xl border border-border bg-bg-muted/40 p-3 text-sm text-ink-muted">
        Research sources inform discussion. They do not overwrite family answers or become
        decisions. Uploaded files stay private.
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">How are you adding this?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["metadata_only", "Metadata only"],
              ["owned_physical", "Owned physical book (no file)"],
              ["upload_file", "Upload PDF / EPUB / TXT / DOCX"],
              ["paste_excerpts", "Paste notes or excerpts"],
              ["public_url", "Public URL / reference link"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ingestion"
                checked={ingestion === value}
                onChange={() => setIngestion(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="field md:col-span-2">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" className="input" required />
        </div>
        <div className="field md:col-span-2">
          <label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" name="subtitle" className="input" />
        </div>
        <div className="field">
          <label htmlFor="source_type">Source type</label>
          <select id="source_type" name="source_type" className="select" defaultValue="book">
            {RESEARCH_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESEARCH_SOURCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="publication_year">Publication year</label>
          <input id="publication_year" name="publication_year" className="input" type="number" />
        </div>
        <div className="field">
          <label htmlFor="author_text">Author</label>
          <input id="author_text" name="author_text" className="input" />
        </div>
        <div className="field">
          <label htmlFor="organization">Organization</label>
          <input id="organization" name="organization" className="input" />
        </div>
        <div className="field">
          <label htmlFor="publisher">Publisher</label>
          <input id="publisher" name="publisher" className="input" />
        </div>
        <div className="field">
          <label htmlFor="edition">Edition</label>
          <input id="edition" name="edition" className="input" />
        </div>
        <div className="field">
          <label htmlFor="isbn">ISBN</label>
          <input id="isbn" name="isbn" className="input" />
        </div>
        <div className="field">
          <label htmlFor="ownership_status">Ownership</label>
          <select id="ownership_status" name="ownership_status" className="select" defaultValue="">
            <option value="">Unknown</option>
            {RESEARCH_OWNERSHIP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field md:col-span-2">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" className="textarea" rows={3} />
        </div>
        <div className="field">
          <label htmlFor="source_url">External link</label>
          <input id="source_url" name="source_url" className="input" type="url" />
        </div>
        <div className="field">
          <label htmlFor="cover_image_url">Cover image URL</label>
          <input id="cover_image_url" name="cover_image_url" className="input" type="url" />
        </div>
      </div>

      {(ingestion === "upload_file") && (
        <div className="field">
          <label htmlFor="file">Upload file (max {RESEARCH_MAX_FILE_BYTES / (1024 * 1024)} MiB)</label>
          <input
            id="file"
            type="file"
            accept=".pdf,.epub,.txt,.docx,.doc,application/pdf,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Private storage only. Uploading a file does not mean the full book has been processed.
          </p>
        </div>
      )}

      {(ingestion === "paste_excerpts" || ingestion === "owned_physical") && (
        <div className="field">
          <label htmlFor="pasted_excerpts">Notes or short excerpts</label>
          <textarea id="pasted_excerpts" name="pasted_excerpts" className="textarea" rows={4} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="field">
          <label htmlFor="notes_from_sam">Sam’s notes</label>
          <textarea id="notes_from_sam" name="notes_from_sam" className="textarea" rows={3} />
        </div>
        <div className="field">
          <label htmlFor="notes_from_michelle">Michelle’s notes</label>
          <textarea
            id="notes_from_michelle"
            name="notes_from_michelle"
            className="textarea"
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="shared_notes">Shared notes</label>
          <textarea id="shared_notes" name="shared_notes" className="textarea" rows={3} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Topics</legend>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_TOPIC_KEYS.map((topic) => (
            <label key={topic} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={topics.includes(topic)}
                onChange={() => toggle(topics, topic, setTopics)}
              />
              {RESEARCH_TOPIC_LABELS[topic]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Life stages</legend>
        <div className="flex flex-wrap gap-2">
          {LIFE_STAGES.map((stage) => (
            <label key={stage} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={lifeStages.includes(stage)}
                onChange={() => toggle(lifeStages, stage, setLifeStages)}
              />
              {LIFE_STAGE_LABELS[stage]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="field">
          <label htmlFor="evidence_rating">Suggested evidence rating</label>
          <select id="evidence_rating" name="evidence_rating" className="select" defaultValue="">
            <option value="">Unset</option>
            {RESEARCH_EVIDENCE_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="evidence_basis">Source basis</label>
          <select id="evidence_basis" name="evidence_basis" className="select" defaultValue="">
            <option value="">Unset</option>
            {RESEARCH_EVIDENCE_BASES.map((basis) => (
              <option key={basis} value={basis}>
                {basis.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field md:col-span-2">
          <label htmlFor="evidence_rating_reason">Rating explanation</label>
          <textarea
            id="evidence_rating_reason"
            name="evidence_rating_reason"
            className="textarea"
            rows={2}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-1"
        />
        <span>
          I have the right to upload and privately process this file. Uploaded text will not be
          published or shared publicly.
        </span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add source"}
      </button>
    </form>
  );
}
