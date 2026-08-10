import Link from "next/link";
import type { EvidenceSynthesis } from "@/lib/research/synthesis";
import type { GroundedFinding } from "@/lib/research/evidence-model";

/**
 * Decision workspace evidence block.
 * Keeps family position separate from source-derived evidence.
 */
export function DecisionEvidencePanel({
  synthesis,
  findings,
  familyPosition,
  mismatchSummary,
}: {
  synthesis: EvidenceSynthesis;
  findings: GroundedFinding[];
  familyPosition: string;
  mismatchSummary?: string | null;
}) {
  return (
    <section className="surface mb-5 space-y-4 p-5">
      <div>
        <h3 className="font-display text-xl">Our current position</h3>
        <p className="mt-2 whitespace-pre-wrap text-ink">
          {familyPosition.trim() || "No shared family position recorded yet."}
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-display text-xl">What evidence says</h3>
        {!synthesis.has_grounded_evidence ? (
          <p className="mt-2 text-sm text-ink-muted">
            No grounded research findings are linked to this Decision yet.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">
              Evidence picture:{" "}
              <span className="font-medium text-ink">
                {synthesis.evidence_picture_label}
              </span>{" "}
              · {synthesis.picture_reason}
            </p>
            {synthesis.key_takeaway ? (
              <p className="mt-2 text-sm text-ink">{synthesis.key_takeaway}</p>
            ) : null}
            {synthesis.areas_of_disagreement.length > 0 ? (
              <div className="mt-3 rounded-xl border border-border px-3 py-2">
                <p className="text-sm font-medium">Sources differ</p>
                <ul className="mt-1 space-y-1 text-sm text-ink-muted">
                  {synthesis.areas_of_disagreement.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="mt-3 space-y-2">
              {findings.slice(0, 5).map((f) => (
                <li key={f.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                  <p>{f.finding_text}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    <Link href={`/research/${f.source_id}`} className="hover:text-accent">
                      {f.source_title}
                    </Link>
                    {f.chapter ? ` · ${f.chapter}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {mismatchSummary ? (
        <div className="rounded-xl border border-border bg-bg-elevated/40 px-3 py-3 text-sm">
          <p className="font-medium text-ink">Potential mismatch</p>
          <p className="mt-1 text-ink-muted">{mismatchSummary}</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Evidence never auto-rewrites your family decision.
          </p>
        </div>
      ) : null}
    </section>
  );
}
