# Supabase RLS audit

Generated from `lib/security/rls-catalog.ts`. Working migrations are authoritative.

## Totals

| Metric | Count |
|---|---|
| Public tables | 46 |
| Migrations | 12 (`0001`–`0012`) |
| RLS enabled before 0012 | 44 |
| RLS enabled after 0012 | 46 |
| Missing RLS before | outcome_development_maps, question_options |
| Missing RLS after | none |

## Categories

| Category | Count | Meaning |
|---|---|---|
| family_scoped | 34 | `user_family_ids()` / parent family_id |
| global_reference_readonly | 8 | Authenticated read; no user mutations |
| service_role_only | 4 | Grants revoked from anon/authenticated |
| intentionally_public | 0 | None — product is private |

## Target findings

**`question_options` and `outcome_development_maps`:** the audit finding is **valid**.

They are created in `0001_init.sql` next to `questions` / `outcomes`, which received `ENABLE ROW LEVEL SECURITY` and `FOR SELECT TO authenticated`. These two tables did not. With default PostgREST grants, an authenticated (or possibly anon) client could mutate global reference rows.

Fix: `supabase/migrations/0012_secure_reference_tables.sql`.

Desired access after 0012:

- authenticated: SELECT
- authenticated: INSERT/UPDATE/DELETE denied (no policy + REVOKE)
- anon: deny
- service_role: full (seed/admin)

## All tables

| table | created | RLS before | RLS after | category | mismatch before | mismatch after |
|---|---|---|---|---|---|---|
| `families` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `profiles` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `family_members` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `children` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `life_stages` | 0001_init.sql | yes | yes | global_reference_readonly | no | no |
| `categories` | 0001_init.sql | yes | yes | global_reference_readonly | no | no |
| `outcome_domains` | 0001_init.sql | yes | yes | global_reference_readonly | no | no |
| `outcomes` | 0001_init.sql | yes | yes | global_reference_readonly | no | no |
| `outcome_development_maps` | 0001_init.sql | **no** | yes | global_reference_readonly | yes | no |
| `principles` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `questions` | 0001_init.sql | yes | yes | global_reference_readonly | no | no |
| `question_options` | 0001_init.sql | **no** | yes | global_reference_readonly | yes | no |
| `answers` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `answer_versions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `decisions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `decision_versions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `sessions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `session_questions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `knowledge_items` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `cooling_off_items` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `reviews` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `bookmarks` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `activity_log` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `family_settings` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `ai_outputs` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `playbook_versions` | 0001_init.sql | yes | yes | family_scoped | no | no |
| `family_json_stores` | 0003_remote_json_store.sql | yes | yes | service_role_only | no | no |
| `family_json_store_versions` | 0003_remote_json_store.sql | yes | yes | service_role_only | no | no |
| `research_sources` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_files` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_topics` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_life_stages` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_summaries` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_findings` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_links` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_notes` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_processing_jobs` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `research_source_conflicts` | 0004_research_library.sql | yes | yes | family_scoped | no | no |
| `family_json_store_mutations` | 0006_remote_store_mutations.sql | yes | yes | service_role_only | no | no |
| `research_recommended_sources` | 0007_seed_recommended_library.sql | yes | yes | global_reference_readonly | no | no |
| `research_recommended_family_state` | 0007_seed_recommended_library.sql | yes | yes | family_scoped | no | no |
| `research_external_sources` | 0008_public_book_research.sql | yes | yes | family_scoped | no | no |
| `research_public_overviews` | 0008_public_book_research.sql | yes | yes | family_scoped | no | no |
| `research_coverage_comparisons` | 0008_public_book_research.sql | yes | yes | family_scoped | no | no |
| `research_source_documents` | 0009_epub_documents.sql | yes | yes | family_scoped | no | no |
| `research_source_chapters` | 0009_epub_documents.sql | yes | yes | service_role_only | no | no |

## Reference content mutability

Canonical global content (`questions`, `question_options`, `categories`, `outcomes`, `outcome_development_maps`, `life_stages`, `outcome_domains`, recommended catalog) is **not** writable by family users.

Family customizations belong in family-scoped rows or the remote JSON AppStore (`family_json_stores`, service-role only).

## Applying 0012

**DATABASE MIGRATION APPLIED: yes** (live Supabase, 2026-08-19).

Sam verified in SQL Editor: both tables have RLS on; authenticated SELECT only; anon none; service_role full.

Live PostgREST tests (`RUN_LIVE_RLS_TESTS=true`): anon mutations and SELECT denied; authenticated SELECT allowed and mutations denied; service_role write-then-delete probe succeeded and cleaned up.

The prior unauthenticated INSERT gap is closed.
