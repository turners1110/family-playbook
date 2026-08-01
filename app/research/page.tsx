import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ResearchSourceCardView } from "@/components/research/ResearchSourceCard";
import {
  getResearchStorageStatus,
  listResearchSources,
} from "@/lib/research/services";
import { requireFamilyContext } from "@/lib/auth/family-context";
import {
  RESEARCH_EVIDENCE_RATINGS,
  RESEARCH_PROCESSING_STATUSES,
  RESEARCH_SOURCE_TYPES,
  RESEARCH_SOURCE_TYPE_LABELS,
  RESEARCH_TOPIC_KEYS,
  RESEARCH_TOPIC_LABELS,
} from "@/lib/research/types";
import { LIFE_STAGE_LABELS, LIFE_STAGES } from "@/lib/constants/enums";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "library", label: "Library", href: "/research" },
  { key: "books", label: "Books", href: "/research?tab=books" },
  { key: "papers", label: "Research Papers", href: "/research?tab=papers" },
  { key: "guidelines", label: "Guidelines", href: "/research?tab=guidelines" },
  { key: "articles", label: "Articles", href: "/research?tab=articles" },
  { key: "queue", label: "Processing Queue", href: "/research/processing" },
  { key: "topics", label: "Topics", href: "/research?tab=topics" },
  { key: "coverage", label: "Source Coverage", href: "/research/coverage" },
] as const;

export default async function ResearchLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireFamilyContext();
  const params = await searchParams;
  const tab = params.tab ?? "library";
  const view = params.view === "shelf" ? "shelf" : "list";
  const storage = getResearchStorageStatus();
  const sources = await listResearchSources(
    {
      q: params.q,
      sourceType: params.type,
      processingStatus: params.status,
      topic: params.topic,
      lifeStage: params.life_stage,
      evidenceRating: params.evidence,
      linkedQuestions: params.linked_q === "1",
      linkedPrinciples: params.linked_p === "1",
      addedBy: params.added_by as "sam" | "michelle" | undefined,
      sort: params.sort,
      tab: tab === "library" || tab === "topics" ? undefined : tab,
    },
    ctx,
  );

  function href(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    Object.entries(merged).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    const qs = next.toString();
    return qs ? `/research?${qs}` : "/research";
  }

  return (
    <AppShell
      title="Research & Books"
      subtitle="Private evidence library — sources inform discussion; they are not family decisions."
      actions={
        storage.writesAllowed ? (
          <Link href="/research/new" className="btn btn-primary">
            Add source
          </Link>
        ) : null
      }
    >
      <p
        className={`mb-4 text-sm ${
          storage.mode === "unavailable" ? "text-warning" : "text-ink-subtle"
        }`}
      >
        {storage.label}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`badge ${tab === item.key || (item.key === "library" && !params.tab) ? "badge-accent" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "topics" ? (
        <section className="surface p-5">
          <h2 className="font-display text-xl">Topics</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RESEARCH_TOPIC_KEYS.map((topic) => {
              const count = sources.filter((s) => s.topics.includes(topic)).length;
              return (
                <Link
                  key={topic}
                  href={href({ tab: "library", topic })}
                  className="rounded-xl border border-border px-3 py-2 text-sm hover:border-accent"
                >
                  {RESEARCH_TOPIC_LABELS[topic]}
                  <span className="ml-2 text-ink-subtle">{count}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <form className="surface mb-5 grid gap-3 p-4 md:grid-cols-4">
            <input
              className="input md:col-span-2"
              name="q"
              defaultValue={params.q}
              placeholder="Search titles, authors, topics"
              aria-label="Search research"
            />
            <select name="type" className="select" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {RESEARCH_SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RESEARCH_SOURCE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <select name="status" className="select" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {RESEARCH_PROCESSING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select name="topic" className="select" defaultValue={params.topic ?? ""}>
              <option value="">All topics</option>
              {RESEARCH_TOPIC_KEYS.map((topic) => (
                <option key={topic} value={topic}>
                  {RESEARCH_TOPIC_LABELS[topic]}
                </option>
              ))}
            </select>
            <select name="life_stage" className="select" defaultValue={params.life_stage ?? ""}>
              <option value="">All life stages</option>
              {LIFE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {LIFE_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            <select name="evidence" className="select" defaultValue={params.evidence ?? ""}>
              <option value="">Any evidence rating</option>
              {RESEARCH_EVIDENCE_RATINGS.map((rating) => (
                <option key={rating} value={rating}>
                  {rating.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select name="sort" className="select" defaultValue={params.sort ?? "recent"}>
              <option value="recent">Recently added</option>
              <option value="processed">Recently processed</option>
              <option value="author">Author</option>
              <option value="year">Publication year</option>
              <option value="linked">Most linked</option>
              <option value="evidence">Highest evidence rating</option>
              <option value="title">Title</option>
            </select>
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="view" value={view} />
            <button type="submit" className="btn btn-secondary">
              Apply filters
            </button>
          </form>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link
              href={href({ view: "list" })}
              className={`badge ${view === "list" ? "badge-accent" : ""}`}
            >
              List
            </Link>
            <Link
              href={href({ view: "shelf" })}
              className={`badge ${view === "shelf" ? "badge-accent" : ""}`}
            >
              Bookshelf
            </Link>
            <Link href={href({ linked_q: "1" })} className="badge">
              Linked to questions
            </Link>
            <Link href={href({ linked_p: "1" })} className="badge">
              Linked to principles
            </Link>
            <Link href={href({ added_by: "sam" })} className="badge">
              Added by Sam
            </Link>
            <Link href={href({ added_by: "michelle" })} className="badge">
              Added by Michelle
            </Link>
          </div>

          {sources.length === 0 ? (
            <div className="surface p-8 text-center">
              <p className="text-ink-muted">No sources yet.</p>
              <Link href="/research/new" className="btn btn-primary mt-4">
                Add source
              </Link>
            </div>
          ) : view === "shelf" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sources.map((source) => (
                <ResearchSourceCardView key={source.id} source={source} layout="shelf" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <ResearchSourceCardView key={source.id} source={source} />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
