/**
 * Aggregate grounded findings for a Decision hub from linked questions.
 * Uses existing research links — does not invent evidence.
 */
import type { AppStore } from "@/lib/types/models";
import { getResearchForQuestion } from "@/lib/research/services";
import { groundedFindingsFromLinks } from "@/lib/research/ground-findings";
import {
  detectFamilyEvidenceMismatch,
  synthesizeEvidence,
  type EvidenceSynthesis,
} from "@/lib/research/synthesis";
import type { GroundedFinding } from "@/lib/research/evidence-model";
import type { FamilyContext } from "@/lib/auth/family-context";

export async function buildDecisionEvidence(input: {
  store: AppStore;
  questionIds: string[];
  familyPosition: string;
  ctx?: FamilyContext;
}): Promise<{
  findings: GroundedFinding[];
  synthesis: EvidenceSynthesis;
  mismatchSummary: string | null;
}> {
  const findings: GroundedFinding[] = [];
  const seen = new Set<string>();

  for (const qid of input.questionIds.slice(0, 20)) {
    const rows = await getResearchForQuestion(qid, input.ctx);
    for (const f of groundedFindingsFromLinks(rows, qid)) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      findings.push(f);
    }
  }

  const synthesis = synthesizeEvidence(findings);
  const mismatch = detectFamilyEvidenceMismatch({
    familyPosition: input.familyPosition,
    findings,
  });

  return {
    findings,
    synthesis,
    mismatchSummary: mismatch.summary,
  };
}
