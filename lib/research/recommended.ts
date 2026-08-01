import type { ResearchSourceCard } from "@/lib/research/types";
import {
  RECOMMENDED_LIBRARY,
  type RecommendedCatalogEntry,
} from "@/lib/research/recommended-seed";
import { filterAndSortSources, type ResearchListFilters } from "@/lib/research/filters";

export type RecommendedFamilyPrefs = {
  hidden: string[];
  added: Record<string, string>;
};

export function emptyRecommendedPrefs(): RecommendedFamilyPrefs {
  return { hidden: [], added: {} };
}

export function catalogEntryToCard(
  entry: RecommendedCatalogEntry,
  prefs: RecommendedFamilyPrefs,
  familyId: string,
): ResearchSourceCard {
  const addedSourceId = prefs.added[entry.slug] ?? null;
  return {
    id: `recommended:${entry.slug}`,
    family_id: familyId,
    title: entry.title,
    subtitle: null,
    source_type: entry.source_type,
    author_text: entry.author_text,
    organization: entry.organization,
    publisher: null,
    publication_year: entry.publication_year,
    edition: null,
    isbn: null,
    description: entry.description,
    source_url: null,
    cover_image_url: null,
    availability_type: "metadata_only",
    processing_status: "metadata_only",
    evidence_rating: entry.evidence_rating,
    evidence_rating_reason: null,
    evidence_basis: entry.evidence_basis,
    evidence_rating_approved: false,
    ownership_status: entry.ownership_status,
    topics: entry.topics,
    life_stages: entry.life_stages,
    rights_attested: false,
    added_by_member_id: null,
    added_by_display_name: null,
    recommended_slug: entry.slug,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    processed_at: null,
    archived_at: null,
    finding_count: 0,
    linked_question_count: 0,
    linked_principle_count: 0,
    has_summary: false,
    file_count: 0,
    library_origin: "recommended",
    built_in: true,
    in_my_library: Boolean(addedSourceId),
    added_source_id: addedSourceId,
  };
}

export function annotateFamilyCards(
  cards: ResearchSourceCard[],
): ResearchSourceCard[] {
  return cards.map((card) => ({
    ...card,
    library_origin: "family" as const,
    built_in: false,
    in_my_library: true,
    recommended_slug: card.recommended_slug ?? null,
  }));
}

function isOrganizationType(sourceType: string) {
  return [
    "professional_org_guidance",
    "government_guidance",
    "clinical_guideline",
  ].includes(sourceType);
}

function dedupePreferFamily(cards: ResearchSourceCard[]): ResearchSourceCard[] {
  const seen = new Set<string>();
  const result: ResearchSourceCard[] = [];
  // Family cards first so they win over catalog duplicates.
  const ordered = [
    ...cards.filter((c) => c.library_origin === "family"),
    ...cards.filter((c) => c.library_origin !== "family"),
  ];
  for (const card of ordered) {
    const key = card.recommended_slug
      ? `rec:${card.recommended_slug}`
      : `id:${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

/**
 * Compose library views for Recommended / My Library / Added / Books / Organizations.
 */
export function composeLibraryList(input: {
  familyId: string;
  familySources: ResearchSourceCard[];
  prefs: RecommendedFamilyPrefs;
  filters?: ResearchListFilters;
}): ResearchSourceCard[] {
  const filters = input.filters ?? {};
  const tab = filters.tab ?? "my-library";
  const family = annotateFamilyCards(input.familySources);
  const hidden = new Set(input.prefs.hidden);
  const recommended = RECOMMENDED_LIBRARY.filter((e) => !hidden.has(e.slug)).map(
    (entry) => catalogEntryToCard(entry, input.prefs, input.familyId),
  );

  let list: ResearchSourceCard[];
  if (tab === "my-library" || tab === "library") {
    list = family;
  } else if (tab === "added") {
    list = family.filter((s) => Boolean(s.recommended_slug));
  } else if (tab === "books") {
    list = dedupePreferFamily(
      [...family, ...recommended].filter((s) => s.source_type === "book"),
    );
  } else if (tab === "organizations") {
    list = dedupePreferFamily(
      [...family, ...recommended].filter((s) => isOrganizationType(s.source_type)),
    );
  } else if (tab === "recommended") {
    list = recommended;
  } else if (tab === "topics") {
    list = dedupePreferFamily([...family, ...recommended]);
  } else {
    // Legacy tabs (papers, guidelines, articles, queue) against family sources only.
    return filterAndSortSources(family, filters);
  }

  return filterAndSortSources(list, { ...filters, tab: undefined });
}
