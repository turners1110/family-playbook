/**
 * Deterministic mock web + AI providers for public-source book research.
 * Uses only curated public-facing metadata — never invents page numbers or chapter summaries.
 */
import type {
  GatheredPublicSource,
  PreliminaryFindingDraft,
  PublicBookAiProvider,
  PublicBookResearchContext,
  PublicOverviewDraft,
  WebResearchProvider,
} from "@/lib/research/public-research/provider";
import { assertHasSupportingSources, assertNoFakeCitations } from "@/lib/research/public-research/provider";

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function accessedAt() {
  return new Date().toISOString();
}

/** Curated public-facing descriptors keyed by recommended slug or title. */
const PUBLIC_BOOK_PROFILES: Record<
  string,
  {
    themes: string[];
    arguments: string[];
    framework: string;
    conclusions: string[];
    lessons: string[];
    questions: string[];
    discussion: string[];
    criticism: string[];
    disagreement: string[];
    related: string[];
    principles: string[];
    sources: Array<{
      title: string;
      author: string | null;
      publisher: string;
      url: string;
      source_type: GatheredPublicSource["source_type"];
      reliability_rating: GatheredPublicSource["reliability_rating"];
      notes: string;
    }>;
  }
> = {
  "expecting-better-emily-oster": {
    themes: [
      "Evidence-based pregnancy decisions",
      "Trade-offs under uncertainty",
      "Interpreting medical guidance with data",
    ],
    arguments: [
      "Many pregnancy recommendations mix strong evidence with weaker convention.",
      "Parents benefit from understanding relative risks, not only absolute rules.",
      "Personal values still matter once the evidence range is clear.",
    ],
    framework:
      "Gather the claim → check evidence quality → quantify risk where possible → decide with values.",
    conclusions: [
      "Public interviews emphasize decision-making under incomplete evidence.",
      "The book is often discussed as a data-forward companion to clinical care, not a replacement.",
    ],
    lessons: [
      "Ask which pregnancy guidelines are high-confidence versus preference-based.",
      "Write down decisions Sam and Michelle want clinician input on before acting.",
      "Separate medical urgency from lifestyle optimization questions.",
    ],
    questions: [
      "Which pregnancy choices feel high-stakes enough to require a clinician conversation?",
      "Where do Sam and Michelle differ on risk tolerance?",
    ],
    discussion: [
      "Agree how you will weigh conflicting public health vs. specialist advice.",
      "Decide which topics need a shared written plan versus flexible judgment.",
    ],
    criticism: [
      "Critics argue population averages may not fit individual medical histories.",
      "Some clinicians caution against treating economics-style analysis as clinical advice.",
    ],
    disagreement: [
      "How much alcohol, caffeine, or activity risk is acceptable remains contested in public commentary.",
    ],
    related: [
      "ACOG and CDC pregnancy guidance should be reviewed alongside popular books.",
      "Distinguish book themes from primary clinical studies.",
    ],
    principles: [
      "Use evidence ranges, then decide together.",
      "Clinical care overrides popular summaries when they conflict.",
    ],
    sources: [
      {
        title: "Expecting Better — publisher description",
        author: "Emily Oster",
        publisher: "Penguin Press (publisher materials)",
        url: "https://www.penguinrandomhouse.com/",
        source_type: "publisher_page",
        reliability_rating: "high",
        notes: "Publisher marketing/description of themes; not a full-text source.",
      },
      {
        title: "Emily Oster public interviews on pregnancy data",
        author: "Emily Oster",
        publisher: "Author interviews / media",
        url: "https://emilyoster.net/",
        source_type: "author_interview",
        reliability_rating: "high",
        notes: "Author-stated framing of evidence-based pregnancy decisions.",
      },
      {
        title: "Library catalog description — Expecting Better",
        author: null,
        publisher: "Public library catalogs",
        url: "https://www.worldcat.org/",
        source_type: "library_catalog",
        reliability_rating: "moderate",
        notes: "Catalog abstract only.",
      },
      {
        title: "Reputable reviews of Expecting Better",
        author: null,
        publisher: "Major book review outlets",
        url: "https://www.nytimes.com/",
        source_type: "book_review",
        reliability_rating: "reviewer_interpretation",
        notes: "Reviewer interpretation — not primary evidence.",
      },
      {
        title: "ACOG clinical guidance (related professional context)",
        author: null,
        publisher: "ACOG",
        url: "https://www.acog.org/",
        source_type: "professional_guidance",
        reliability_rating: "high",
        notes: "Related professional guidance; not a substitute for reading the book.",
      },
      {
        title: "CDC pregnancy health pages (related)",
        author: null,
        publisher: "CDC",
        url: "https://www.cdc.gov/",
        source_type: "professional_guidance",
        reliability_rating: "high",
        notes: "Related public-health context separated from claims about the book.",
      },
    ],
  },
};

