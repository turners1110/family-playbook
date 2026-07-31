# Turner Family Principles

A private guided parenting decision system for Sam and Michelle Turner.

## Quick start

```bash
pnpm install
pnpm generate:questions
pnpm seed
```

### 1. Configure environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (setup/seed scripts only — never expose to the browser)
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
- `TURNER_SAM_EMAIL` / `TURNER_MICHELLE_EMAIL` (for `pnpm setup:family` only)

### 2. Apply migrations

In the Supabase SQL editor (or CLI), run in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_auth_and_identity.sql`

### 3. Supabase Auth dashboard settings

Authentication → URL configuration:

- Site URL: `http://localhost:3000` (local) or your production URL
- Redirect URLs allow list:
  - `http://localhost:3000/auth/callback`
  - `https://your-production-domain/auth/callback`

Enable Email provider / magic link (OTP).

### 4. Create Auth users

In Supabase Dashboard → Authentication → Users, create accounts for Sam and Michelle
(or invite them). Use the same emails you will put in `TURNER_SAM_EMAIL` and
`TURNER_MICHELLE_EMAIL`.

Do **not** commit those emails into source files.

### 5. Link the Turner Family

```bash
pnpm setup:family
```

This idempotently creates the family, parent memberships, and `family_settings`.

### 6. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000/login](http://localhost:3000/login), enter your email, and use the magic link.

## Phase 1 status

- Real Supabase magic-link authentication
- Protected routes via `proxy.ts` + server-side `requireFamilyContext()`
- Profiles created by DB trigger on `auth.users`
- Fake header identity switcher removed
- Product discussion data still uses `data/local-store.json` until later phases

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Next.js |
| `pnpm seed` | Seed local JSON product data |
| `pnpm setup:family` | Link Auth users to Turner Family (service role) |
| `pnpm generate:questions` | Generate ≥300 seed questions |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm typecheck` | TypeScript |

## Local login test checklist

1. Apply both migrations
2. Create two Auth users
3. Run `pnpm setup:family`
4. Visit `/home` logged out → redirected to `/login`
5. Request a magic link → check email
6. Complete callback → land on `/home`
7. Confirm header shows your name/email and Sign out
8. Confirm you cannot switch into the other parent’s identity
9. Sign out → protected routes redirect again

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Auth & identity (Phase 1)](docs/auth.md)
- [Seed question format](docs/seed-question-format.md)
- [AI interface](docs/ai-interface.md)
- [Roadmap](docs/roadmap.md)
