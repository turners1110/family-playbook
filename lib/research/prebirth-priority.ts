/**
 * Pre-birth discussion priority buckets.
 * Not a fake score — uses safety, lead time, provider timing, and metadata.
 */

export type PrebirthBucket =
  | "must_decide_before_birth"
  | "worth_discussing_before_birth"
  | "good_if_time"
  | "later";

export const PREBIRTH_BUCKET_LABELS: Record<PrebirthBucket, string> = {
  must_decide_before_birth: "Must decide before birth",
  worth_discussing_before_birth: "Worth discussing before birth",
  good_if_time: "Good if time",
  later: "Later",
};

const MUST_PATTERNS = [
  /safe\s*sleep|bed\s*shar|room\s*shar|car\s*seat|cpr|pediatrician|hospital|birth\b|labor|feeding|breastfeed|formula|visitor|overnight|postpartum|recovery|child\s*care|leave\b|circumcis|vaccin/i,
];

const WORTH_PATTERNS = [
  /boundary|advice|household|division|partner|expectation|support|pump|swaddl|pacifier|bath|names?|announcement/i,
];

export function classifyPrebirthBucket(input: {
  title: string;
  text: string;
  priority?: string | null;
  required_before_birth?: boolean;
  babymoon_priority?: boolean | number | null;
  research_value?: string;
  estimated_minutes?: number;
  life_stages?: string[];
}): {
  bucket: PrebirthBucket;
  why: string;
  ideal_window: string;
} {
  const blob = `${input.title} ${input.text}`;
  const isPrebirthStage =
    !input.life_stages?.length ||
    input.life_stages.some((s) =>
      ["pregnancy", "before_birth", "labor_birth", "newborn", "all_stages"].includes(s),
    );

  if (!isPrebirthStage && !input.required_before_birth) {
    return {
      bucket: "later",
      why: "Primarily relevant after birth or in later childhood.",
      ideal_window: "After birth / later",
    };
  }

  if (
    MUST_PATTERNS.some((p) => p.test(blob)) ||
    input.research_value === "CRITICAL"
  ) {
    return {
      bucket: "must_decide_before_birth",
      why: "Affects safety, birth logistics, or setup that needs lead time before delivery.",
      ideal_window: "By ~30–36 weeks",
    };
  }

  if (
    input.required_before_birth ||
    input.priority === "essential_before_birth" ||
    input.priority === "high" ||
    input.babymoon_priority ||
    WORTH_PATTERNS.some((p) => p.test(blob)) ||
    input.research_value === "HIGH"
  ) {
    return {
      bucket: "worth_discussing_before_birth",
      why: "Shapes early partnership and plans; better decided before the newborn scramble.",
      ideal_window: "During pregnancy / Babymoon",
    };
  }

  if ((input.estimated_minutes ?? 8) <= 8) {
    return {
      bucket: "good_if_time",
      why: "Useful if energy remains, but not blocking birth preparation.",
      ideal_window: "Anytime before birth if time allows",
    };
  }

  return {
    bucket: "later",
    why: "Can wait until after birth without blocking preparation.",
    ideal_window: "Postpartum / first year",
  };
}

export function whyNowExplanation(input: {
  bucket: PrebirthBucket;
  title: string;
  estimated_minutes?: number | null;
  research_finding_count?: number;
  pregnancy_week?: number | null;
}): string {
  const mins = input.estimated_minutes
    ? `About ${input.estimated_minutes} min.`
    : "";
  const research =
    input.research_finding_count && input.research_finding_count > 0
      ? `${input.research_finding_count} research finding(s) ready.`
      : "";
  const week =
    input.pregnancy_week != null
      ? `You're around week ${input.pregnancy_week}.`
      : "";

  if (input.bucket === "must_decide_before_birth") {
    return [week, "This affects what you need arranged before birth.", mins, research]
      .filter(Boolean)
      .join(" ");
  }
  if (input.bucket === "worth_discussing_before_birth") {
    return [week, "Worth aligning now while you still have discussion energy.", mins, research]
      .filter(Boolean)
      .join(" ");
  }
  return [week, mins, research].filter(Boolean).join(" ") || "Useful when you have capacity.";
}