function profileFor(ctx: PublicBookResearchContext) {
  const slug = ctx.source.recommended_slug ?? "";
  if (PUBLIC_BOOK_PROFILES[slug]) return PUBLIC_BOOK_PROFILES[slug];
  const titleKey = ctx.source.title.toLowerCase();
  if (titleKey.includes("expecting better")) {
    return PUBLIC_BOOK_PROFILES["expecting-better-emily-oster"];
  }
  return null;
}

function genericSources(ctx: PublicBookResearchContext): GatheredPublicSource[] {
  const author = ctx.source.author_text ?? "Unknown author";
  const title = ctx.source.title;
  return [
    {
      title: `${title} — publisher / retail listing`,
      author,
      publisher: "Publisher or bookseller public page",
      url: null,
      source_type: "publisher_page",
      publication_date: ctx.source.publication_year
        ? `${ctx.source.publication_year}-01-01`
        : null,
      accessed_at: accessedAt(),
      reliability_rating: "moderate",
      notes: "Public metadata listing only. Full book text was not accessed.",
    },
    {
      title: `${author} — public author materials`,
      author,
      publisher: "Author website or verified profile",
      url: null,
      source_type: "author_website",
      publication_date: null,
      accessed_at: accessedAt(),
      reliability_rating: "high",
      notes: "Author-facing public description when available.",
    },
    {
      title: `Library catalog entry — ${title}`,
      author,
      publisher: "Library catalog",
      url: null,
      source_type: "library_catalog",
      publication_date: null,
      accessed_at: accessedAt(),
      reliability_rating: "moderate",
      notes: "Catalog description; not a review of full text.",
    },
    {
      title: `Public reviews — ${title}`,
      author: null,
      publisher: "Reputable review outlets",
      url: null,
      source_type: "book_review",
      publication_date: null,
      accessed_at: accessedAt(),
      reliability_rating: "reviewer_interpretation",
      notes: "Labeled as reviewer interpretation.",
    },
  ];
}

export class MockWebResearchProvider implements WebResearchProvider {
  name = "mock-web-research";

  async searchPublicBookSources(
    ctx: PublicBookResearchContext,
  ): Promise<GatheredPublicSource[]> {
    const profile = profileFor(ctx);
    if (profile) {
      return profile.sources.map((s) => ({
        ...s,
        publication_date: nowDate(),
        accessed_at: accessedAt(),
      }));
    }
    return genericSources(ctx);
  }
}

export class MockPublicBookAiProvider implements PublicBookAiProvider {
  name = "mock-public-book-ai";
  model = "mock-public-v1";
  promptVersion = "public-overview-v1";

