# Authentication and family identity (Phase 1)

## Overview

Identity comes from Supabase Auth (magic link). Product discussion data still
reads/writes `data/local-store.json` until later migration phases.

## Required environment variables

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Preferred public key (newer Supabase projects) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Legacy public key fallback; used only if publishable key is unset |
| `SUPABASE_SERVICE_ROLE_KEY` | `pnpm setup:family` only | Never ship to browser or ordinary app request paths |
| `NEXT_PUBLIC_APP_URL` | Magic-link `emailRedirectTo` origin | Required on Vercel Preview/Production (deployed URL). Local only: `http://localhost:3000`. Never set localhost in Preview/Production. |
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

Browser code (`lib/supabase/browser-env.ts`, `lib/supabase/client.ts`) reads these via **static** `process.env.NEXT_PUBLIC_*` property access so Next.js can inline them into the client bundle. Server code uses `lib/supabase/env.ts`. Do not share an injectable `env` helper with client components.

Server logs distinguish missing URL, missing public key, and invalid `NEXT_PUBLIC_APP_URL`. The browser always shows a generic configuration message.

## Migrations

1. `0001_init.sql` — schema + RLS
2. `0002_auth_and_identity.sql` — profile trigger, profile RLS, backfill
3. `0003_remote_json_store.sql` — Trip Online Mode remote JSON bridge (service-role only)

## Trip Online Mode

When `EMERGENCY_ACCESS_MODE=true`, `/access` accepts a shared code and sets a signed HttpOnly cookie. Protected product routes accept **either** a valid Supabase session **or** a valid emergency cookie. Supabase Auth identity always overrides the temporary Sam/Michelle actor selector. See `docs/trip-online-mode.md`.

## Key modules

| Module | Role |
|---|---|
| `proxy.ts` | Session refresh + coarse route redirects |
| `lib/auth/family-context.ts` | `requireFamilyContext()` — authoritative identity |
| `lib/auth/actions.ts` | Logout + authenticated action helper |
| `lib/supabase/browser-env.ts` | Browser public key/URL (static `process.env` reads) |
| `lib/supabase/env.ts` | Server public key/URL resolution (publishable → anon) |
| `lib/auth/local-bridge.ts` | Maps auth email → local store actor for Phase 1 product data |
| `scripts/setup-family.ts` | Idempotent family linking (admin) |

## Security rules

- Ordinary pages/actions use the user-scoped server client only
- Admin/service-role client is restricted to setup/seed scripts
- Browser must never supply `family_id` / `member_id` as trust anchors
- Fake identity switching is disabled

## Error states

Login query `?error=` codes map to safe copy in `lib/auth/errors.ts`:

- `config`, `unauthenticated`, `expired`, `no_profile`, `no_membership`, `no_family`, `no_settings`, `callback_failed`
