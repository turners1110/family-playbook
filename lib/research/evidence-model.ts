/**
 * Research & Knowledge V2 — canonical evidence vocabulary.
 * Extends existing research types; does not replace the library.
 */

export const EVIDENCE_RELATIONSHIPS = [
  "supports",
  "contradicts",
  "adds_context",
  "mixed",
  "uncertain",
] as const;

export type EvidenceRelationship = (typeof EVIDENCE_RELATIONSHIPS)[number];

export const EVIDENCE_STRENGTHS = [
  "high",
  "moderate",
  "low",
  "unknown",
] as const;

export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const SOURCE_QUALITY_CLASSES = [
  "primary_guideline",
  "systematic_review",
  "meta_analysis",
  "randomized_trial",
  "observational_study",
  "professional_guidance",
  "evidence_based_book",
  "expert_secondary",
  "community_experience",
  "unknown",
] as const;

export type SourceQualityClass = (typeof SOURCE_QUALITY_CLASSES)[number];

export const EVIDENCE_PICTURES = [
  "strong",
  "moderate",
  "limited",
  "mixed",
  "insufficient",
] as const;

export type EvidencePicture = (typeof EVIDENCE_PICTURES)[number];

export const EVIDENCE_PICTURE_LABELS: Record<EvidencePicture, string> = {
  strong: "Strong",
  moderate: "Moderate",
  limited: "Limited",
  mixed: "Mixed",
  insufficient: "Insufficient",
};

export const LINK_CONFIDENCES = ["high", "moderate", "low"] as const;
export type LinkConfidence = (typeof LINK_CONFIDENCES)[number];

/**
 * Display-ready grounded finding. Every claim must resolve to a source.
 * Never invent studies, dates, or quotes.
 */
export type GroundedFinding = {
  id: string;
  source_id: string;
  source_type: string;
  source_title: string;
  finding_text: string;
  practical_implication: string | null;
  topic_ids: string[];
  question_ids: string[];
  decision_ids: string[];
  life_stages: string[];
  relationship: EvidenceRelationship;
  evidence_strength: EvidenceStrength;
  source_quality: SourceQualityClass;
  confidence: "low" | "moderate" | "high" | "unknown";
  location: string | null;
  chapter: string | null;
  page_if_known: string | null;
  url_if_applicable: string | null;
  published_at_if_known: string | null;
  extracted_at: string | null;
  extraction_method: string | null;
  review_status: "needs_review" | "approved" | "rejected" | "edited" | "unknown";
};

export function mapEvidenceBasisToQuality(
  basis: string | null | undefined,
  sourceType?: string | null,
): SourceQualityClass {
  switch (basis) {
    case "systematic_review":
      return "systematic_review";
    case "meta_analysis":
      return "meta_analysis";
    case "randomized_trial":
      return "randomized_trial";
    case "observational_research":
      return "observational_study";
    case "clinical_guideline":
    case "government_guidance":
      return "primary_guideline";
    case "professional_consensus":
      return "professional_guidance";
    case "expert_authored_book":
      return "evidence_based_book";
    case "journalistic_source":
    case "memoir":
    case "personal_anecdote":
    case "opinion":
      return "community_experience";
    default:
      if (sourceType === "book") return "evidence_based_book";
      if (
        sourceType === "clinical_guideline" ||
        sourceType === "government_guidance" ||
        sourceType === "professional_org_guidance"
      ) {
        return "primary_guideline";
      }
      if (sourceType === "research_paper") return "observational_study";
      return "unknown";
  }
}

export function mapRatingToStrength(
  rating: string | null | undefined,
): EvidenceStrength {
  if (rating === "high") return "high";
  if (rating === "moderate") return "moderate";
  if (rating === "low" || rating === "expert_opinion" || rating === "personal_experience") {
    return "low";
  }
  return "unknown";
}

export function mapLinkTypeToRelationship(
  linkType: string | null | undefined,
): EvidenceRelationship {
  const t = String(linkType ?? "").toLowerCase();
  if (t.includes("contradict")) return "contradicts";
  if (t.includes("support")) return "supports";
  if (t.includes("mixed")) return "mixed";
  if (t.includes("uncertain")) return "uncertain";
  return "adds_context";
}
