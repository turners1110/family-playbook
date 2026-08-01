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

Public key resolution order (see `lib/supabase/env.ts`):

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server logs distinguish missing URL, missing public key, and invalid `NEXT_PUBLIC_APP_URL`. The browser always shows a generic configuration message.

## Migrations

1. `0001_init.sql` — schema + RLS
2. `0002_auth_and_identity.sql` — profile trigger, profile RLS, backfill

## Key modules

| Module | Role |
|---|---|
| `proxy.ts` | Session refresh + coarse route redirects |
| `lib/auth/family-context.ts` | `requireFamilyContext()` — authoritative identity |
| `lib/auth/actions.ts` | Logout + authenticated action helper |
| `lib/supabase/env.ts` | Shared public key/URL resolution (publishable → anon) |
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
