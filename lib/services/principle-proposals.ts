import { id, nowIso, readStore, updateStore } from "@/lib/db/store";
import type { Decision } from "@/lib/types/models";
import {
  getProposedPrinciple,
  listProposedPrinciples,
  type PrincipleProposalFeedback,
} from "@/lib/knowledge/proposed-principles";

export async function listOpenPrincipleProposals() {
  const store = await readStore();
  return listProposedPrinciples(store);
}

function upsertFeedback(
  store: { principle_proposal_feedback?: PrincipleProposalFeedback[] },
  row: PrincipleProposalFeedback,
) {
  if (!store.principle_proposal_feedback) store.principle_proposal_feedback = [];
  const idx = store.principle_proposal_feedback.findIndex(
    (f) => f.topic_slug === row.topic_slug,
  );
  if (idx >= 0) store.principle_proposal_feedback[idx] = row;
  else store.principle_proposal_feedback.push(row);
}

export async function rejectPrincipleProposal(topicSlug: string) {
  return updateStore(
    (store) => {
      upsertFeedback(store, {
        topic_slug: topicSlug,
        status: "rejected",
        updated_at: nowIso(),
      });
      return store;
    },
    { operation: "rejectPrincipleProposal" },
  );
}

export async function deferPrincipleProposal(topicSlug: string) {
  return updateStore(
    (store) => {
      upsertFeedback(store, {
        topic_slug: topicSlug,
        status: "deferred",
        updated_at: nowIso(),
      });
      return store;
    },
    { operation: "deferPrincipleProposal" },
  );
}

export async function savePrincipleProposalEdit(
  topicSlug: string,
  statement: string,
) {
  return updateStore(
    (store) => {
      upsertFeedback(store, {
        topic_slug: topicSlug,
        status: "edited",
        statement: statement.trim(),
        updated_at: nowIso(),
      });
      return store;
    },
    { operation: "savePrincipleProposalEdit" },
  );
}

export async function acceptPrincipleProposal(input: {
  topicSlug: string;
  statement?: string;
}) {
  const store = await readStore();
  const proposal = getProposedPrinciple(store, input.topicSlug);
  if (!proposal) throw new Error("Proposal not found or no longer eligible.");
  if (!proposal.statement && !input.statement?.trim()) {
    throw new Error("This cluster is not ready to accept yet.");
  }

  const statement = (input.statement ?? proposal.statement ?? "").trim();
  const timestamp = nowIso();
  let decisionId = "";

  await updateStore(
    (draft) => {
      const decision: Decision = {
        id: id("decision"),
        family_id: draft.family.id,
        title: `Family principle: ${proposal.title}`,
        statement,
        problem: null,
        reasoning:
          "Accepted from a proposed principle synthesized from related answers.",
        sam_perspective: null,
        michelle_perspective: null,
        shared_conclusion: statement,
        agreement_notes: proposal.agreements.join("\n") || null,
        disagreement_notes: proposal.disagreements.join("\n") || null,
        status: proposal.disagreements.length ? "in_discussion" : "decided",
        confidence: proposal.confidence,
        decision_type: "philosophical",
        evidence_strength: "unknown",
        emotional_weight: 3,
        reversibility: "moderate",
        child_dependent: true,
        life_stages: [],
        categories: [proposal.topicSlug],
        research_notes: null,
        implementation_notes: null,
        exceptions: null,
        risks: null,
        warning_signs: null,
        reconsideration_conditions: null,
        review_date: null,
        has_disagreement: proposal.disagreements.length > 0,
        version: 1,
        source_question_ids: proposal.sourceAnswers.map((s) => s.questionId),
        outcome_ids: [],
        principle_ids: [],
        slug: `principle-${proposal.topicSlug}`,
        current_position: statement,
        created_at: timestamp,
        updated_at: timestamp,
      };
      decisionId = decision.id;
      draft.decisions.unshift(decision);
      draft.decision_versions.push({
        id: id("dv"),
        decision_id: decision.id,
        version: 1,
        snapshot: { ...decision },
        changed_by: draft.current_user_id,
        change_reason: "Accepted proposed family principle",
        created_at: timestamp,
      });
      upsertFeedback(draft, {
        topic_slug: proposal.topicSlug,
        status: "accepted",
        decision_id: decision.id,
        statement,
        updated_at: timestamp,
      });
      return draft;
    },
    { operation: "acceptPrincipleProposal" },
  );

  return { decisionId };
}
