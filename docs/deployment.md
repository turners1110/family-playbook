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
   - Site URL = production app URL
   - Redirect allow list includes `https://<domain>/auth/callback`
4. Create Auth users for Sam and Michelle (Dashboard or invite)
5. Set Vercel / host env vars from `.env.example`
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

- `SUPABASE_SERVICE_ROLE_KEY` is for setup/seed only
- Phase 1 still uses `data/local-store.json` for product discussion data
- Do not enable public signup for production; create invited users only
