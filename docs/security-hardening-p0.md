# Security hardening P0 (2026-08-19)

Working branch: `trip-online-mode`. Treat migrations and code as authoritative over older audits.

## Pre-change report

| Item | Value |
|---|---|
| HEAD before | `4c7086cd6f1b1e2fd74b135a1e0179b9f092b078` |
| Storage provider | `USE_REMOTE_JSON_STORE=true` → remote JSONB (`family_json_stores`). Local file only when the flag is not `true` **and** not on Vercel. |
| Auth flow | Magic link → `/auth/callback` → `exchangeCodeForSession` → `requireFamilyContext()` → remote family AppStore |
| Family storage path | Service-role RPC/table `family_json_stores` keyed by Turner family id from `resolveTurnerFamilyId()` |
| Public tables | 46 |
| Tables with RLS in SQL after 0012 | 46 (44 before) |
| Migrations | 12 files (`0001`–`0012`) |
| Tests | see suite result in the closeout report |

## RLS finding

**Valid, not stale.** `question_options` and `outcome_development_maps` were created in `0001_init.sql` without `ENABLE ROW LEVEL SECURITY`. Sibling tables (`questions`, `outcomes`, …) already had authenticated SELECT-only policies.

**Live probe (anon/publishable key, 2026-08-19):**

- SELECT both tables: succeeded
- INSERT `question_options`: succeeded (probe row deleted immediately via service role)
- INSERT `outcome_development_maps`: failed with FK `23503` (not RLS)

Relational seed tables are nearly empty (`questions` = 1, options/maps = 0). Canonical questions live in the JSON AppStore. The gap is still real: PostgREST allowed unauthenticated writes to reference tables.

## Migration

File: `supabase/migrations/0012_secure_reference_tables.sql`

- Enable RLS
- SELECT policy for `authenticated` only
- REVOKE ALL from `public` / `anon` / `authenticated`, GRANT SELECT to `authenticated`, GRANT ALL to `service_role`
- Sibling reference tables: revoke INSERT/UPDATE/DELETE from anon/authenticated (defense in depth)
- No data rewrite or deletion

**DATABASE MIGRATION APPLIED: yes** (live Supabase, 2026-08-19; Sam verified in SQL Editor).

Idempotent: `DROP POLICY IF EXISTS` then recreate.

Live PostgREST (`RUN_LIVE_RLS_TESTS=true`, 12 passed): anon INSERT/UPDATE/DELETE/SELECT denied; authenticated SELECT allowed; authenticated INSERT/UPDATE/DELETE denied; service_role write-then-delete probe succeeded and was cleaned up.

**RLS issue closed.**

## Auth

**AUTH STATUS: HEALTHY** (product context: multiple successful sessions on phones; existing callback/PKCE tests pass).

Historical `bad_code_verifier` was **not reproduced** on this branch. Deeper PKCE instrumentation was **not** added (already present, hashes only).

Redirect: current page origin wins on Preview (`lib/auth/app-url.ts`). Do not hardwire a branch Preview URL into production logic.

## Remote storage

`assertDeployedRemoteStore()` throws if `VERCEL=1` and `USE_REMOTE_JSON_STORE !== "true"`.

`USE_REMOTE_JSON_STORE` is stable; no rename to `STORAGE_PROVIDER` in this pass.

## Env resolution

`lib/supabase/env.ts` (injectable, server) vs `lib/supabase/browser-env.ts` (static `process.env` for Next inlining). Duplication is intentional. **No functional bug found. No refactor in this pass.**

## Privacy

Existing tests: `filterAnswersForClient`, discussion-mode, research-v2 synthesis exclusion, question-experience-v2 structured payload redaction.

## Error spot-audit

| Area | Finding | Class |
|---|---|---|
| Conversations start | Catch sets UI error; does not treat as success | acceptable |
| Remote store | Throws `RemoteStoreError`; no silent local fallback on Vercel | acceptable |
| Auth callback | Maps to `callback_failed`; no secret logging | acceptable |
| Answers/checklist/research | Failures throw or return `{ok:false}` in the paths checked | no P0 swallow |
| Generic logging without UI | Some server logs only | P2 deferred |
| Retry loops | None found as infinite | — |

P0 error-handling bugs found: **none**.

## Reference mutability

Family users must not mutate canonical global seed tables. Custom content belongs in family-scoped rows or the JSON AppStore. Seed/sync uses service role.

## Deferred

- Broad coverage expansion
- Canonical env resolver merge
- Generic error-logging platform
- `STORAGE_PROVIDER=supabase` rename
- Research V2 / question content / nav redesign

## Highest-risk untested runtime flows (future)

1. Live authenticated PostgREST writes after 0012 — **closed** (temporary Auth user in live tests)
2. Cross-family authenticated session against Turner JSON (needs a second Auth user)
3. Magic-link on Production canonical host vs Preview (manual)
4. Research signed-URL expiry + outsider download in production
5. Emergency Trip Mode cookie + Auth session precedence under clock skew

## Release

**RLS issue closed.** `0012` is applied live. Authenticated family users can read reference tables and cannot mutate them via PostgREST. Remaining items are deferred (env merge, coverage expansion, Research V2).