  async generatePublicBookOverview(
    ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
  ): Promise<PublicOverviewDraft> {
    assertHasSupportingSources(["overview"], sources);
    const profile = profileFor(ctx);
    const short = profile
      ? `Public-source overview of “${ctx.source.title}” based on publisher, author, and review materials. The full book has not been processed.`
      : `Preliminary public-source overview for “${ctx.source.title}” by ${ctx.source.author_text ?? "unknown"}. The full book has not been processed.`;

    const detailed = [
      short,
      "",
      "Source basis: Public sources only.",
      "This is not a full summary, chapter summary, or source-grounded book analysis.",
      ctx.source.description ? `Catalog description: ${ctx.source.description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    for (const text of [short, detailed]) assertNoFakeCitations(text);

    return {
      processing_mode: "public_sources_only",
      short_summary: short,
      detailed_overview: detailed,
      main_themes: profile?.themes ?? [
        "Parenting / family decision themes discussed publicly about this title",
      ],
      author_arguments: profile?.arguments ?? [
        "Author public materials describe practical frameworks; verify against primary sources before adopting.",
      ],
      core_framework: profile?.framework ?? null,
      important_conclusions: profile?.conclusions ?? [
        "Public materials suggest the book aims to inform family decisions; clinical guidance still takes priority.",
      ],
      practical_lessons: profile?.lessons ?? [
        "Use the book as a discussion prompt, not automatic family policy.",
      ],
      questions_raised: profile?.questions ?? [
        "What claims need clinician or primary-research verification?",
      ],
      discussion_points: profile?.discussion ?? [
        "What would Sam and Michelle adopt, adapt, or reject?",
      ],
      relevant_checklist_task_ids: ctx.checklistTaskIds.slice(0, 5),
      relevant_question_ids: ctx.questionIds.slice(0, 8),
      potential_principles: profile?.principles ?? [
        "Evidence informs decisions; partners still choose together.",
      ],
      related_research: profile?.related ?? [
        "Consult professional guidance related to the book’s topic area.",
      ],
      criticism_limitations: profile?.criticism ?? [
        "Popular books can over-generalize; individual medical context may differ.",
      ],
      areas_of_disagreement: profile?.disagreement ?? [
        "Public commentary often disagrees on how strongly to apply the author’s recommendations.",
      ],
      confidence: sources.length >= 4 ? "moderate" : "low",
      review_status: "needs_review",
      full_book_processed: false,
      source_basis: "public_sources",
      ai_provider: this.name,
      model_name: this.model,
      prompt_version: this.promptVersion,
      source_count: sources.length,
    };
  }

  async extractPreliminaryFindings(
    ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
    overview: PublicOverviewDraft,
  ): Promise<PreliminaryFindingDraft[]> {
    assertHasSupportingSources(overview.main_themes, sources);
    return overview.main_themes.slice(0, 5).map((theme) => {
      const text = `Preliminary finding from public sources: ${theme}. Not derived from full-book text.`;
      assertNoFakeCitations(text);
      return {
        finding_type: "claim" as const,
        title: theme,
        finding_text: text,
        confidence: "low" as const,
        evidence_strength: "expert_opinion",
        source_basis: "public_sources" as const,
        is_preliminary: true,
        external_source_ids: [],
        related_topics: ctx.source.topics.slice(0, 3),
        linked_question_ids: overview.relevant_question_ids.slice(0, 2),
        linked_checklist_task_ids: overview.relevant_checklist_task_ids.slice(0, 2),
        ai_generated: true,
        review_status: "needs_review" as const,
      };
    });
  }

  async generatePreliminaryLessons(
    _ctx: PublicBookResearchContext,
    sources: GatheredPublicSource[],
    overview: PublicOverviewDraft,
  ): Promise<string[]> {
    assertHasSupportingSources(overview.practical_lessons, sources);
    return overview.practical_lessons.map((lesson) => {
      assertNoFakeCitations(lesson);
      return lesson;
    });
  }
}

export function getWebResearchProvider(): WebResearchProvider {
  // Optional live provider can be wired when RESEARCH_WEB_PROVIDER=tavily and key is set.
  const provider = process.env.RESEARCH_WEB_PROVIDER?.toLowerCase();
  if (provider === "tavily" && process.env.TAVILY_API_KEY) {
    // Live Tavily integration can be added without changing call sites.
    // Fall through to mock until fully configured to avoid half-wired scraping.
  }
  return new MockWebResearchProvider();
}

export function getPublicBookAiProvider(): PublicBookAiProvider {
  const provider = process.env.RESEARCH_AI_PROVIDER?.toLowerCase();
  if (
    (provider === "openai" && process.env.OPENAI_API_KEY) ||
    (provider === "anthropic" && process.env.ANTHROPIC_API_KEY)
  ) {
    // Live LLM providers can be added behind the same interface.
  }
  return new MockPublicBookAiProvider();
}
