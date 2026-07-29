-- Turner Family Principles — initial schema
-- Apply with Supabase CLI or SQL editor.

create extension if not exists "pgcrypto";

-- Enums as text + checks for portability
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('parent','caregiver','child','other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  birth_date date,
  expected_due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.life_stages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null,
  babymoon_weighted boolean not null default false
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  parent_slug text,
  sort_order int not null default 0
);

create table if not exists public.outcome_domains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null
);

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  domain_slug text not null references public.outcome_domains(slug),
  label text not null,
  definition text not null,
  why_it_matters text not null,
  healthy_development text not null,
  sort_order int not null default 0
);

create table if not exists public.outcome_development_maps (
  id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null references public.outcomes(id) on delete cascade,
  age_range text not null,
  guidance jsonb not null default '[]',
  sort_order int not null default 0
);

create table if not exists public.principles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  slug text not null,
  title text not null,
  statement text not null,
  sort_order int not null default 0
);

create table if not exists public.questions (
  id text primary key,
  slug text not null unique,
  text text not null,
  short_title text not null,
  why_it_matters text not null,
  discussion_guidance text not null,
  question_type text not null,
  response_schema jsonb not null default '{}',
  life_stages text[] not null default '{}',
  categories text[] not null default '{}',
  subcategories text[] not null default '{}',
  outcomes text[] not null default '{}',
  related_principles text[] not null default '{}',
  related_questions text[] not null default '{}',
  parent_decision_dependency text,
  logical_order int not null,
  priority text not null,
  estimated_minutes int not null,
  emotional_weight int not null default 3,
  evidence_needed boolean not null default false,
  evidence_available boolean not null default false,
  evidence_summary text,
  practical_tip text,
  separate_answers_recommended boolean not null default false,
  cooling_off_recommended boolean not null default false,
  follow_up_prompts text[] not null default '{}',
  review_recommendation text,
  child_dependent boolean not null default false,
  required_before_birth boolean not null default false,
  babymoon_priority boolean not null default false,
  research_mode text not null default 'optional_background',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  value text not null,
  label text not null,
  sort_order int not null default 0
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  question_id text not null references public.questions(id),
  member_id uuid references public.family_members(id),
  is_shared boolean not null default false,
  payload jsonb not null default '{}',
  status text not null,
  confidence int,
  bookmarked boolean not null default false,
  needs_research boolean not null default false,
  review_date date,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists answers_shared_unique
  on public.answers (family_id, question_id)
  where is_shared = true;

create unique index if not exists answers_member_unique
  on public.answers (family_id, question_id, member_id)
  where is_shared = false and member_id is not null;

create table if not exists public.answer_versions (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  version int not null,
  payload jsonb not null,
  status text not null,
  confidence int,
  changed_by uuid,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (answer_id, version)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  statement text not null,
  problem text,
  reasoning text,
  sam_perspective text,
  michelle_perspective text,
  shared_conclusion text,
  agreement_notes text,
  disagreement_notes text,
  status text not null,
  confidence int,
  decision_type text not null,
  evidence_strength text not null default 'unknown',
  emotional_weight int not null default 3,
  reversibility text,
  child_dependent boolean not null default false,
  life_stages text[] not null default '{}',
  categories text[] not null default '{}',
  research_notes text,
  implementation_notes text,
  exceptions text,
  risks text,
  warning_signs text,
  reconsideration_conditions text,
  review_date date,
  has_disagreement boolean not null default false,
  version int not null default 1,
  source_question_ids text[] not null default '{}',
  outcome_ids text[] not null default '{}',
  principle_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_versions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  changed_by uuid,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (decision_id, version)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  description text,
  length text not null,
  status text not null check (status in ('active','paused','completed')),
  filters jsonb not null default '{}',
  current_index int not null default 0,
  note text,
  babymoon_mode boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id text not null references public.questions(id),
  sort_order int not null,
  status text not null check (status in ('pending','answered','skipped')),
  answered_at timestamptz
);

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  title text not null,
  summary text not null,
  item_type text not null,
  source text,
  author text,
  publication text,
  publication_date date,
  url text,
  source_type text,
  evidence_quality text not null default 'unknown',
  life_stages text[] not null default '{}',
  categories text[] not null default '{}',
  related_question_ids text[] not null default '{}',
  related_decision_ids text[] not null default '{}',
  related_outcome_ids text[] not null default '{}',
  notes text,
  is_sample boolean not null default false,
  date_added timestamptz not null default now(),
  date_reviewed timestamptz
);

