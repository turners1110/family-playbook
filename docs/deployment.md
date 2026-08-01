# Deployment

## Recommended

- **App:** Vercel
- **Database / Auth:** Supabase

## Steps

1. Create Supabase project
2. Run migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_auth_and_identity.sql`
   - `supabase/migrations/0003_remote_json_store.sql` (Trip Online Mode)
3. Configure Auth URL settings (see `docs/auth.md` for the exact list):
   - Site URL = production app URL (not localhost)
   - Redirect allow list includes:
     - `http://localhost:3000/auth/callback` (local only)
     - `https://family-playbook-git-trip-online-mode-turners1110s-projects.vercel.app/auth/callback`
     - `https://*-turners1110s-projects.vercel.app/auth/callback` (other Preview branches)
     - `https://<production-domain>/auth/callback`
4. Create Auth users for Sam and Michelle (Dashboard or invite)
5. Set Vercel / host env vars from `.env.example`
   - **Preview / `trip-online-mode`:** set `NEXT_PUBLIC_APP_URL` to the **trip-online-mode** stable Preview origin (`https://family-playbook-git-trip-online-mode-turners1110s-projects.vercel.app`). Do not leave it pointing at `supabase-auth` or another branch.
   - **Production:** canonical domain.
   - **Local:** `http://localhost:3000` only in `.env.local`.
   - Browser magic links prefer `window.location.origin`, so a stale Preview env var no longer redirects to the wrong branch — still fix the env var and redeploy.
   - For Trip Online Mode also set server-only: `EMERGENCY_ACCESS_MODE`, `EMERGENCY_ACCESS_CODE`, `EMERGENCY_COOKIE_SECRET`, `USE_REMOTE_JSON_STORE` (see `docs/trip-online-mode.md`)
6. Run locally once (or in CI with secrets): `pnpm setup:family`
7. For Trip Mode: `pnpm upload:remote-store` then redeploy
8. Deploy the Next.js app
9. Verify:
   - Logged-out `/home` → `/login` (or `/access` when Trip Mode is on)
   - Console shows matching `pageHost` / `redirectHost` for the current Preview
   - Magic link completes to `/auth/callback` on the **same** Preview host
   - Trip Mode: `/access` → actor → `/home`, answer persists after redeploy
   - Sign out works
   - Second Auth user without membership sees `no_membership` guidance

## Local production build

```bash
pnpm generate:questions
pnpm seed
pnpm build
pnpm start
```

## Notes

- Prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `NEXT_PUBLIC_SUPABASE_ANON_KEY` is a legacy fallback
- `SUPABASE_SERVICE_ROLE_KEY` is for setup/seed **and** Trip Mode remote JSON (server only)
- Phase 1 still uses JSON store for product discussion data (`local` or Trip Mode `remote`)
- Do not enable public signup for production; create invited users only
- Never commit `EMERGENCY_ACCESS_CODE`, `EMERGENCY_COOKIE_SECRET`, or personal answer backups
