import { describe, expect, it } from "vitest";
import { synthesizeEvidence, detectFamilyEvidenceMismatch } from "@/lib/research/synthesis";
import type { GroundedFinding } from "@/lib/research/evidence-model";
import { groundedFindingsFromLinks } from "@/lib/research/ground-findings";
import { classifyResearchValue } from "@/lib/research/research-value";
import { classifyEvidenceGap, buildResearchQueue } from "@/lib/research/gaps";
import {
  classifyPrebirthBucket,
  whyNowExplanation,
} from "@/lib/research/prebirth-priority";
import {
  sanitizeAnswersForResearchContext,
  assertNoHiddenPartnerLeak,
} from "@/lib/research/privacy";
import type { Answer } from "@/lib/types/models";

function finding(partial: Partial<GroundedFinding> & Pick<GroundedFinding, "id" | "finding_text" | "source_id" | "source_title">): GroundedFinding {
  return {
    source_type: "clinical_guideline",
    practical_implication: null,
    topic_ids: [],
    question_ids: [],
    decision_ids: [],
    life_stages: [],
    relationship: "supports",
    evidence_strength: "high",
    source_quality: "primary_guideline",
    confidence: "high",
    location: null,
    chapter: null,
    page_if_known: null,
    url_if_applicable: null,
    published_at_if_known: null,
    extracted_at: null,
    extraction_method: "test",
    review_status: "approved",
    ...partial,
  };
}

describe("research synthesis", () => {
  it("returns insufficient without inventing evidence", () => {
    const s = synthesizeEvidence([]);
    expect(s.has_grounded_evidence).toBe(false);
    expect(s.evidence_picture).toBe("insufficient");
    expect(s.key_takeaway).toBeNull();
    expect(s.kind).toBe("source_derived_synthesis");
  });

  it("keeps source IDs and surfaces disagreement", () => {
    const s = synthesizeEvidence([
      finding({
        id: "f1",
        source_id: "s1",
        source_title: "AAP",
        finding_text: "Room-share initially.",
        relationship: "supports",
      }),
      finding({
        id: "f2",
        source_id: "s2",
        source_title: "Book A",
        finding_text: "Some families choose bedsharing with conditions.",
        relationship: "contradicts",
        source_quality: "evidence_based_book",
        evidence_strength: "moderate",
      }),
    ]);
    expect(s.has_grounded_evidence).toBe(true);
    expect(s.evidence_picture).toBe("mixed");
    expect(s.source_ids).toEqual(["s1", "s2"]);
    expect(s.areas_of_disagreement.length).toBeGreaterThan(0);
  });

  it("detects family/evidence mismatch without rewriting", () => {
    const m = detectFamilyEvidenceMismatch({
      familyPosition: "We plan bedsharing.",
      findings: [
        finding({
          id: "f1",
          source_id: "s1",
          source_title: "AAP",
          finding_text: "Avoid bedsharing.",
          relationship: "contradicts",
        }),
      ],
    });
    expect(m.hasMismatch).toBe(true);
    expect(m.summary).toMatch(/Review/);
  });
});

describe("ground findings", () => {
  it("ignores empty links and keeps provenance", () => {
    const findings = groundedFindingsFromLinks(
      [
        {
          link: { id: "l1", relevance_note: null, link_type: "supports" },
          source: { id: "s1", title: "Guide", evidence_rating: "moderate" },
          shortFinding: null,
        },
        {
          link: { id: "l2", relevance_note: "Useful note", link_type: "supports" },
          source: {
            id: "s2",
            title: "CDC",
            evidence_rating: "high",
            evidence_basis: "government_guidance",
          },
          shortFinding: "Vitamin D is recommended for breastfed infants.",
        },
      ],
      "q1",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.source_title).toBe("CDC");
    expect(findings[0]!.question_ids).toContain("q1");
  });
});

describe("research value and gaps", () => {
  it("classifies safe sleep as CRITICAL and values as NONE", () => {
    expect(
      classifyResearchValue({
        id: "1",
        title: "Safe sleep",
        text: "What is our stance on bedsharing and roomsharing?",
      }).class,
    ).toBe("CRITICAL");
    expect(
      classifyResearchValue({
        id: "2",
        title: "Traditions",
        text: "What traditions do we want our child to grow up with?",
      }).class,
    ).toBe("NONE");
  });

  it("builds a queue only for high-value missing evidence", () => {
    const queue = buildResearchQueue([
      {
        question_id: "q1",
        slug: "safe-sleep",
        title: "Safe sleep",
        decision_hubs: ["safe-sleep"],
        research_value: "CRITICAL",
        research_value_reason: "safety",
        grounded_finding_count: 0,
      },
      {
        question_id: "q2",
        slug: "traditions",
        title: "Traditions",
        decision_hubs: [],
        research_value: "NONE",
        research_value_reason: "values",
        grounded_finding_count: 0,
      },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.question_id).toBe("q1");
    expect(classifyEvidenceGap({ researchValue: "NONE", groundedFindingCount: 0 })).toBe(
      "unnecessary",
    );
  });
});

describe("prebirth priority", () => {
  it("buckets must-decide topics and explains why now", () => {
    const b = classifyPrebirthBucket({
      title: "Car seat",
      text: "Which car seat will we buy before birth?",
      required_before_birth: true,
    });
    expect(b.bucket).toBe("must_decide_before_birth");
    expect(
      whyNowExplanation({
        bucket: b.bucket,
        title: "Car seat",
        estimated_minutes: 10,
        pregnancy_week: 30,
      }),
    ).toMatch(/week 30/);
  });
});

describe("research privacy", () => {
  it("excludes hidden partner answers from synthesis context", () => {
    const answers = [
      {
        id: "a1",
        family_id: "f",
        question_id: "q",
        member_id: "sam",
        is_shared: false,
        payload: { text: "SECRET_PARTNER_TEXT" },
        status: "in_discussion",
        confidence: 3,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "",
        updated_at: "",
        _partner_hidden: true,
      },
      {
        id: "a2",
        family_id: "f",
        question_id: "q",
        member_id: null,
        is_shared: true,
        payload: { text: "Shared plan" },
        status: "agreed",
        confidence: 4,
        bookmarked: false,
        needs_research: false,
        review_date: null,
        version: 1,
        created_at: "",
        updated_at: "",
      },
    ] as Array<Answer & { _partner_hidden?: boolean }>;

    const safe = sanitizeAnswersForResearchContext(answers);
    const blob = JSON.stringify(safe);
    expect(blob).not.toContain("SECRET_PARTNER_TEXT");
    expect(blob).toContain("Shared plan");
    expect(() =>
      assertNoHiddenPartnerLeak(blob, ["SECRET_PARTNER_TEXT"]),
    ).not.toThrow();
  });
});
