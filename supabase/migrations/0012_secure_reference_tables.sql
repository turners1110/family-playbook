-- Secure global reference tables that were created without RLS.
-- Matches questions / outcomes / life_stages: authenticated SELECT, no user writes.
-- Safe on populated tables. No data rewrite or deletion.
-- Idempotent: drop-if-exists policies, enable RLS, explicit grants.

-- ---------------------------------------------------------------------------
-- question_options
-- ---------------------------------------------------------------------------

alter table public.question_options enable row level security;

drop policy if exists question_options_read on public.question_options;
drop policy if exists question_options_all on public.question_options;
drop policy if exists question_options_write on public.question_options;

create policy question_options_read
  on public.question_options
  for select
  to authenticated
  using (true);

revoke all on table public.question_options from public;
revoke all on table public.question_options from anon;
revoke all on table public.question_options from authenticated;
grant select on table public.question_options to authenticated;
grant all on table public.question_options to service_role;

-- ---------------------------------------------------------------------------
-- outcome_development_maps
-- ---------------------------------------------------------------------------

alter table public.outcome_development_maps enable row level security;

drop policy if exists outcome_development_maps_read on public.outcome_development_maps;
drop policy if exists outcome_development_maps_all on public.outcome_development_maps;
drop policy if exists outcome_development_maps_write on public.outcome_development_maps;

create policy outcome_development_maps_read
  on public.outcome_development_maps
  for select
  to authenticated
  using (true);

revoke all on table public.outcome_development_maps from public;
revoke all on table public.outcome_development_maps from anon;
revoke all on table public.outcome_development_maps from authenticated;
grant select on table public.outcome_development_maps to authenticated;
grant all on table public.outcome_development_maps to service_role;

-- ---------------------------------------------------------------------------
-- Defense in depth: align grants on sibling reference tables
-- (RLS already blocked writes; revoke removes default PostgREST INSERT grants)
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.questions from anon, authenticated;
revoke insert, update, delete on table public.life_stages from anon, authenticated;
revoke insert, update, delete on table public.categories from anon, authenticated;
revoke insert, update, delete on table public.outcomes from anon, authenticated;
revoke insert, update, delete on table public.outcome_domains from anon, authenticated;

grant select on table public.questions to authenticated;
grant select on table public.life_stages to authenticated;
grant select on table public.categories to authenticated;
grant select on table public.outcomes to authenticated;
grant select on table public.outcome_domains to authenticated;

grant all on table public.questions to service_role;
grant all on table public.life_stages to service_role;
grant all on table public.categories to service_role;
grant all on table public.outcomes to service_role;
grant all on table public.outcome_domains to service_role;
grant all on table public.question_options to service_role;
grant all on table public.outcome_development_maps to service_role;
