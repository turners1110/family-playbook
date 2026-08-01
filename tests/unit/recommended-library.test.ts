import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
  composeLibraryList,
  emptyRecommendedPrefs,
} from "@/lib/research/recommended";
import { RECOMMENDED_LIBRARY } from "@/lib/research/recommended-seed";
import {
  clearRecommendedPrefsForTests,
  setMemoryRecommendedPrefsForTests,
} from "@/lib/research/recommended-prefs";
import type { ResearchSourceCard } from "@/lib/research/types";
import {
  addRecommendedToLibrary,
  hideRecommendedLibraryItem,
  listResearchSources,
  setResearchRepositoryForTests,
} from "@/lib/research/services";
import { createMemoryResearchRepository } from "@/lib/research/memory-repository";
import type { FamilyContext } from "@/lib/auth/family-context";

const ctx: FamilyContext = {
  mode: "emergency",
  user: null,
  profile: {
    id: "user_sam",
    email: "sam@turner.family",
    display_name: "Sam Turner",
    created_at: "",
  },
  member: {
    id: "member_sam",
    family_id: "family_turner",
    user_id: "user_sam",
    display_name: "Sam",
    role: "parent",
    sort_order: 1,
    created_at: "",
  },
  family: {
    id: "family_turner",
    name: "Turner Family",
    created_at: "",
    updated_at: "",
  },
  settings: {
    family_id: "family_turner",
    hide_partner_answers_until_both_saved: true,
    dark_mode: "system",
    babymoon_target_date: null,
    babymoon_daily_questions: 3,
    include_perspective_history_in_playbook: true,
    updated_at: "",
  },
};

describe("recommended library seed", () => {
  it("includes all expected books and organizations", () => {
    expect(RECOMMENDED_LIBRARY).toHaveLength(24);
    expect(RECOMMENDED_LIBRARY.filter((e) => e.kind === "book")).toHaveLength(18);
    expect(RECOMMENDED_LIBRARY.filter((e) => e.kind === "organization")).toHaveLength(
      6,
    );
    for (const entry of RECOMMENDED_LIBRARY) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description.toLowerCase()).toMatch(/metadata|reference/);
      expect(entry.description.toLowerCase()).not.toMatch(/summary of chapter/);
    }
  });

  it("migration is idempotent by slug", async () => {
    const sql = await fs.readFile(
      path.join(process.cwd(), "supabase/migrations/0007_seed_recommended_library.sql"),
      "utf8",
    );
    expect(sql).toMatch(/on conflict \(slug\) do nothing/);
    expect(sql).toMatch(/research_recommended_sources/);
    expect(sql).toMatch(/research_recommended_family_state/);
    expect(sql).toMatch(/Expecting Better/);
    expect(sql).toMatch(/American Academy of Pediatrics/);
    expect(sql).not.toMatch(/insert into public\.research_source_summaries/i);
    expect(sql).not.toMatch(/research_findings/);
  });
});

