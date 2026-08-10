/**
 * Convert existing research link payloads into GroundedFinding records.
 * Never invents finding text — only uses source-backed content already stored.
 */
import type { ResearchEvidenceRating, ResearchSourceType } from "@/lib/research/types";
import {
  mapEvidenceBasisToQuality,
  mapLinkTypeToRelationship,
  mapRatingToStrength,
  type GroundedFinding,
} from "@/lib/research/evidence-model";

export type ResearchLinkRow = {
  link: {
    id: string;
    relevance_note?: string | null;
    link_type?: string | null;
    finding_id?: string | null;
    source_id?: string;
  };
  source: {
    id: string;
    title: string;
    source_type?: ResearchSourceType | string | null;
    evidence_rating?: ResearchEvidenceRating | null;
    evidence_basis?: string | null;
    url?: string | null;
    published_at?: string | null;
  } | null;
  shortFinding: string | null;
  finding?: {
    id: string;
    finding_text: string;
    practical_implication?: string | null;
    evidence_strength?: string | null;
    confidence?: string | null;
    related_topics?: string[];
    linked_question_ids?: string[];
    review_status?: string;
    location?: string | null;
    chapter?: string | null;
    created_at?: string;
    source_basis?: string | null;
  } | null;
};

export function groundedFindingsFromLinks(
  rows: ResearchLinkRow[],
  questionId?: string,
): GroundedFinding[] {
  const out: GroundedFinding[] = [];

  for (const row of rows) {
    if (!row.source) continue;
    const text =
      row.finding?.finding_text?.trim() ||
      row.shortFinding?.trim() ||
      row.link.relevance_note?.trim() ||
      "";
    if (!text) continue;

    const confidenceRaw = row.finding?.confidence;
    const confidence =
      confidenceRaw === "high" || confidenceRaw === "moderate" || confidenceRaw === "low"
        ? confidenceRaw
        : confidenceRaw === "medium"
          ? "moderate"
          : "unknown";

    out.push({
      id: row.finding?.id || row.link.finding_id || `linkfind_${row.link.id}`,
      source_id: row.source.id,
      source_type: String(row.source.source_type ?? "unknown"),
      source_title: row.source.title,
      finding_text: text,
      practical_implication: row.finding?.practical_implication ?? null,
      topic_ids: row.finding?.related_topics ?? [],
      question_ids: unique([
        ...(row.finding?.linked_question_ids ?? []),
        ...(questionId ? [questionId] : []),
      ]),
      decision_ids: [],
      life_stages: [],
      relationship: mapLinkTypeToRelationship(row.link.link_type),
      evidence_strength: mapRatingToStrength(
        row.finding?.evidence_strength ?? row.source.evidence_rating,
      ),
      source_quality: mapEvidenceBasisToQuality(
        row.source.evidence_basis,
        row.source.source_type,
      ),
      confidence,
      location: row.finding?.location ?? null,
      chapter: row.finding?.chapter ?? null,
      page_if_known: null,
      url_if_applicable: row.source.url ?? null,
      published_at_if_known: row.source.published_at ?? null,
      extracted_at: row.finding?.created_at ?? null,
      extraction_method: row.finding?.source_basis ?? "linked_source",
      review_status:
        (row.finding?.review_status as GroundedFinding["review_status"]) ?? "unknown",
    });
  }

  return out;
}

function unique(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}
