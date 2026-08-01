# Deployment

## Recommended

- **App:** Vercel
- **Database / Auth:** Supabase

## Steps

1. Create Supabase project
2. Run migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_auth_and_identity.sql`
3. Configure Auth URL settings:
   - Site URL = production app URL (not localhost)
   - Redirect allow list includes:
     - `https://<production-domain>/auth/callback`
     - `https://*-<team>.vercel.app/auth/callback` (Preview deployments)
4. Create Auth users for Sam and Michelle (Dashboard or invite)
5. Set Vercel / host env vars from `.env.example`
   - Set `NEXT_PUBLIC_APP_URL` per environment to the deployed origin (Preview: that deployment’s `https://…vercel.app` URL; Production: your canonical domain). Never use `http://localhost:3000` on Vercel.
6. Run locally once (or in CI with secrets): `pnpm setup:family`
7. Deploy the Next.js app
8. Verify:
   - Logged-out `/home` → `/login`
   - Magic link completes to `/home`
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
- `SUPABASE_SERVICE_ROLE_KEY` is for setup/seed only
- Phase 1 still uses `data/local-store.json` for product discussion data
- Do not enable public signup for production; create invited users only
