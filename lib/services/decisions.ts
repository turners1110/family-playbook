import { readStore, updateStore, nowIso, id } from "@/lib/db/local-store";
import type { Decision, DecisionVersion } from "@/lib/types/models";
import { saveDecisionSchema, type SaveDecisionInput } from "@/lib/validation/schemas";

export async function listDecisions(filters?: {
  status?: string;
  lowConfidence?: boolean;
  disagreement?: boolean;
}) {
  const store = await readStore();
  let list = [...store.decisions];
  if (filters?.status) list = list.filter((d) => d.status === filters.status);
  if (filters?.lowConfidence) {
    list = list.filter((d) => d.confidence !== null && d.confidence <= 2);
  }
  if (filters?.disagreement) list = list.filter((d) => d.has_disagreement);
  return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getDecision(decisionIdOrSlug: string) {
  const store = await readStore();
  const { normalizeDecision, slugifyDecisionTitle } = await import(
    "@/lib/knowledge/family-decisions"
  );
  const decision =
    store.decisions.find((d) => d.id === decisionIdOrSlug) ??
    store.decisions.find(
      (d) =>
        (d.slug ?? slugifyDecisionTitle(d.title)) === decisionIdOrSlug,
    );
  if (!decision) return null;
  const normalized = normalizeDecision(decision);
  const versions = store.decision_versions
    .filter((v) => v.decision_id === decision.id)
    .sort((a, b) => a.version - b.version);
  return { decision: normalized, versions };
}

export async function saveDecision(input: SaveDecisionInput, actorId?: string) {
  const data = saveDecisionSchema.parse(input);
  const timestamp = nowIso();

  return updateStore((store) => {
    const changedBy = actorId ?? store.current_user_id;
    if (data.id) {
      const existing = store.decisions.find((d) => d.id === data.id);
      if (!existing) throw new Error("Decision not found");
      const nextVersion = existing.version + 1;
      Object.assign(existing, {
        title: data.title,
        statement: data.statement,
        problem: data.problem ?? null,
        reasoning: data.reasoning ?? null,
        sam_perspective: data.sam_perspective ?? null,
        michelle_perspective: data.michelle_perspective ?? null,
        shared_conclusion: data.shared_conclusion ?? null,
        agreement_notes: data.agreement_notes ?? null,
        disagreement_notes: data.disagreement_notes ?? null,
        status: data.status,
        confidence: data.confidence,
        decision_type: data.decision_type,
        evidence_strength: data.evidence_strength ?? existing.evidence_strength,
        emotional_weight: data.emotional_weight ?? existing.emotional_weight,
        reversibility: data.reversibility ?? existing.reversibility,
        child_dependent: data.child_dependent ?? existing.child_dependent,
        life_stages: data.life_stages ?? existing.life_stages,
        categories: data.categories ?? existing.categories,
        research_notes: data.research_notes ?? null,
        implementation_notes: data.implementation_notes ?? null,
        exceptions: data.exceptions ?? null,
        risks: data.risks ?? null,
        warning_signs: data.warning_signs ?? null,
        reconsideration_conditions: data.reconsideration_conditions ?? null,
        review_date: data.review_date ?? null,
        has_disagreement: data.has_disagreement ?? existing.has_disagreement,
        source_question_ids: data.source_question_ids ?? existing.source_question_ids,
        outcome_ids: data.outcome_ids ?? existing.outcome_ids,
        principle_ids: data.principle_ids ?? existing.principle_ids,
        version: nextVersion,
        updated_at: timestamp,
      });
      const version: DecisionVersion = {
        id: id("dv"),
        decision_id: existing.id,
        version: nextVersion,
        snapshot: { ...existing },
        changed_by: changedBy,
        change_reason: data.change_reason ?? "Updated decision",
        created_at: timestamp,
      };
      store.decision_versions.push(version);
      return store;
    }

    const decision: Decision = {
      id: id("decision"),
      family_id: store.family.id,
      title: data.title,
      statement: data.statement,
      problem: data.problem ?? null,
      reasoning: data.reasoning ?? null,
      sam_perspective: data.sam_perspective ?? null,
      michelle_perspective: data.michelle_perspective ?? null,
      shared_conclusion: data.shared_conclusion ?? null,
      agreement_notes: data.agreement_notes ?? null,
      disagreement_notes: data.disagreement_notes ?? null,
      status: data.status,
      confidence: data.confidence,
      decision_type: data.decision_type,
      evidence_strength: data.evidence_strength ?? "unknown",
      emotional_weight: data.emotional_weight ?? 3,
      reversibility: data.reversibility ?? null,
      child_dependent: data.child_dependent ?? false,
      life_stages: data.life_stages ?? [],
      categories: data.categories ?? [],
      research_notes: data.research_notes ?? null,
      implementation_notes: data.implementation_notes ?? null,
      exceptions: data.exceptions ?? null,
      risks: data.risks ?? null,
      warning_signs: data.warning_signs ?? null,
      reconsideration_conditions: data.reconsideration_conditions ?? null,
      review_date: data.review_date ?? null,
      has_disagreement: data.has_disagreement ?? false,
      version: 1,
      source_question_ids: data.source_question_ids ?? [],
      outcome_ids: data.outcome_ids ?? [],
      principle_ids: data.principle_ids ?? [],
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.decisions.unshift(decision);
    store.decision_versions.push({
      id: id("dv"),
      decision_id: decision.id,
      version: 1,
      snapshot: { ...decision },
      changed_by: changedBy,
      change_reason: data.change_reason ?? "Created decision",
      created_at: timestamp,
    });
    return store;
  });
}
