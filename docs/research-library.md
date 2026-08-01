# Research & Books

Private evidence library for Turner Family Principles.

Sources inform discussion. They do **not** overwrite Sam and Michelle’s answers or become family decisions.

## Phase 1 (shipped)

- `/research` library with tabs, filters, list + bookshelf views
- Add source (`/research/new`) — metadata, physical book, URL, excerpts, private upload
- Availability labels: full text / partial text / notes only / metadata only
- Detail page with overview, summaries, notes, links, file metadata
- Manual summaries + Sam / Michelle / shared notes
- Link sources to questions
- Relevant Research near the top of question detail
- Processing queue + coverage stubs
- Local private metadata store + local file directory (not remote JSON)

## Migrations

Apply after remote-store migration:

1. `supabase/migrations/0004_research_library.sql`
2. `supabase/migrations/0005_research_storage_policies.sql`

In Supabase Dashboard → SQL Editor, run both files, or use the Supabase CLI.

### Storage bucket setup

Migration `0005` creates private bucket `research-sources` (50 MiB limit).

Allowed MIME types: PDF, EPUB, TXT, DOCX.

Confirm in Dashboard → Storage:

- Bucket is **private** (`public = false`)
- Policies restrict objects to the member’s family folder `{family_id}/...`
- Service role is used only on the server (Trip Mode / admin paths)

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Environment

No new required env vars for Phase 1 local store.

For Trip Mode + future Supabase-backed research:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | existing |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | server only; signed uploads/downloads later |
| `TURNER_FAMILY_NAME` | family UUID resolution for Trip Mode |

Optional later: `USE_SUPABASE_RESEARCH_STORE=true` when wiring the normalized tables as the primary backend.

## Local Phase 1 storage

Until Supabase research backend is enabled:

- Metadata: `data/research-library.json` (gitignored)
- Files: `data/research-files/` (gitignored)
- **Not** written into `family_json_stores` / remote JSON

## File limits

- Max size: **50 MiB**
- Allowed: `.pdf`, `.epub`, `.txt`, `.docx`, `.doc`
- Rejected: executables and scripts

Uploading requires the rights checkbox.

## Trip Online Mode

- Emergency users can **read** the research library
- Only Sam or Michelle actors can **add / edit / archive**
- Files and extracted text stay out of the remote JSON store

## Later phases

**Phase 2:** Supabase table backend as primary, Storage signed URLs, extraction pipeline, AI summaries/findings with review workflow, processing jobs progress.

**Phase 3:** Conflict detection, richer coverage, PDF viewer with citation jumps, playbook bibliography from approved findings only.
