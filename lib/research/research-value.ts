/**
 * Heuristic research-value classification for prioritization.
 * Does NOT invent evidence — only flags where outside evidence would help.
 */

export type ResearchValueClass =
  | "CRITICAL"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "NONE";

const CRITICAL_PATTERNS = [
  /safe\s*sleep/i,
  /bed\s*shar/i,
  /room\s*shar/i,
  /sids/i,
  /car\s*seat/i,
  /cpr/i,
  /chok/i,
  /vaccin/i,
  /immuniz/i,
  /fever/i,
  /circumcis/i,
  /co[\s-]?sleep/i,
  /unsafe/i,
  /emergency/i,
  /warning\s*sign/i,
  /maternal\s*mental/i,
  /postpartum\s*(depression|anxiety|psychosis)/i,
  /shaken/i,
];

const HIGH_PATTERNS = [
  /breastfeed/i,
  /formula/i,
  /pump/i,
  /feed(ing)?\b/i,
  /induction/i,
  /cesarean|c-?section/i,
  /labor|labour|birth\b/i,
  /epidural/i,
  /newborn/i,
  /pediatric/i,
  /vitamin\s*d/i,
  /swaddl/i,
  /pacifier/i,
  /allergen|solid\s*food/i,
  /child\s*care|daycare|nanny/i,
  /visitor.*(ill|sick|health)/i,
  /screen\s*(time|exposure)/i,
  /bath(ing)?\b/i,
  /temperature/i,
  /leave\b|parental\s*leave/i,
  /sleep\b/i,
  /postpartum|recovery/i,
];

const VALUES_PATTERNS = [
  /tradition/i,
  /faith|spiritual/i,
  /success as parents/i,
  /childhood.*(like|hope|remember)/i,
  /values?\b/i,
  /what kind of (parents|family)/i,
  /motto/i,
  /worried about as new parents/i,
  /holiday/i,
];

export function classifyResearchValue(input: {
  id: string;
  title: string;
  text: string;
  categories?: string[];
  topic?: string | null;
  evidence_needed?: boolean;
  research_mode?: string;
  priority?: string;
}): { class: ResearchValueClass; reason: string } {
  const blob = [
    input.title,
    input.text,
    input.topic ?? "",
    ...(input.categories ?? []),
  ].join(" ");

  if (VALUES_PATTERNS.some((p) => p.test(blob)) && !CRITICAL_PATTERNS.some((p) => p.test(blob))) {
    return { class: "NONE", reason: "Primarily values or personal reflection" };
  }

  if (CRITICAL_PATTERNS.some((p) => p.test(blob))) {
    return {
      class: "CRITICAL",
      reason: "Safety/health decision where outside guidance materially matters",
    };
  }

  if (
    input.evidence_needed ||
    input.research_mode === "strongly_recommended" ||
    input.research_mode === "professional_guidance_needed"
  ) {
    return {
      class: "HIGH",
      reason: "Question metadata marks evidence or professional guidance as important",
    };
  }

  if (HIGH_PATTERNS.some((p) => p.test(blob))) {
    return {
      class: "HIGH",
      reason: "Topic typically benefits from clinical or professional guidance",
    };
  }

  if (
    /visitor|boundary|overnight|division of labor|household|advice/i.test(blob) ||
    input.priority === "essential_before_birth" ||
    input.priority === "high"
  ) {
    return {
      class: "MODERATE",
      reason: "Useful context may help, but preference/logistics dominate",
    };
  }

  if (/logistics|register|insurance|pack|buy|checklist/i.test(blob)) {
    return { class: "LOW", reason: "Mostly logistics / execution" };
  }

  return { class: "LOW", reason: "Limited likely benefit from outside evidence" };
}
