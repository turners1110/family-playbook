"use client";

import Link from "next/link";
import type { EvidenceSynthesis } from "@/lib/research/synthesis";
import type { GroundedFinding } from "@/lib/research/evidence-model";
import type { ResearchValueClass } from "@/lib/research/research-value";

/**
 * Compact research panel — informs, does not decide.
 * Never shows fabricated evidence.
 */
export function ResearchGuidancePanel({
  synthesis,
  findings,
  researchValue,
  evidenceNeeded,
  questionSlug,
}: {
  synthesis: EvidenceSynthesis;
  findings: GroundedFinding[];
  researchValue?: ResearchValueClass;
  evidenceNeeded?: boolean;
  questionSlug?: string;
}) {
  const showEmptyHelp =
    !synthesis.has_grounded_evidence &&
    (evidenceNeeded ||
      researchValue === "CRITICAL" ||
      researchValue === "HIGH" ||
      researchValue === "MODERATE");

  // Values questions: hide empty research chrome entirely
  if (
    !synthesis.has_grounded_evidence &&
    (researchValue === "NONE" || researchValue === "LOW") &&
    !evidenceNeeded
  ) {
    return null;
  }

  if (!synthesis.has_grounded_evidence) {
    if (!showEmptyHelp) return null;
    return (
      <section className="surface mb-5 p-5">
        <h3 className="font-display text-xl">Research & guidance</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Research would help here. Evidence informs your conversation — it does
          not decide for you.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/research" className="btn btn-secondary">
            Search library
          </Link>
          <Link href="/research/new" className="btn btn-ghost">
            Add source
          </Link>
          {questionSlug ? (
            <Link href={`/research?queue=${questionSlug}`} className="btn btn-ghost">
              Add to research queue
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  const topFindings = findings.slice(0, 4);
  const sources = [...new Map(findings.map((f) => [f.source_id, f])).values()].slice(
    0,
    3,
  );

  return (
    <section className="surface mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl">Research & guidance</h3>
        <Link href="/research" className="btn btn-ghost">
          View evidence
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {synthesis.finding_count} finding{synthesis.finding_count === 1 ? "" : "s"} ·{" "}
        {synthesis.source_count} source{synthesis.source_count === 1 ? "" : "s"} ·
        Evidence picture:{" "}
        <span className="font-medium text-ink">{synthesis.evidence_picture_label}</span>
      </p>
      <p className="mt-1 text-xs text-ink-subtle">{synthesis.picture_reason}</p>

      {synthesis.key_takeaway ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Key takeaway
          </p>
          <p className="mt-1 text-sm text-ink">{synthesis.key_takeaway}</p>
        </div>
      ) : null}

      {synthesis.key_considerations.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Key considerations
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            {synthesis.key_considerations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {synthesis.areas_of_disagreement.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border px-3 py-2">
          <p className="text-sm font-medium text-ink">Evidence is mixed</p>
          <ul className="mt-1 space-y-1 text-sm text-ink-muted">
            {synthesis.areas_of_disagreement.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Sources
        </p>
        <ul className="mt-2 space-y-2">
          {sources.map((f) => (
            <li key={f.source_id} className="rounded-xl border border-border px-3 py-2 text-sm">
              <Link href={`/research/${f.source_id}`} className="font-medium hover:text-accent">
                {f.source_title}
              </Link>
              {f.location || f.chapter ? (
                <p className="text-xs text-ink-subtle">
                  {[f.chapter, f.location].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {topFindings.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-ink-muted">
            Findings ({topFindings.length})
          </summary>
          <ul className="mt-2 space-y-2 text-sm">
            {topFindings.map((f) => (
              <li key={f.id} className="rounded-xl border border-border px-3 py-2">
                <p className="text-ink">{f.finding_text}</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {f.source_title}
                  {f.relationship ? ` · ${f.relationship.replace(/_/g, " ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs text-ink-subtle sm:grid-cols-2">
        <p>
          <span className="font-medium text-ink">What evidence says</span> — grounded
          sources only.
        </p>
        <p>
          <span className="font-medium text-ink">What you decide</span> — recorded below
          as your family position.
        </p>
      </div>
    </section>
  );
}
