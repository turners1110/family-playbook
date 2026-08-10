/**
 * Research & Knowledge V2 — coverage audit for the 181 high-priority cohort.
 *
 *   pnpm exec tsx scripts/research-v2-audit.ts
 */
import { writeFileSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import cohortFile from "../docs/high-priority-question-cohort.json";
import questionsSeed from "../data/seed/questions.json";
import { ESSENTIALS_SCREENS } from "../lib/essentials/pathway";
import { BABYMOON_ROUNDS, resolveConversationPrompt } from "../lib/conversations/babymoon-set";
import { classifyResearchValue } from "../lib/research/research-value";

type CohortQ = (typeof cohortFile.questions)[number];
type SeedQ = (typeof questionsSeed)[number];

function main() {
  const byId = new Map((questionsSeed as SeedQ[]).map((q) => [q.id, q]));
  const essentialsIds = new Set(ESSENTIALS_SCREENS.map((s) => s.question_id));
  const babymoonFollowUps = new Set<string>();
  for (const round of BABYMOON_ROUNDS) {
    for (const pid of round.prompt_ids) {
      const p = resolveConversationPrompt(pid);
      if (p?.follow_up_open_question_id) {
        babymoonFollowUps.add(p.follow_up_open_question_id);
      }
    }
  }

  const rows = (cohortFile.questions as CohortQ[]).map((c) => {
    const q = byId.get(c.id);
    const value = classifyResearchValue({
      id: c.id,
      title: c.title,
      text: c.full_prompt || q?.text || "",
      categories: q?.categories ?? c.categories ?? [],
      topic: c.topic,
      evidence_needed: Boolean(q?.evidence_needed ?? c.research_links?.evidence_needed),
      research_mode: String(q?.research_mode ?? c.research_links?.research_mode ?? ""),
      priority: String(q?.priority ?? ""),
    });

    return {
      question_id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category ?? q?.categories?.[0] ?? null,
      categories: q?.categories ?? c.categories ?? [],
      topics: [c.topic].filter(Boolean),
      life_stages: q?.life_stages ?? c.life_stages ?? [],
      priority: q?.priority ?? null,
      estimated_minutes: q?.estimated_minutes ?? c.current_estimated_minutes,
      discussion_mode: q?.discussion_mode ?? c.current_discussion_mode,
      response_format:
        (q?.response_schema as { mode?: string } | undefined)?.mode ??
        c.proposed_response_type ??
        null,
      essentials: Boolean(
        c.essentials_link ||
          essentialsIds.has(c.id) ||
          [...essentialsIds].some((id) => c.id.startsWith(id) || id.startsWith(c.id)),
      ),
      babymoon: Boolean(
        c.babymoon_link ||
          babymoonFollowUps.has(c.id) ||
          [...babymoonFollowUps].some((id) => c.id.startsWith(id) || id.startsWith(c.id)),
      ),
      decision_hubs: c.decision_topic_links ?? [],
      existing_research_links: [],
      existing_book_links: [],
      evidence_summary: q?.evidence_summary ?? c.research_links?.evidence_summary ?? null,
      practical_tip: q?.practical_tip ?? null,
      evidence_needed: Boolean(q?.evidence_needed ?? c.research_links?.evidence_needed),
      evidence_available: Boolean(q?.evidence_available),
      research_mode: q?.research_mode ?? c.research_links?.research_mode ?? null,
      provider_relevance:
        q?.research_mode === "professional_guidance_needed" ||
        String(q?.research_mode).includes("professional"),
      research_value: value.class,
      research_value_reason: value.reason,
      evidence_gap_state:
        value.class === "NONE" || value.class === "LOW"
          ? "unnecessary"
          : q?.evidence_summary || q?.evidence_available
            ? "partial"
            : "missing",
    };
  });

  const byClass: Record<string, number> = {};
  const byGap: Record<string, number> = {};
  for (const r of rows) {
    byClass[r.research_value] = (byClass[r.research_value] || 0) + 1;
    byGap[r.evidence_gap_state] = (byGap[r.evidence_gap_state] || 0) + 1;
  }

  const totals = {
    total_questions_in_bank: (questionsSeed as SeedQ[]).length,
    cohort_size: rows.length,
    essential_before_birth_in_bank: (questionsSeed as SeedQ[]).filter(
      (q) => q.priority === "essential_before_birth" || q.required_before_birth,
    ).length,
    evidence_summary_populated: (questionsSeed as SeedQ[]).filter((q) =>
      Boolean(q.evidence_summary),
    ).length,
    practical_tip_populated: (questionsSeed as SeedQ[]).filter((q) =>
      Boolean(q.practical_tip),
    ).length,
    evidence_needed_true: (questionsSeed as SeedQ[]).filter((q) => q.evidence_needed)
      .length,
    evidence_available_true: (questionsSeed as SeedQ[]).filter((q) => q.evidence_available)
      .length,
    research_value_distribution: byClass,
    evidence_gap_distribution: byGap,
    critical_or_high_missing: rows.filter(
      (r) =>
        (r.research_value === "CRITICAL" || r.research_value === "HIGH") &&
        r.evidence_gap_state === "missing",
    ).length,
  };

  const audit = {
    generated_at: new Date().toISOString(),
    git_head: "c7a9b20",
    invariant: "No fabricated evidence. Classifications are heuristic for prioritization only.",
    totals,
    questions: rows,
  };

  writeFileSync(
    path.join(process.cwd(), "docs/research-v2-audit.json"),
    JSON.stringify(audit, null, 2),
  );

  const md = `# Research & Knowledge V2 — Coverage Audit

Generated: ${audit.generated_at}
Base HEAD: ${audit.git_head}

## Verified bank totals

| Metric | Count |
|---|---|
| Total questions | ${totals.total_questions_in_bank} |
| High-priority cohort | ${totals.cohort_size} |
| Essential / required before birth | ${totals.essential_before_birth_in_bank} |
| evidence_summary populated | ${totals.evidence_summary_populated} |
| practical_tip populated | ${totals.practical_tip_populated} |
| evidence_needed = true | ${totals.evidence_needed_true} |
| evidence_available = true | ${totals.evidence_available_true} |

## Research value (181 cohort)

| Class | Count |
|---|---|
${Object.entries(byClass)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Evidence gap state (cohort)

| State | Count |
|---|---|
${Object.entries(byGap)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

**Critical/high value questions still missing evidence:** ${totals.critical_or_high_missing}

## Hard invariant

Do not display research that is not grounded in a source.
Values/reflection questions (NONE/LOW) should not get fake evidence panels.

## Machine-readable detail

See \`docs/research-v2-audit.json\` for per-question rows.
`;

  writeFileSync(path.join(process.cwd(), "docs/research-v2-audit.md"), md);
  console.log(JSON.stringify(totals, null, 2));
}

main();
