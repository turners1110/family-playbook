/**
 * Before-birth top-50 discussion-mode review (read-only).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";

import { readStore } from "@/lib/db/store";
import {
  essentialsShowSeparateEditors,
  resolveEffectiveDiscussionMode,
} from "@/lib/discussions/discussion-mode";
import { ESSENTIALS_SCREENS } from "@/lib/essentials/pathway";

async function main() {
  const store = await readStore();
  const byId = new Map(store.questions.map((q) => [q.id, q]));
  const answered = new Map<string, number>();
  for (const a of store.answers ?? []) {
    answered.set(a.question_id, (answered.get(a.question_id) || 0) + 1);
  }

  const essentials = ESSENTIALS_SCREENS.filter((s) => s.is_primary).map(
    (screen, idx) => {
      const q = byId.get(screen.question_id)!;
      const resolved = resolveEffectiveDiscussionMode({
        discussion_mode: q?.discussion_mode ?? null,
        separate_answers_recommended: q?.separate_answers_recommended,
        question: q,
      });
      return {
        rank: idx + 1,
        source: "essentials" as const,
        screenId: screen.id,
        slug: q?.slug,
        title: screen.title,
        resolved,
        sep_rec: q?.separate_answers_recommended,
        categories: q?.categories,
        answerRows: answered.get(screen.question_id) || 0,
        showSeparateUI: q
          ? essentialsShowSeparateEditors(screen, q)
          : null,
      };
    },
  );

  const essentialIds = new Set(essentials.map((e) => e.slug));
  const more = store.questions
    .filter(
      (q) =>
        (q.required_before_birth || q.babymoon_priority) &&
        !essentialIds.has(q.slug),
    )
    .sort(
      (a, b) =>
        Number(b.babymoon_priority) - Number(a.babymoon_priority) ||
        a.logical_order - b.logical_order,
    )
    .slice(0, Math.max(0, 50 - essentials.length))
    .map((q, i) => {
      const resolved = resolveEffectiveDiscussionMode({
        discussion_mode: q.discussion_mode ?? null,
        separate_answers_recommended: q.separate_answers_recommended,
        question: q,
      });
      return {
        rank: essentials.length + i + 1,
        source: "before_birth_library" as const,
        screenId: null as string | null,
        slug: q.slug,
        title: q.short_title,
        resolved,
        sep_rec: q.separate_answers_recommended,
        categories: q.categories,
        answerRows: answered.get(q.id) || 0,
        showSeparateUI: resolved === "separate_first",
      };
    });

  const top50 = [...essentials, ...more].slice(0, 50);

  function recommend(r: (typeof top50)[number]): string {
    if (r.resolved === "shared_first") return "Keep SHARED_FIRST";
    if (r.resolved === "either") {
      return "Default Together — either is fine, but shared should lead for Essentials";
    }
    const title = r.title;
    const cats = r.categories ?? [];
    if (
      /childhood|fear|love language|attachment style|personal|my own|your own/i.test(
        title,
      )
    ) {
      return "Keep SEPARATE_FIRST — genuine personal reflection";
    }
    if (
      cats.some((c) =>
        ["parent_partnership", "conflict_between_parents"].includes(c),
      )
    ) {
      return "Change to SHARED_FIRST — partnership planning meeting";
    }
    if (
      cats.some((c) =>
        ["core_values", "attachment", "emotional_development"].includes(c),
      )
    ) {
      return "Consider SHARED_FIRST unless truly private — before-birth planning first";
    }
    return "Change to SHARED_FIRST — before-birth logistics/planning";
  }

  const review = top50
    .filter((t) => t.resolved !== "shared_first")
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      resolved: r.resolved,
      source: r.source,
      screenId: r.screenId,
      categories: r.categories,
      recommendation: recommend(r),
    }));

  console.log(
    JSON.stringify(
      {
        top50_summary: {
          total: top50.length,
          shared_first: top50.filter((t) => t.resolved === "shared_first")
            .length,
          separate_first: top50.filter((t) => t.resolved === "separate_first")
            .length,
          either: top50.filter((t) => t.resolved === "either").length,
          showSeparateUI: top50.filter((t) => t.showSeparateUI).length,
        },
        review_candidates: review,
        change_to_shared_first: review.filter((r) =>
          r.recommendation.startsWith("Change") ||
          r.recommendation.startsWith("Consider") ||
          r.recommendation.startsWith("Default"),
        ),
        keep_separate: review.filter((r) =>
          r.recommendation.startsWith("Keep SEPARATE"),
        ),
        top50,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
