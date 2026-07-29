# Deployment

## Recommended

- **App:** Vercel
- **Database / Auth:** Supabase

## Steps

1. Create Supabase project
2. Run `supabase/migrations/0001_init.sql` in the SQL editor
3. Seed taxonomy/questions via a service-role script or SQL import from `data/seed/`
4. Create Auth users for Sam and Michelle (magic link)
5. Insert `families`, `profiles`, `family_members`, and `family_settings`
6. Deploy the Next.js app to Vercel
7. Set environment variables from `.env.example`
8. Set `USE_LOCAL_STORE=false` in production
9. Verify RLS by confirming users only see their family rows

## Local production build

```bash
pnpm generate:questions
pnpm seed
pnpm build
pnpm start
```
