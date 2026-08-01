/**
 * Discussion-area topic map for AI content review.
 * Matching is keyword-based against question titles, text, categories, and tags.
 */

export type DiscussionTopicDef = {
  key: string;
  label: string;
  keywords: string[];
};

export const DISCUSSION_TOPICS: DiscussionTopicDef[] = [
  { key: "pregnancy", label: "Pregnancy", keywords: ["pregnancy", "prenatal", "trimester", "gestation"] },
  { key: "labor_and_delivery", label: "Labor and delivery", keywords: ["labor", "delivery", "birth plan", "hospital birth", "induction", "c-section", "cesarean"] },
  { key: "newborn_care", label: "Newborn care", keywords: ["newborn", "first week", "umbilical", "diaper"] },
  { key: "infant_sleep", label: "Infant sleep", keywords: ["sleep", "nap", "safe sleep", "crib", "bassinet", "swaddle"] },
  { key: "feeding", label: "Feeding", keywords: ["feeding", "breastfeed", "bottle", "formula", "pump", "lactation", "solid food"] },
  { key: "pediatric_care", label: "Pediatric care", keywords: ["pediatric", "doctor", "vaccine", "well visit", "immunization"] },
  { key: "safety", label: "Safety", keywords: ["safety", "car seat", "baby-proof", "choking", "cpr", "first aid"] },
  { key: "childcare", label: "Childcare", keywords: ["childcare", "daycare", "nanny", "babysitter"] },
  { key: "parental_leave", label: "Parental leave", keywords: ["leave", "parental leave", "maternity", "paternity", "fmla"] },
  { key: "division_of_labor", label: "Division of labor", keywords: ["division of labor", "chores", "household labor", "night shift", "overnight"] },
  { key: "visitors_and_boundaries", label: "Visitors and family boundaries", keywords: ["visitor", "boundary", "boundaries", "in-law", "guest"] },
  { key: "finances", label: "Finances", keywords: ["finance", "budget", "money", "cost", "expense"] },
  { key: "insurance", label: "Insurance", keywords: ["insurance", "beneficiary", "health plan"] },
  { key: "wills_and_guardianship", label: "Wills and guardianship", keywords: ["last will", "guardian", "guardianship", "estate plan", "estate documents", "living trust"] },
  { key: "education", label: "Education", keywords: ["education", "school", "learning", "homework"] },
  { key: "discipline", label: "Discipline", keywords: ["discipline", "consequence", "punishment", "timeout", "behavior"] },
  { key: "emotional_development", label: "Emotional development", keywords: ["emotion", "feelings", "attachment", "mental health", "anxiety"] },
  { key: "technology", label: "Technology", keywords: ["screen", "technology", "device", "phone", "tablet", "tv"] },
  { key: "religion", label: "Religion", keywords: ["religion", "faith", "church", "spiritual", "worship"] },
  { key: "culture", label: "Culture", keywords: ["culture", "cultural", "heritage", "language"] },
  { key: "family_traditions", label: "Family traditions", keywords: ["tradition", "holiday", "celebration", "ritual"] },
  { key: "health", label: "Health", keywords: ["health", "illness", "medical", "allergy", "medication"] },
  { key: "nutrition", label: "Nutrition", keywords: ["nutrition", "diet", "food", "eating", "meal"] },
  { key: "chores", label: "Chores", keywords: ["chore", "housework", "cleaning", "laundry"] },
  { key: "allowance", label: "Allowance", keywords: ["allowance", "pocket money"] },
  { key: "financial_literacy", label: "Financial literacy", keywords: ["financial literacy", "saving", "invest", "money lesson"] },
  { key: "school_choice", label: "School choice", keywords: ["school choice", "public school", "private school", "homeschool", "charter"] },
  { key: "activities", label: "Activities", keywords: ["activity", "sport", "extracurricular", "hobby", "lesson"] },
  { key: "sibling_relationships", label: "Sibling relationships", keywords: ["sibling", "brother", "sister"] },
  { key: "marriage_and_partnership", label: "Marriage and partnership", keywords: ["marriage", "partnership", "relationship", "date night", "spouse"] },
  { key: "conflict_repair", label: "Conflict repair", keywords: ["conflict", "repair", "apology", "argument", "fight"] },
  { key: "grandparents", label: "Grandparents", keywords: ["grandparent", "grandma", "grandpa", "grandmother", "grandfather"] },
  { key: "pets", label: "Pets", keywords: ["pet ", " pets", "dog", "cat", "lulu", "puppy", "our pet"] },
  { key: "travel", label: "Travel", keywords: ["travel", "trip", "vacation", "flight"] },
  { key: "emergencies", label: "Emergencies", keywords: ["emergency", "crisis", "911", "disaster"] },
  { key: "disability_and_special_needs", label: "Disability and special needs", keywords: ["disability", "special needs", "iep", "neurodiverg"] },
  { key: "privacy", label: "Privacy", keywords: ["privacy", "private", "personal information"] },
  { key: "social_media", label: "Social media", keywords: ["social media", "instagram", "facebook", "tiktok", "posting"] },
  { key: "body_autonomy", label: "Body autonomy", keywords: ["body autonomy", "consent", "bodily", "touch"] },
  { key: "puberty", label: "Puberty", keywords: ["puberty", "adolescence", "period", "sex education"] },
  { key: "substance_use", label: "Substance use", keywords: ["alcohol", "drug", "substance", "smoking", "vape"] },
  { key: "driving", label: "Driving", keywords: ["driving", "driver", "car keys", "license"] },
  { key: "college", label: "College", keywords: ["college", "university", "529", "tuition"] },
  { key: "adulthood_transition", label: "Adulthood transition", keywords: ["adult child", "launch", "independence", "moving out"] },
];

/**
 * Safer topic matching: require word-boundary style matches for short/ambiguous
 * keywords so "will", "care", "support", and "family" do not over-classify.
 */
const AMBIGUOUS = new Set([
  "will",
  "care",
  "support",
  "family",
  "home",
  "plan",
  "work",
]);

function keywordMatches(text: string, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  if (!text.includes(kw)) return false;
  if (kw.includes(" ") || kw.length >= 6) return true;
  if (AMBIGUOUS.has(kw)) {
    const re = new RegExp(`(?:^|[^a-z])${kw}(?:[^a-z]|$)`);
    return re.test(text);
  }
  return true;
}

export function matchTopics(haystack: string): string[] {
  const text = haystack.toLowerCase();
  return DISCUSSION_TOPICS.filter((topic) =>
    topic.keywords.some((kw) => keywordMatches(text, kw)),
  ).map((t) => t.key);
}

/** Primary topic = first match; secondary capped at 3. */
export function classifyTopics(haystack: string): {
  primary_topic: string | null;
  secondary_topics: string[];
} {
  const all = matchTopics(haystack);
  return {
    primary_topic: all[0] ?? null,
    secondary_topics: all.slice(1, 4),
  };
}
