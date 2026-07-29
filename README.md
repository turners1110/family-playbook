# Turner Family Principles

A private guided parenting decision system for Sam and Michelle Turner.

The question experience is the main input. The family knowledge base stores results. The decision layer organizes them. The playbook is the main output.

## Quick start (local demo)

```bash
pnpm install
pnpm generate:questions
pnpm seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Local demo mode uses `data/local-store.json` (no Supabase required). Switch between Sam and Michelle in the header.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Next.js |
| `pnpm build` | Production build |
| `pnpm seed` | Seed family, taxonomy, questions, sample data |
| `pnpm generate:questions` | Generate ≥300 seed questions JSON |
| `pnpm test` | Unit + integration tests (Vitest) |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm typecheck` | TypeScript check |

## Environment

Copy `.env.example` to `.env.local`.

For local demo, `USE_LOCAL_STORE=true` is enough.

For Supabase production:

1. Create a Supabase project
2. Apply `supabase/migrations/0001_init.sql`
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
4. Invite Sam and Michelle via Auth (magic link)
5. Insert family + `family_members` rows linking auth user IDs

## Primary navigation

Home · Discuss · Questions · Decisions · Outcomes · Knowledge · Playbook · Dashboard · Settings

Babymoon mode: `/babymoon`

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/architecture.md#data-model)
- [Seed question format](docs/seed-question-format.md)
- [AI interface](docs/ai-interface.md)
- [Roadmap & limitations](docs/roadmap.md)
- [Deployment](docs/deployment.md)

## Acceptance highlights

- Shared and separate answers with version history
- Cooling-off, research, review dates, confidence scores
- Discussion sessions with pause/resume
- Decision library linked to outcomes
- Playbook preview export (Markdown + HTML)
- ≥300 seed questions focused on pregnancy through early childhood
