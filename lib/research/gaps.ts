/**
 * Research gaps and backlog for the high-priority cohort.
 */
import type { ResearchValueClass } from "@/lib/research/research-value";

export type EvidenceGapState =
  | "sufficient"
  | "partial"
  | "missing"
  | "unnecessary";

export type ResearchQueueItem = {
  question_id: string;
  slug: string;
  title: string;
  decision_hubs: string[];
  research_priority: ResearchValueClass;
  why_evidence_matters: string;
  existing_source_count: number;
  gap_state: EvidenceGapState;
  status: "open" | "in_progress" | "done" | "skipped";
};

export function classifyEvidenceGap(input: {
  researchValue: ResearchValueClass;
  groundedFindingCount: number;
  evidenceSummary?: string | null;
  evidenceAvailable?: boolean;
}): EvidenceGapState {
  if (input.researchValue === "NONE" || input.researchValue === "LOW") {
    return "unnecessary";
  }
  if (input.groundedFindingCount >= 2) return "sufficient";
  if (
    input.groundedFindingCount === 1 ||
    input.evidenceSummary ||
    input.evidenceAvailable
  ) {
    return "partial";
  }
  return "missing";
}

export function buildResearchQueue(
  items: Array<{
    question_id: string;
    slug: string;
    title: string;
    decision_hubs: string[];
    research_value: ResearchValueClass;
    research_value_reason: string;
    grounded_finding_count: number;
    evidence_summary?: string | null;
    evidence_available?: boolean;
  }>,
): ResearchQueueItem[] {
  return items
    .map((item) => {
      const gap = classifyEvidenceGap({
        researchValue: item.research_value,
        groundedFindingCount: item.grounded_finding_count,
        evidenceSummary: item.evidence_summary,
        evidenceAvailable: item.evidence_available,
      });
      return {
        question_id: item.question_id,
        slug: item.slug,
        title: item.title,
        decision_hubs: item.decision_hubs,
        research_priority: item.research_value,
        why_evidence_matters: item.research_value_reason,
        existing_source_count: item.grounded_finding_count,
        gap_state: gap,
        status: gap === "missing" || gap === "partial" ? ("open" as const) : ("skipped" as const),
      };
    })
    .filter(
      (q) =>
        (q.research_priority === "CRITICAL" || q.research_priority === "HIGH") &&
        (q.gap_state === "missing" || q.gap_state === "partial"),
    )
    .sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, NONE: 4 };
      return (
        rank[a.research_priority] - rank[b.research_priority] ||
        a.title.localeCompare(b.title)
      );
    });
}
