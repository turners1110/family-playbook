/**
 * Generate docs/prebirth-priority-v2.json for essential-before-birth questions.
 *
 *   pnpm exec tsx scripts/generate-prebirth-priority-v2.ts
 */
import { writeFileSync } from "fs";
import path from "path";
import questionsSeed from "../data/seed/questions.json";
import { classifyResearchValue } from "../lib/research/research-value";
import {
  classifyPrebirthBucket,
  PREBIRTH_BUCKET_LABELS,
} from "../lib/research/prebirth-priority";

type Q = (typeof questionsSeed)[number];

function main() {
  const essential = (questionsSeed as Q[]).filter(
    (q) => q.priority === "essential_before_birth" || q.required_before_birth,
  );

  const rows = essential.map((q) => {
    const value = classifyResearchValue({
      id: q.id,
      title: q.short_title,
      text: q.text,
      categories: q.categories,
      evidence_needed: q.evidence_needed,
      research_mode: q.research_mode,
      priority: q.priority,
    });
    const bucket = classifyPrebirthBucket({
      title: q.short_title,
      text: q.text,
      priority: q.priority,
      required_before_birth: q.required_before_birth,
      babymoon_priority: q.babymoon_priority,
      research_value: value.class,
      estimated_minutes: q.estimated_minutes,
      life_stages: q.life_stages,
    });
    return {
      question_id: q.id,
      slug: q.slug,
      title: q.short_title,
      current_priority: q.priority,
      recommended_bucket: bucket.bucket,
      recommended_bucket_label: PREBIRTH_BUCKET_LABELS[bucket.bucket],
      why: bucket.why,
      ideal_pregnancy_window: bucket.ideal_window,
      estimated_minutes: q.estimated_minutes,
      research_value: value.class,
      research_value_reason: value.reason,
      provider_relevance:
        q.research_mode === "professional_guidance_needed" ||
        q.research_mode === "strongly_recommended",
      prerequisite: q.parent_decision_dependency,
      decision_hint: q.categories[0] ?? null,
      required_before_birth: q.required_before_birth,
      babymoon_priority: q.babymoon_priority,
    };
  });

  const buckets: Record<string, number> = {};
  for (const r of rows) {
    buckets[r.recommended_bucket] = (buckets[r.recommended_bucket] || 0) + 1;
  }

  const top10 = [...rows]
    .filter(
      (r) =>
        r.recommended_bucket === "must_decide_before_birth" ||
        r.research_value === "CRITICAL" ||
        r.research_value === "HIGH",
    )
    .sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, NONE: 4 };
      const bucketRank = {
        must_decide_before_birth: 0,
        worth_discussing_before_birth: 1,
        good_if_time: 2,
        later: 3,
      };
      return (
        rank[a.research_value as keyof typeof rank] -
          rank[b.research_value as keyof typeof rank] ||
        bucketRank[a.recommended_bucket as keyof typeof bucketRank] -
          bucketRank[b.recommended_bucket as keyof typeof bucketRank] ||
        a.estimated_minutes - b.estimated_minutes
      );
    })
    .slice(0, 10);

  const doc = {
    generated_at: new Date().toISOString(),
    note: "Recommendations only — does not demote live priorities automatically.",
    total_essential_or_required: rows.length,
    bucket_distribution: buckets,
    recommended_current_top_10: top10.map((r) => ({
      id: r.question_id,
      title: r.title,
      minutes: r.estimated_minutes,
      research_value: r.research_value,
      why: r.why,
    })),
    questions: rows,
  };

  writeFileSync(
    path.join(process.cwd(), "docs/prebirth-priority-v2.json"),
    JSON.stringify(doc, null, 2),
  );
  console.log(
    JSON.stringify(
      { total: rows.length, buckets, top10: top10.map((t) => t.title) },
      null,
      2,
    ),
  );
}

main();
