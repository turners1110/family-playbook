# Trip Online Mode (temporary)

Emergency phone-friendly access while Supabase magic-link PKCE is debugged.
Magic-link auth at `/login` stays available for parallel testing.

## Enable

1. Apply `supabase/migrations/0003_remote_json_store.sql` in the Supabase SQL editor.
2. Apply `supabase/migrations/0006_remote_store_mutations.sql` (mutation IDs + jsonb RPC result).
3. Confirm Turner Family exists (`pnpm setup:family`).
4. Upload local data:

```bash
pnpm upload:remote-store
```

5. Set **server-only** Vercel env vars (Production + Preview as needed):

| Variable | Example |
|---|---|
| `EMERGENCY_ACCESS_MODE` | `true` |
| `EMERGENCY_ACCESS_CODE` | long shared code (not committed) |
| `EMERGENCY_COOKIE_SECRET` | long random secret (not committed) |
| `USE_REMOTE_JSON_STORE` | `true` |
| `SUPABASE_SERVICE_ROLE_KEY` | existing service role (server only) |
| `TURNER_FAMILY_NAME` | `Turner Family` |

Never prefix these with `NEXT_PUBLIC_`. Never log or commit real values.

6. Redeploy Vercel so server env is applied.

## Phone test

1. Sign out of any Supabase session (or use a private browser).
2. Open `https://<your-app>/access`.
3. Enter the shared access code.
4. Choose Sam or Michelle.
5. Save an answer, refresh, confirm it remains.
6. On another phone/browser: enter the code, choose the other parent, confirm shared family data.
7. Redeploy Vercel and confirm the answer still exists (remote JSON, not the deploy filesystem).

## Security model (remote JSON tables)

- `family_json_stores` / `family_json_store_versions` are **not** browser-accessible.
- RLS enabled with no anon/authenticated policies.
- Privileges revoked from `anon` / `authenticated`; only `service_role` can read/write.
- Next.js server code uses the admin client exclusively for these tables.
- Browser never receives the service-role key.

## Disable after the trip

1. Download a full JSON backup from Settings.
2. Set `EMERGENCY_ACCESS_MODE=false` (or remove it) on Vercel.
3. Optionally set `USE_REMOTE_JSON_STORE=false` once you no longer need remote JSON.
4. Redeploy.
5. `/access` returns 404 / redirects to `/login`; emergency cookies no longer grant access.
6. Continue magic-link auth; later migrate to normalized Supabase tables and remove the JSON bridge.

## Later migration

Keep using backups + `family_json_store_versions` as a recovery trail while moving answers/decisions/sessions into normalized tables. Do not delete history rows until normalized migration is verified.