create table if not exists public.cooling_off_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  question_id text references public.questions(id),
  decision_id uuid references public.decisions(id),
  start_date date not null,
  wait_days int not null,
  reason text not null,
  revisit_date date not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  review_date date not null,
  reason text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_id, question_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.family_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  hide_partner_answers_until_both_saved boolean not null default true,
  dark_mode text not null default 'system',
  babymoon_target_date date,
  babymoon_daily_questions int not null default 10,
  include_perspective_history_in_playbook boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  purpose text not null,
  prompt text not null,
  output text not null,
  approved boolean not null default false,
  model text not null default 'mock',
  created_at timestamptz not null default now()
);

create table if not exists public.playbook_versions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  version_date timestamptz not null default now(),
  completion_status numeric not null default 0,
  include_perspective_history boolean not null default false,
  sections jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.answers enable row level security;
alter table public.answer_versions enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_versions enable row level security;
alter table public.sessions enable row level security;
alter table public.session_questions enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.cooling_off_items enable row level security;
alter table public.reviews enable row level security;
alter table public.bookmarks enable row level security;
alter table public.activity_log enable row level security;
alter table public.family_settings enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.playbook_versions enable row level security;
alter table public.principles enable row level security;

create or replace function public.user_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

create policy families_select on public.families
  for select using (id in (select public.user_family_ids()));

create policy family_members_select on public.family_members
  for select using (family_id in (select public.user_family_ids()));

create policy children_all on public.children
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy answers_all on public.answers
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy answer_versions_select on public.answer_versions
  for select using (
    answer_id in (
      select id from public.answers where family_id in (select public.user_family_ids())
    )
  );

create policy decisions_all on public.decisions
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy decision_versions_select on public.decision_versions
  for select using (
    decision_id in (
      select id from public.decisions where family_id in (select public.user_family_ids())
    )
  );

create policy sessions_all on public.sessions
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy session_questions_all on public.session_questions
  for all using (
    session_id in (
      select id from public.sessions where family_id in (select public.user_family_ids())
    )
  )
  with check (
    session_id in (
      select id from public.sessions where family_id in (select public.user_family_ids())
    )
  );

create policy knowledge_select on public.knowledge_items
  for select using (
    family_id is null or family_id in (select public.user_family_ids())
  );

create policy knowledge_write on public.knowledge_items
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy cooling_off_all on public.cooling_off_items
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy reviews_all on public.reviews
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy bookmarks_all on public.bookmarks
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy activity_all on public.activity_log
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy settings_all on public.family_settings
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy ai_outputs_all on public.ai_outputs
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy playbook_all on public.playbook_versions
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy principles_select on public.principles
  for select using (
    family_id is null or family_id in (select public.user_family_ids())
  );

-- Taxonomy and questions are readable to authenticated family members
alter table public.questions enable row level security;
alter table public.life_stages enable row level security;
alter table public.categories enable row level security;
alter table public.outcomes enable row level security;
alter table public.outcome_domains enable row level security;

create policy questions_read on public.questions for select to authenticated using (true);
create policy life_stages_read on public.life_stages for select to authenticated using (true);
create policy categories_read on public.categories for select to authenticated using (true);
create policy outcomes_read on public.outcomes for select to authenticated using (true);
create policy domains_read on public.outcome_domains for select to authenticated using (true);
