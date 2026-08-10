/**
 * Grounded evidence synthesis.
 * Never fabricates studies, quotes, or citations.
 * If no source-backed findings exist, returns insufficient — not a fake paragraph.
 */
import {
  EVIDENCE_PICTURE_LABELS,
  type EvidencePicture,
  type GroundedFinding,
} from "@/lib/research/evidence-model";

export type EvidenceSynthesis = {
  evidence_picture: EvidencePicture;
  evidence_picture_label: string;
  picture_reason: string;
  key_takeaway: string | null;
  key_considerations: string[];
  areas_of_agreement: string[];
  areas_of_disagreement: string[];
  uncertainty: string[];
  source_ids: string[];
  finding_ids: string[];
  finding_count: number;
  source_count: number;
  has_grounded_evidence: boolean;
  /** Explicit label so UI never confuses this with family position. */
  kind: "source_derived_synthesis";
};

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function synthesizeEvidence(
  findings: GroundedFinding[],
): EvidenceSynthesis {
  const grounded = findings.filter(
    (f) => f.finding_text.trim() && f.source_id && f.source_title,
  );

  if (grounded.length === 0) {
    return {
      evidence_picture: "insufficient",
      evidence_picture_label: EVIDENCE_PICTURE_LABELS.insufficient,
      picture_reason: "No grounded source findings are linked yet.",
      key_takeaway: null,
      key_considerations: [],
      areas_of_agreement: [],
      areas_of_disagreement: [],
      uncertainty: ["Evidence has not been linked for this topic."],
      source_ids: [],
      finding_ids: [],
      finding_count: 0,
      source_count: 0,
      has_grounded_evidence: false,
      kind: "source_derived_synthesis",
    };
  }

  const supports = grounded.filter((f) => f.relationship === "supports");
  const contradicts = grounded.filter((f) => f.relationship === "contradicts");
  const mixed = grounded.filter(
    (f) => f.relationship === "mixed" || f.relationship === "uncertain",
  );
  const highQuality = grounded.filter((f) =>
    ["primary_guideline", "systematic_review", "meta_analysis"].includes(
      f.source_quality,
    ),
  );

  let picture: EvidencePicture = "limited";
  let picture_reason = "A small number of linked findings provide context.";

  if (contradicts.length > 0 || mixed.length > 0) {
    picture = "mixed";
    picture_reason =
      "Linked sources do not fully agree — disagreement is shown, not collapsed.";
  } else if (
    highQuality.length >= 1 &&
    supports.length >= 1 &&
    grounded.every((f) => f.evidence_strength !== "low")
  ) {
    picture = grounded.length >= 2 ? "strong" : "moderate";
    picture_reason =
      picture === "strong"
        ? "Multiple linked findings, including professional guidance, point the same way."
        : "Professional guidance is linked, with limited additional comparison.";
  } else if (supports.length >= 1 || grounded.length >= 2) {
    picture = "moderate";
    picture_reason =
      "Linked findings provide useful context, but coverage is incomplete.";
  }

  const key_considerations = unique(
    grounded
      .map((f) => f.practical_implication)
      .filter((x): x is string => Boolean(x?.trim()))
      .slice(0, 4),
  );

  const takeawayParts = grounded.slice(0, 3).map((f) => {
    const rel =
      f.relationship === "contradicts"
        ? "Contradicts common framing"
        : f.relationship === "supports"
          ? "Supports"
          : "Adds context";
    return `${rel} (${f.source_title}): ${f.finding_text.trim()}`;
  });

  const areas_of_agreement =
    contradicts.length === 0
      ? unique(supports.map((f) => f.finding_text.trim()).slice(0, 3))
      : [];

  const areas_of_disagreement = unique(
    [...contradicts, ...mixed].map((f) => `${f.source_title}: ${f.finding_text.trim()}`),
  );

  const uncertainty = unique([
    ...grounded
      .filter((f) => f.relationship === "uncertain" || f.evidence_strength === "unknown")
      .map((f) => `Uncertainty noted in ${f.source_title}`),
    ...(grounded.length < 2 ? ["Only a limited set of sources is linked."] : []),
  ]);

  return {
    evidence_picture: picture,
    evidence_picture_label: EVIDENCE_PICTURE_LABELS[picture],
    picture_reason,
    key_takeaway: takeawayParts.join(" "),
    key_considerations,
    areas_of_agreement,
    areas_of_disagreement,
    uncertainty,
    source_ids: unique(grounded.map((f) => f.source_id)),
    finding_ids: grounded.map((f) => f.id),
    finding_count: grounded.length,
    source_count: unique(grounded.map((f) => f.source_id)).length,
    has_grounded_evidence: true,
    kind: "source_derived_synthesis",
  };
}

/** Detect family position vs evidence mismatch without rewriting answers. */
export function detectFamilyEvidenceMismatch(input: {
  familyPosition: string | null | undefined;
  findings: GroundedFinding[];
}): {
  hasMismatch: boolean;
  summary: string | null;
} {
  const position = input.familyPosition?.trim();
  if (!position) return { hasMismatch: false, summary: null };

  const contradicting = input.findings.filter((f) => f.relationship === "contradicts");
  if (contradicting.length === 0) return { hasMismatch: false, summary: null };

  return {
    hasMismatch: true,
    summary:
      "Some linked findings may conflict with the current family position. Review — do not auto-change the decision.",
  };
}
