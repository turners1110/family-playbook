import type { ResearchSourceCard } from "@/lib/research/types";

export type ResearchListFilters = {
  q?: string;
  sourceType?: string;
  processingStatus?: string;
  topic?: string;
  lifeStage?: string;
  evidenceRating?: string;
  linkedQuestions?: boolean;
  linkedPrinciples?: boolean;
  addedBy?: "sam" | "michelle";
  sort?: string;
  tab?: string;
};

export function filterAndSortSources(
  list: ResearchSourceCard[],
  filters: ResearchListFilters = {},
): ResearchSourceCard[] {
  let next = [...list];

  if (filters.tab === "books") {
    next = next.filter((s) => s.source_type === "book");
  } else if (filters.tab === "papers") {
    next = next.filter((s) => s.source_type === "research_paper");
  } else if (filters.tab === "guidelines") {
    next = next.filter((s) =>
      [
        "clinical_guideline",
        "government_guidance",
        "professional_org_guidance",
      ].includes(s.source_type),
    );
  } else if (filters.tab === "articles") {
    next = next.filter((s) =>
      ["article", "website", "podcast", "video"].includes(s.source_type),
    );
  } else if (filters.tab === "queue") {
    next = next.filter((s) =>
      [
        "queued",
        "processing",
        "processing_failed",
        "needs_review",
        "public_research_queued",
        "gathering_public_sources",
        "awaiting_source_text",
        "source_text_uploaded",
        "extracting_source_text",
      ].includes(s.processing_status),
    );
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    next = next.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.author_text ?? "").toLowerCase().includes(q) ||
        (s.organization ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.topics.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters.sourceType) {
    next = next.filter((s) => s.source_type === filters.sourceType);
  }
  if (filters.processingStatus) {
    next = next.filter((s) => s.processing_status === filters.processingStatus);
  }
  if (filters.topic) {
    next = next.filter((s) => s.topics.includes(filters.topic!));
  }
  if (filters.lifeStage) {
    next = next.filter((s) => s.life_stages.includes(filters.lifeStage!));
  }
  if (filters.evidenceRating) {
    next = next.filter((s) => s.evidence_rating === filters.evidenceRating);
  }
  if (filters.linkedQuestions) {
    next = next.filter((s) => s.linked_question_count > 0);
  }
  if (filters.linkedPrinciples) {
    next = next.filter((s) => s.linked_principle_count > 0);
  }
  if (filters.addedBy === "sam") {
    next = next.filter((s) =>
      (s.added_by_display_name ?? "").toLowerCase().includes("sam"),
    );
  }
  if (filters.addedBy === "michelle") {
    next = next.filter((s) =>
      (s.added_by_display_name ?? "").toLowerCase().includes("michelle"),
    );
  }

  const sort = filters.sort ?? "recent";
  next.sort((a, b) => {
    if (sort === "author") {
      return (
        (a.author_text ?? "").localeCompare(b.author_text ?? "") ||
        a.title.localeCompare(b.title)
      );
    }
    if (sort === "year") {
      return (b.publication_year ?? 0) - (a.publication_year ?? 0);
    }
    if (sort === "linked") {
      return (
        b.linked_question_count +
        b.linked_principle_count -
        (a.linked_question_count + a.linked_principle_count)
      );
    }
    if (sort === "evidence") {
      const rank: Record<string, number> = {
        high: 5,
        moderate: 4,
        low: 3,
        expert_opinion: 2,
        personal_experience: 1,
        unknown: 0,
      };
      return (
        (rank[b.evidence_rating ?? "unknown"] ?? 0) -
        (rank[a.evidence_rating ?? "unknown"] ?? 0)
      );
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "processed") {
      return (b.processed_at ?? "").localeCompare(a.processed_at ?? "");
    }
    return b.created_at.localeCompare(a.created_at);
  });

  return next;
}
