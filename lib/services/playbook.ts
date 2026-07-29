import { readStore, nowIso, id, updateStore } from "@/lib/db/local-store";
import { PLAYBOOK_SECTIONS, BABYMOON_WEIGHT_CATEGORIES } from "@/lib/constants/enums";
import type { PlaybookSection, PlaybookVersion } from "@/lib/types/models";

const SECTION_CATEGORY_MAP: Record<string, string[]> = {
  "family-constitution": ["family_identity", "family_mission", "core_values"],
  "parenting-goals": ["desired_adult_outcomes", "core_values"],
  "skills-and-traits": ["desired_adult_outcomes"],
  "how-we-decide": ["parent_partnership", "conflict_between_parents"],
  "pregnancy-and-birth": ["pregnancy", "birth"],
  "newborn-stage": ["newborn_care", "postpartum_recovery"],
  "infancy": ["newborn_care", "attachment", "sleep", "feeding"],
  "toddler-years": ["discipline", "tantrums", "independence"],
  "early-childhood": ["learning", "play", "preschool", "emotional_development"],
  "health-and-safety": ["health", "safety", "medical_decisions"],
  sleep: ["sleep"],
  "feeding-and-nutrition": ["feeding", "nutrition", "breastfeeding", "food_culture"],
  "emotional-development": ["emotional_development", "attachment"],
  "discipline-and-boundaries": ["discipline", "boundaries"],
  "learning-and-education": ["learning", "education", "school_choice", "reading"],
  technology: ["technology", "screens"],
  "money-and-financial-skills": ["family_finances", "allowance", "chores"],
  "family-relationships": ["extended_family", "grandparents", "parent_partnership"],
  "traditions-and-culture": ["traditions", "culture", "faith", "holidays"],
};

