# Research & Books

Private evidence library for Turner Family Principles.

Sources inform discussion. They do **not** overwrite Sam and Michelle’s answers or become family decisions.

## Phase 1.5 (durable storage)

Production / Preview / Trip Mode use **Supabase**:

- Metadata: `research_sources` (+ notes, summaries, links, topics, life stages)
- Files: private Storage bucket `research-sources`
- Local JSON/files are **development-only** behind `USE_LOCAL_RESEARCH_STORE=true`
- Never falls back to the Vercel filesystem

UI status on `/research`:

- `Research storage: Supabase`
- or `Research storage unavailable. New research entries are disabled.`

## Migrations to run

Apply after remote-store migration:

1. `supabase/migrations/0004_research_library.sql`
2. `supabase/migrations/0005_research_storage_policies.sql`
3. `supabase/migrations/0007_seed_recommended_library.sql` (Recommended Library catalog + family prefs)
4. `supabase/migrations/0008_public_book_research.sql` (public-source overviews, external sources, coverage)

### Public-source book research

When a **book** is added (manual or from Recommended Library), the app automatically queues public research:

1. Gather lawful public sources (publisher, author, reviews, related guidance)
2. Generate a **public-source overview** (not a full-book summary)
3. Extract **preliminary findings** and practical lessons
4. Mark everything **needs review**

Uploading an EPUB/PDF later creates separate source-grounded coverage and does **not** replace the public overview.

Public-source findings never enter the final family playbook until Sam or Michelle approve them.

Optional env (mock providers work without keys):

- `RESEARCH_WEB_PROVIDER` / `TAVILY_API_KEY`
- `RESEARCH_AI_PROVIDER` / `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `RESEARCH_PUBLIC_CONCURRENCY` (1–3)

### Bucket checks

In Supabase Dashboard → Storage → `research-sources`:

- Private (`public = false`)
- File size limit 50 MiB
- Allowed MIME: PDF, EPUB, TXT, DOCX
- Policies scoped to family folder `{family_id}/...`

## Environment

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required for Supabase research |
| `SUPABASE_SERVICE_ROLE_KEY` | server only; signed upload/download |
| `TURNER_FAMILY_NAME` | family UUID resolution for Trip Mode |
| `USE_LOCAL_RESEARCH_STORE=true` | local-dev only; ignored when `VERCEL=1` |

## Import local Phase 1 data

```bash
pnpm upload:research-library
```

Loads `data/research-library.json`, resolves Turner Family, imports idempotently by title+author, uploads local files when present, prints counts only.

## Uploads

1. Create source metadata (server action)
2. Request signed upload URL (server action)
3. Browser PUTs file to Supabase (or local `/api/research/upload` in local mode)
4. Finalize file row (server action)

No base64 through server actions. No public URLs. Downloads use short-lived signed URLs.

## Access

- Supabase Auth members via `requireFamilyContext`
- Trip Mode emergency actors resolve to Turner Family + Sam/Michelle
- Writes: Sam or Michelle only
- Browser never receives the service-role key

## Later phases

**Phase 2:** extraction pipeline, AI summaries/findings  
**Phase 3:** conflicts, PDF viewer, playbook bibliography
