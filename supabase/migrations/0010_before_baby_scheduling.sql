-- Before Baby family due-date scheduling preferences on relational settings.
-- Primary persistence remains the remote JSON AppStore; these columns mirror for auth contexts.

alter table public.family_settings
  add column if not exists expected_due_date date;

alter table public.family_settings
  add column if not exists before_baby_scheduling jsonb not null default '{}'::jsonb;
