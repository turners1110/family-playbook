/**
 * Provider-neutral public book research interfaces.
 * Live providers optional via env; mock works offline for tests/dev.
 */
import type {
  ResearchExternalSource,
  ResearchPreliminaryFinding,
  ResearchPublicOverview,
  ResearchSource,
} from "@/lib/research/types";

export type GatheredPublicSource = Omit<
  ResearchExternalSource,
  "id" | "research_source_id" | "created_at" | "supports_finding_ids"
> & {
  supports_finding_ids?: string[];
};

export type PublicOverviewDraft = Omit<
  ResearchPublicOverview,
  | "id"
  | "research_source_id"
  | "created_at"
  | "updated_at"
  | "approved_by_member_id"
  | "approved_at"
>;

export type PreliminaryFindingDraft = Omit<
  ResearchPreliminaryFinding,
  "id" | "source_id" | "created_at" | "updated_at"
>;

export type PublicBookResearchContext = {
  source: Pick<
    ResearchSource,
    | "id"
    | "title"
    | "author_text"
    | "organization"
    | "publication_year"
    | "description"
    | "topics"
    | "life_stages"
    | "recommended_slug"
  >;
  questionIds: string[];
  checklistTaskIds: string[];
};

export interface WebResearchProvider {
  name: string;
  searchPublicBookSources(
    ctx: PublicBookResearchContext,
  ): Promise<GatheredPublicSource[]>;
}

export interface PublicBookAiProvider {
  name: string;
  model: string;
  promptVersion: string;
  generatePublicBookOverview(
    ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
  ): Promise<PublicOverviewDraft>;
  extractPreliminaryFindings(
    ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
    overview: PublicOverviewDraft,
  ): Promise<PreliminaryFindingDraft[]>;
  generatePreliminaryLessons(
    ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
    overview: PublicOverviewDraft,
  ): Promise<string[]>;
}

export function assertNoFakeCitations(text: string) {
  const banned = [
    /page\s+\d+/i,
    /pp\.\s*\d+/i,
    /chapter\s+\d+\s+summary/i,
    /on page \d+/i,
    /p\.\s*\d{1,4}\b/i,
  ];
  for (const pattern of banned) {
    if (pattern.test(text)) {
      throw new Error(
        `Public overview must not invent page/chapter citations (${pattern}).`,
      );
    }
  }
}

export function assertHasSupportingSources(
  claims: string[],
  sources: GatheredPublicSource[],
) {
  if (claims.length > 0 && sources.length === 0) {
    throw new Error("Unsupported claims blocked: no public sources stored.");
  }
}
