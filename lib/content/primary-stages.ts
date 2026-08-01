/**
 * Deterministic primary discussion stage assignment.
 * Keeps life_stages for backward compatibility; does not use unreviewed AI.
 */
import type { LifeStage } from "@/lib/constants/enums";
import type { Question } from "@/lib/types/models";

const LATER_STAGES: LifeStage[] = [
  "preteen",
  "teen",
  "young_adult",
  "adult_child",
  "later_elementary_8_11",
];

const PREGNANCY_STAGES: LifeStage[] = [
  "pre_birth_planning",
  "pregnancy",
  "labor_and_birth",
  "first_week",
  "newborn_0_3",
];

function textBlob(q: Question): string {
  return `${q.short_title} ${q.text} ${q.categories.join(" ")} ${q.subcategories.join(" ")}`.toLowerCase();
}

/** Infer one primary stage from categories + content rules. */
export function inferPrimaryDiscussionStage(q: Question): {
  primary: LifeStage;
  review_stages: LifeStage[];
  trigger_event: string | null;
  timing_reason: string;
  confidence: "high" | "medium" | "low";
} {
  if (q.primary_discussion_stage && q.primary_stage_source === "manual") {
    return {
      primary: q.primary_discussion_stage,
      review_stages: q.review_stages ?? [],
      trigger_event: q.trigger_event ?? null,
      timing_reason: q.timing_reason ?? "Manually set primary stage.",
      confidence: "high",
    };
  }

  const blob = textBlob(q);
  const stages = q.life_stages.filter((s) => s !== "all_stages");

  if (
    /\b(social media|dating|driver'?s license|driving|substance|alcohol|drugs|college|puberty|teen independence)\b/.test(
      blob,
    )
  ) {
    const primary: LifeStage = /\b(college|adult)\b/.test(blob)
      ? "teen"
      : /\bpuberty\b/.test(blob)
        ? "preteen"
        : "teen";
    return {
      primary,
      review_stages: primary === "preteen" ? ["teen"] : ["young_adult"],
      trigger_event: /\bsocial media\b/.test(blob)
        ? "First social-media request or personal device"
        : /\bdriv/.test(blob)
          ? "Learner permit / first driving discussion"
          : null,
      timing_reason: "Later-childhood topic; keep out of pregnancy queues.",
      confidence: "high",
    };
  }

  if (
    q.required_before_birth ||
    q.priority === "essential_before_birth" ||
    q.categories.some((c) =>
      /pregnancy|newborn|postpartum|feeding|sleep|childcare/.test(c),
    ) ||
    /\b(labor|birth|hospital|pediatrician|feeding|newborn|postpartum|leave|guardian|will|insurance)\b/.test(
      blob,
    )
  ) {
    const primary: LifeStage = /\b(newborn|first week|postpartum)\b/.test(blob)
      ? "newborn_0_3"
      : "pregnancy";
    return {
      primary,
      review_stages:
        primary === "pregnancy" ? ["newborn_0_3", "infant_3_12"] : ["infant_3_12"],
      trigger_event: /\binsurance\b/.test(blob) ? "Immediately after birth" : null,
      timing_reason: "Pregnancy / newborn planning topic.",
      confidence: "high",
    };
  }

  if (stages.length === 1) {
    return {
      primary: stages[0]!,
      review_stages: [],
      trigger_event: null,
      timing_reason: "Single life stage on the question.",
      confidence: "medium",
    };
  }

  const pregnancyHit = stages.find((s) => PREGNANCY_STAGES.includes(s));
  if (pregnancyHit) {
    return {
      primary: pregnancyHit,
      review_stages: stages.filter((s) => s !== pregnancyHit).slice(0, 3),
      trigger_event: null,
      timing_reason: "Earliest pregnancy-related stage among assigned stages.",
      confidence: "medium",
    };
  }

  const laterHit = stages.find((s) => LATER_STAGES.includes(s));
  if (laterHit) {
    return {
      primary: laterHit,
      review_stages: stages.filter((s) => s !== laterHit).slice(0, 3),
      trigger_event: null,
      timing_reason: "Later-stage assignment among multi-stage list.",
      confidence: "medium",
    };
  }

  if (stages[0]) {
    return {
      primary: stages[0],
      review_stages: stages.slice(1, 4),
      trigger_event: null,
      timing_reason: "First listed life stage (low confidence).",
      confidence: "low",
    };
  }

  return {
    primary: "all_stages",
    review_stages: [],
    trigger_event: null,
    timing_reason: "No life stages present; defaulted to all_stages.",
    confidence: "low",
  };
}

export function applyPrimaryStageToQuestion(q: Question): Question {
  if (q.primary_stage_source === "manual" && q.primary_discussion_stage) {
    return q;
  }
  const inferred = inferPrimaryDiscussionStage(q);
  return {
    ...q,
    primary_discussion_stage: inferred.primary,
    review_stages: inferred.review_stages,
    trigger_event: inferred.trigger_event,
    timing_reason: inferred.timing_reason,
    primary_stage_source: "rule_based",
  };
}

export function isInPregnancyWorkflow(q: Question): boolean {
  const primary = q.primary_discussion_stage ?? inferPrimaryDiscussionStage(q).primary;
  const review = q.review_stages ?? [];
  return (
    PREGNANCY_STAGES.includes(primary) ||
    review.some((s) => PREGNANCY_STAGES.includes(s))
  );
}

export type PrimaryStageReport = {
  missing_primary: string[];
  low_confidence: Array<{ id: string; reason: string }>;
  teen_in_pregnancy_queue: string[];
  insurance_missing_pregnancy: string[];
};

export function buildPrimaryStageReport(questions: Question[]): PrimaryStageReport {
  const missing_primary: string[] = [];
  const low_confidence: Array<{ id: string; reason: string }> = [];
  const teen_in_pregnancy_queue: string[] = [];
  const insurance_missing_pregnancy: string[] = [];

  for (const q of questions.filter((x) => x.active !== false)) {
    const inferred = inferPrimaryDiscussionStage(q);
    if (!q.primary_discussion_stage && !inferred.primary) {
      missing_primary.push(q.id);
    }
    if (inferred.confidence === "low") {
      low_confidence.push({ id: q.id, reason: inferred.timing_reason });
    }
    const primary = q.primary_discussion_stage ?? inferred.primary;
    if (
      (primary === "teen" || primary === "preteen") &&
      q.priority === "essential_before_birth"
    ) {
      teen_in_pregnancy_queue.push(q.id);
    }
    const blob = textBlob(q);
    if (
      /\binsurance\b/.test(blob) &&
      /\b(baby|birth|newborn|enroll)\b/.test(blob) &&
      !PREGNANCY_STAGES.includes(primary)
    ) {
      insurance_missing_pregnancy.push(q.id);
    }
  }

  return {
    missing_primary,
    low_confidence,
    teen_in_pregnancy_queue,
    insurance_missing_pregnancy,
  };
}
