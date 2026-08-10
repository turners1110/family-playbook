/**
 * Audit existing research books/sources (Pass A foundation).
 *
 *   USE_REMOTE_JSON_STORE=true pnpm exec tsx scripts/audit-research-books.ts
 */
import { writeFileSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
process.env.USE_REMOTE_JSON_STORE = "true";
process.env.USE_LOCAL_STORE = "false";

async function main() {
  const { listResearchSources, getResearchSource } = await import(
    "../lib/research/services"
  );

  let sources: Array<{ id: string }> = [];
  try {
    const listed = await listResearchSources({});
    sources = ((listed as { sources?: Array<{ id: string }> }).sources ??
      (Array.isArray(listed) ? listed : [])) as Array<{ id: string }>;
  } catch (error) {
    writeFileSync(
      path.join(process.cwd(), "docs/research-v2-books-audit.json"),
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          error: String(error),
          books: [],
        },
        null,
        2,
      ),
    );
    console.error(error);
    return;
  }

  const books = [];
  for (const s of sources) {
    try {
      const detail = await getResearchSource(s.id);
      const source = (detail as { source?: Record<string, unknown> }).source ?? detail;
      const preliminary =
        (detail as { preliminaryFindings?: unknown[] }).preliminaryFindings ?? [];
      const coverage = (detail as { coverage?: Record<string, unknown> }).coverage;
      books.push({
        id: (source as { id?: string }).id ?? s.id,
        title: (source as { title?: string }).title ?? null,
        author: (source as { author?: string }).author ?? null,
        source_type: (source as { source_type?: string }).source_type ?? null,
        processing_status:
          (source as { processing_status?: string }).processing_status ?? null,
        availability_type:
          (source as { availability_type?: string }).availability_type ?? null,
        findings_generated: Array.isArray(preliminary) ? preliminary.length : 0,
        chapters_detected: coverage?.chapters_detected ?? coverage?.chapters_processed ?? null,
        readable_text_extracted: coverage?.readable_text_extracted ?? null,
        drm_protected: coverage?.drm_protected ?? null,
        full_book_processed: coverage?.full_book_processed ?? null,
        question_links:
          (detail as { links?: Array<{ question_id?: string | null }> }).links?.filter(
            (l) => l.question_id,
          ).length ?? 0,
        note: "Uploaded ≠ processed. Findings only counted when present.",
      });
    } catch (error) {
      books.push({
        id: s.id,
        error: String(error),
      });
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    source_count: sources.length,
    book_like_count: books.filter(
      (b) =>
        "source_type" in b &&
        (b.source_type === "book" || b.source_type === "uploaded_document"),
    ).length,
    books,
  };

  writeFileSync(
    path.join(process.cwd(), "docs/research-v2-books-audit.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        sources: report.source_count,
        books: report.book_like_count,
        with_findings: books.filter(
          (b) => "findings_generated" in b && (b.findings_generated as number) > 0,
        ).length,
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
