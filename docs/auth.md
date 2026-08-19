# Authentication and family identity (Phase 1)

## Overview

Identity comes from Supabase Auth (magic link). Shared product data lives in the
remote JSON AppStore (`family_json_stores`, service-role only) when
`USE_REMOTE_JSON_STORE=true`. Local filesystem storage is development-only and is
rejected on Vercel.

## Required environment variables

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Preferred public key (newer Supabase projects) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Legacy public key fallback; used only if publishable key is unset |
| `SUPABASE_SERVICE_ROLE_KEY` | setup + Trip Mode remote JSON | Never ship to browser or ordinary app request paths |
| `NEXT_PUBLIC_APP_URL` | Magic-link fallback origin | **Local:** `http://localhost:3000`. **Production:** canonical domain. **Preview:** prefer the branch’s stable `*.vercel.app` URL (see below). Never set localhost on Vercel. |
| `NEXT_PUBLIC_VERCEL_URL` | Auto on Vercel | Used as fallback when `NEXT_PUBLIC_APP_URL` is unset |
| `TURNER_SAM_EMAIL` | setup script | Not committed with real values |
| `TURNER_MICHELLE_EMAIL` | setup script | Not committed with real values |
| `TURNER_FAMILY_NAME` | setup script | Optional, default `Turner Family` |
| `EMERGENCY_ACCESS_MODE` | Trip Mode | Server-only; must be exactly `true` to enable `/access` |
| `EMERGENCY_ACCESS_CODE` | Trip Mode | Server-only shared code; never `NEXT_PUBLIC_` |
| `EMERGENCY_COOKIE_SECRET` | Trip Mode | Server-only HMAC secret for signed cookies |
| `USE_REMOTE_JSON_STORE` | Store facade | Server-only; `true` selects remote JSONB bridge |

Public key resolution order:

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Magic-link redirect origin (`trip-online-mode`)

### Bug this fixes

If Preview env `NEXT_PUBLIC_APP_URL` still points at another branch (for example
`family-playbook-git-supabase-auth-…vercel.app`), magic-link emails send users to
the wrong deployment.

### Runtime resolution (browser)

`lib/auth/app-url.ts` resolves `emailRedirectTo` in this order outside development:

1. **Current page origin** (`window.location.origin`) — always the deployment you are on
2. `NEXT_PUBLIC_APP_URL` (if set and not localhost)
3. `NEXT_PUBLIC_VERCEL_URL` (Vercel auto host)

Development always stays on localhost.

Console logs hosts only (`pageHost`, `configuredAppUrlHost`, `redirectHost`, `mismatch`) — never secrets.

### Exact Vercel settings for `trip-online-mode`

1. Open Vercel → Project → Settings → Environment Variables.
2. For **Preview** (or branch override for `trip-online-mode`), set:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://family-playbook-git-trip-online-mode-turners1110s-projects.vercel.app` |

Use the **stable branch Preview URL** for `trip-online-mode` (Vercel → Deployments → that branch → Domains). Do **not** reuse the `supabase-auth` branch URL.

3. Production should use the canonical production domain, not a git-branch Preview URL.
4. Local `.env.local` only: `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
5. Redeploy `trip-online-mode` after changing Preview env vars (`NEXT_PUBLIC_*` are baked in at build time).

### Exact Supabase Auth URL settings

Supabase Dashboard → Authentication → URL Configuration:

| Setting | Value |
|---|---|
| Site URL | Production canonical origin (not localhost) |
| Redirect URLs | Include all of the below |

Redirect allow list (add each line):

```text
http://localhost:3000/auth/callback
https://family-playbook-git-trip-online-mode-turners1110s-projects.vercel.app/auth/callback
https://*-turners1110s-projects.vercel.app/auth/callback
https://<your-production-domain>/auth/callback
```

The wildcard Preview entry covers other branch deployments. The explicit
`trip-online-mode` entry is the stable host for Trip Mode testing.

## Migrations

1. `0001_init.sql` — schema + RLS
2. `0002_auth_and_identity.sql` — profile trigger, profile RLS, backfill
3. `0003_remote_json_store.sql` — Trip Online Mode remote JSON bridge (service-role only)
4. `0004_research_library.sql` / `0005_research_storage_policies.sql` — Research & Books
5. `0006`–`0011` — remote mutations, recommended library, public-book research, EPUB, Before Baby columns
6. `0012_secure_reference_tables.sql` — RLS on `question_options` and `outcome_development_maps`

## Trip Online Mode

When `EMERGENCY_ACCESS_MODE=true`, `/access` accepts a shared code and sets a signed HttpOnly cookie. Protected product routes accept **either** a valid Supabase session **or** a valid emergency cookie. Supabase Auth identity always overrides the temporary Sam/Michelle actor selector. See `docs/trip-online-mode.md`.

## Key modules

| Module | Role |
|---|---|
| `proxy.ts` | Session refresh + coarse route redirects |
| `lib/auth/family-context.ts` | `requireFamilyContext()` — authoritative identity |
| `lib/auth/actions.ts` | Logout + authenticated action helper |
| `lib/auth/app-url.ts` | Magic-link origin resolution + host diagnostics |
| `lib/supabase/browser-env.ts` | Browser public key/URL (static `process.env` reads) |
| `lib/supabase/env.ts` | Server public key/URL resolution (publishable → anon) |
| `lib/auth/local-bridge.ts` | Maps auth email → local store actor for Phase 1 product data |
| `scripts/setup-family.ts` | Idempotent family linking (admin) |

## Security rules

- Ordinary pages/actions use the user-scoped server client only
- Admin/service-role client is restricted to setup/seed scripts and Trip Mode remote store
- Browser must never supply `family_id` / `member_id` as trust anchors
- Fake identity switching is disabled

## Error states

Login query `?error=` codes map to safe copy in `lib/auth/errors.ts`:

- `config`, `unauthenticated`, `expired`, `no_profile`, `no_membership`, `no_family`, `no_settings`, `callback_failed`