describe("composeLibraryList", () => {
  const familyId = "family_turner";

  it("defaults recommended view to built-in catalog", () => {
    const list = composeLibraryList({
      familyId,
      familySources: [],
      prefs: emptyRecommendedPrefs(),
      filters: { tab: "recommended" },
    });
    expect(list.length).toBe(24);
    expect(list.every((s) => s.built_in)).toBe(true);
    expect(list.every((s) => s.processing_status === "metadata_only")).toBe(true);
    expect(list.every((s) => s.finding_count === 0 && !s.has_summary)).toBe(true);
  });

  it("hides recommendations and supports my-library / added / books / orgs", () => {
    const prefs = emptyRecommendedPrefs();
    prefs.hidden.push("expecting-better-emily-oster");
    const familySource = {
      id: "src_1",
      family_id: familyId,
      title: "Cribsheet",
      subtitle: null,
      source_type: "book",
      author_text: "Emily Oster",
      organization: null,
      publisher: null,
      publication_year: 2019,
      edition: null,
      isbn: null,
      description: null,
      source_url: null,
      cover_image_url: null,
      availability_type: "metadata_only",
      processing_status: "metadata_only",
      evidence_rating: null,
      evidence_rating_reason: null,
      evidence_basis: "expert_authored_book",
      evidence_rating_approved: false,
      ownership_status: null,
      topics: ["infant"],
      life_stages: ["infant_3_12"],
      rights_attested: false,
      added_by_member_id: "member_sam",
      added_by_display_name: "Sam",
      recommended_slug: "cribsheet-emily-oster",
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      processed_at: null,
      archived_at: null,
      finding_count: 0,
      linked_question_count: 0,
      linked_principle_count: 0,
      has_summary: false,
      file_count: 0,
    } satisfies ResearchSourceCard;

    prefs.added["cribsheet-emily-oster"] = "src_1";

    const recommended = composeLibraryList({
      familyId,
      familySources: [familySource],
      prefs,
      filters: { tab: "recommended" },
    });
    expect(recommended.some((s) => s.recommended_slug === "expecting-better-emily-oster")).toBe(
      false,
    );
    expect(recommended).toHaveLength(23);

    const mine = composeLibraryList({
      familyId,
      familySources: [familySource],
      prefs,
      filters: { tab: "my-library" },
    });
    expect(mine).toHaveLength(1);

    const added = composeLibraryList({
      familyId,
      familySources: [familySource],
      prefs,
      filters: { tab: "added" },
    });
    expect(added).toHaveLength(1);

    const books = composeLibraryList({
      familyId,
      familySources: [familySource],
      prefs,
      filters: { tab: "books" },
    });
    expect(books.every((s) => s.source_type === "book")).toBe(true);
    expect(
      books.filter((s) => s.recommended_slug === "cribsheet-emily-oster"),
    ).toHaveLength(1);

    const orgs = composeLibraryList({
      familyId,
      familySources: [],
      prefs: emptyRecommendedPrefs(),
      filters: { tab: "organizations" },
    });
    expect(orgs).toHaveLength(6);
    expect(orgs.every((s) => s.ownership_status === "reference_only")).toBe(true);
  });
});

describe("recommended library actions", () => {
  afterEach(() => {
    setResearchRepositoryForTests(null);
    clearRecommendedPrefsForTests();
  });

  it("adds a recommendation to my library without creating summaries", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    setMemoryRecommendedPrefsForTests("family_turner", emptyRecommendedPrefs());

    const before = await listResearchSources({ tab: "recommended" }, ctx);
    expect(before.length).toBeGreaterThan(0);

    const sourceId = await addRecommendedToLibrary(ctx, "expecting-better-emily-oster");
    expect(sourceId).toBeTruthy();

    const mine = await listResearchSources({ tab: "my-library" }, ctx);
    expect(mine.some((s) => s.id === sourceId)).toBe(true);
    expect(mine.find((s) => s.id === sourceId)?.recommended_slug).toBe(
      "expecting-better-emily-oster",
    );
    expect(repo.snapshot().summaries).toHaveLength(0);

    // Idempotent add
    const again = await addRecommendedToLibrary(ctx, "expecting-better-emily-oster");
    expect(again).toBe(sourceId);
    expect(repo.snapshot().sources.filter((s) => s.recommended_slug === "expecting-better-emily-oster")).toHaveLength(1);
  });

  it("hides a recommendation from the catalog view", async () => {
    const repo = createMemoryResearchRepository();
    setResearchRepositoryForTests(repo, "local");
    setMemoryRecommendedPrefsForTests("family_turner", emptyRecommendedPrefs());

    await hideRecommendedLibraryItem(ctx, "org-cdc");
    const list = await listResearchSources({ tab: "recommended" }, ctx);
    expect(list.some((s) => s.recommended_slug === "org-cdc")).toBe(false);
  });
});