export async function buildPlaybookPreview(includePerspectiveHistory = false) {
  const store = await readStore();
  const decided = store.decisions.filter((d) =>
    ["decided", "tentatively_decided", "review_scheduled"].includes(d.status),
  );
  const unresolved = store.decisions.filter((d) =>
    ["undecided", "needs_research", "cooling_off", "in_discussion", "not_started"].includes(
      d.status,
    ),
  );
  const unansweredEssential = store.questions.filter(
    (q) =>
      (q.required_before_birth || q.babymoon_priority) &&
      !store.answers.some((a) => a.question_id === q.id),
  );

  const sections: PlaybookSection[] = PLAYBOOK_SECTIONS.map((section) => {
    if (section.slug === "open-questions") {
      const lines = [
        ...unresolved.map((d) => `- ${d.title}: ${d.status}`),
        ...unansweredEssential.slice(0, 12).map((q) => `- Open: ${q.short_title}`),
      ];
      return {
        slug: section.slug,
        title: section.title,
        content: lines.length ? lines.join("\n") : "No open questions right now.",
        decision_ids: unresolved.map((d) => d.id),
        outcome_ids: [],
        unresolved_ids: unresolved.map((d) => d.id),
        coverage: lines.length ? "moderate" : "strong",
        ai_placeholder: true,
      };
    }

    if (section.slug === "decisions-to-review") {
      const review = store.decisions.filter(
        (d) => d.review_date || d.status === "review_scheduled",
      );
      return {
        slug: section.slug,
        title: section.title,
        content: review.length
          ? review.map((d) => `- ${d.title} (review ${d.review_date ?? "scheduled"})`).join("\n")
          : "No reviews scheduled.",
        decision_ids: review.map((d) => d.id),
        outcome_ids: [],
        unresolved_ids: [],
        coverage: review.length ? "moderate" : "empty",
        ai_placeholder: true,
      };
    }

    if (section.slug === "research-notes") {
      const knowledge = store.knowledge_items;
      return {
        slug: section.slug,
        title: section.title,
        content: knowledge
          .map(
            (k) =>
              `- ${k.title} [${k.evidence_quality}]${k.is_sample ? " (sample)" : ""}\n  ${k.summary}`,
          )
          .join("\n\n"),
        decision_ids: [],
        outcome_ids: [],
        unresolved_ids: [],
        coverage: knowledge.length ? "moderate" : "empty",
        ai_placeholder: true,
      };
    }

    if (section.slug === "decision-history") {
      const history = store.decision_versions
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20);
      return {
        slug: section.slug,
        title: section.title,
        content: history.length
          ? history
              .map((h) => `- v${h.version} on ${h.created_at.slice(0, 10)}: ${h.change_reason}`)
              .join("\n")
          : "No decision history yet.",
        decision_ids: [],
        outcome_ids: [],
        unresolved_ids: [],
        coverage: history.length ? "moderate" : "empty",
        ai_placeholder: false,
      };
    }

    if (section.slug === "skills-and-traits") {
      const topOutcomes = store.outcomes.slice(0, 20);
      const linked = new Set(decided.flatMap((d) => d.outcome_ids));
      return {
        slug: section.slug,
        title: section.title,
        content: topOutcomes
          .map((o) => `- ${o.label}${linked.has(o.id) ? " (linked to decisions)" : ""}`)
          .join("\n"),
        decision_ids: [],
        outcome_ids: topOutcomes.map((o) => o.id),
        unresolved_ids: [],
        coverage: linked.size > 5 ? "strong" : linked.size > 0 ? "moderate" : "weak",
        ai_placeholder: true,
      };
    }

    const cats = SECTION_CATEGORY_MAP[section.slug] ?? [];
    const matched = decided.filter(
      (d) =>
        d.categories.some((c) => cats.includes(c)) ||
        (section.slug === "family-constitution" && d.principle_ids.length > 0),
    );

    const principles =
      section.slug === "family-constitution"
        ? store.principles.map((p) => `### ${p.title}\n${p.statement}`).join("\n\n")
        : "";

    const body = matched
      .map((d) => {
        const parts = [
          `### ${d.title}`,
          `**Decision:** ${d.statement}`,
          d.reasoning ? `**Why:** ${d.reasoning}` : null,
          `**Status:** ${d.status} · Confidence: ${d.confidence ?? "Not rated"}`,
          d.evidence_strength ? `**Evidence:** ${d.evidence_strength}` : null,
        ];
        if (includePerspectiveHistory) {
          parts.push(
            d.sam_perspective ? `**Sam:** ${d.sam_perspective}` : null,
            d.michelle_perspective ? `**Michelle:** ${d.michelle_perspective}` : null,
          );
        } else if (d.has_disagreement) {
          parts.push("_Disagreement details omitted by default._");
        }
        return parts.filter(Boolean).join("\n");
      })
      .join("\n\n");

    const content = [principles, body].filter(Boolean).join("\n\n") ||
      `_No decisions linked yet. Future AI generation can draft this section from related answers._`;

    return {
      slug: section.slug,
      title: section.title,
      content,
      decision_ids: matched.map((d) => d.id),
      outcome_ids: [...new Set(matched.flatMap((d) => d.outcome_ids))],
      unresolved_ids: unresolved
        .filter((d) => d.categories.some((c) => cats.includes(c)))
        .map((d) => d.id),
      coverage: matched.length >= 3 ? "strong" : matched.length ? "moderate" : "weak",
      ai_placeholder: true,
    };
  });

  const answered = new Set(store.answers.map((a) => a.question_id));
  const early = store.questions.filter(
    (q) =>
      q.babymoon_priority ||
      q.required_before_birth ||
      q.categories.some((c) => (BABYMOON_WEIGHT_CATEGORIES as readonly string[]).includes(c)),
  );
  const earlyAnswered = early.filter((q) => answered.has(q.id)).length;
  const completion = early.length ? Math.round((earlyAnswered / early.length) * 100) : 0;

  const weak = sections.filter((s) => s.coverage === "weak" || s.coverage === "empty");

  const playbook: PlaybookVersion = {
    id: id("playbook"),
    family_id: store.family.id,
    version_date: nowIso(),
    completion_status: completion,
    include_perspective_history: includePerspectiveHistory,
    sections,
    created_at: nowIso(),
  };

  return { playbook, weakCoverage: weak.map((s) => s.title) };
}

export async function savePlaybookSnapshot(includePerspectiveHistory = false) {
  const { playbook } = await buildPlaybookPreview(includePerspectiveHistory);
  await updateStore((store) => {
    store.playbook_versions.unshift(playbook);
    return store;
  });
  return playbook;
}

export function playbookToMarkdown(playbook: PlaybookVersion) {
  const lines = [
    `# Turner Family Principles — Parenting Playbook`,
    ``,
    `Version date: ${playbook.version_date.slice(0, 10)}`,
    `Completion (babymoon-weighted): ${playbook.completion_status}%`,
    `Perspective history included: ${playbook.include_perspective_history ? "yes" : "no"}`,
    ``,
  ];
  for (const section of playbook.sections) {
    lines.push(`## ${section.title}`);
    lines.push(`_Coverage: ${section.coverage}_`);
    lines.push(``);
    lines.push(section.content);
    lines.push(``);
  }
  return lines.join("\n");
}

export function playbookToHtml(playbook: PlaybookVersion) {
  const md = playbookToMarkdown(playbook);
  const body = md
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^_Coverage: (.*)_$/gm, "<p class='coverage'>Coverage: $1</p>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Turner Family Playbook</title>
  <style>
    body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1c1917;background:#f5f5f4}
    h1,h2,h3{font-weight:600} .coverage{color:#57534e;font-size:.9rem}
    li{margin-left:1.2rem}
  </style></head><body>${body}</body></html>`;
}
