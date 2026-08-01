-- Recommended Library seed (metadata only).
-- Idempotent: unique slug + ON CONFLICT DO NOTHING.
-- Does not create summaries, findings, citations, or file content.
-- Does not imply ownership of copyrighted works.

create table if not exists public.research_recommended_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('book', 'organization')),
  title text not null,
  author_text text,
  organization text,
  source_type text not null check (source_type in (
    'book',
    'research_paper',
    'clinical_guideline',
    'government_guidance',
    'professional_org_guidance',
    'article',
    'website',
    'podcast',
    'video',
    'personal_note',
    'uploaded_document'
  )),
  publication_year int,
  description text not null,
  topics text[] not null default '{}',
  life_stages text[] not null default '{}',
  evidence_basis text,
  evidence_rating text,
  ownership_status text,
  metadata_only boolean not null default true,
  availability_type text not null default 'metadata_only'
    check (availability_type in ('full_text', 'partial_text', 'notes_only', 'metadata_only')),
  processing_status text not null default 'metadata_only'
    check (processing_status in (
      'not_processed', 'queued', 'processing', 'processed',
      'needs_review', 'processing_failed', 'metadata_only', 'archived'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_recommended_sources_kind_idx
  on public.research_recommended_sources (kind);

create index if not exists research_recommended_sources_source_type_idx
  on public.research_recommended_sources (source_type);

-- Per-family preference: hide recommendation and/or link to added My Library source.
create table if not exists public.research_recommended_family_state (
  family_id uuid not null references public.families(id) on delete cascade,
  recommended_slug text not null references public.research_recommended_sources(slug) on delete cascade,
  hidden_at timestamptz,
  added_source_id uuid references public.research_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, recommended_slug)
);

create index if not exists research_recommended_family_state_family_idx
  on public.research_recommended_family_state (family_id);

-- Link family sources back to catalog when added from Recommended Library.
alter table public.research_sources
  add column if not exists recommended_slug text references public.research_recommended_sources(slug) on delete set null;

create index if not exists research_sources_recommended_slug_idx
  on public.research_sources (family_id, recommended_slug);

alter table public.research_recommended_sources enable row level security;
alter table public.research_recommended_family_state enable row level security;

-- Catalog is readable by authenticated family members; writes remain service-role / trusted server.
drop policy if exists research_recommended_sources_select on public.research_recommended_sources;
create policy research_recommended_sources_select
  on public.research_recommended_sources
  for select
  to authenticated
  using (true);

drop policy if exists research_recommended_family_state_select on public.research_recommended_family_state;
create policy research_recommended_family_state_select
  on public.research_recommended_family_state
  for select
  to authenticated
  using (family_id in (select public.user_family_ids()));

drop policy if exists research_recommended_family_state_write on public.research_recommended_family_state;
create policy research_recommended_family_state_write
  on public.research_recommended_family_state
  for all
  to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

revoke all on table public.research_recommended_sources from public;
revoke all on table public.research_recommended_family_state from public;
grant select on table public.research_recommended_sources to authenticated, service_role;
grant select, insert, update, delete on table public.research_recommended_family_state to authenticated, service_role;
grant all on table public.research_recommended_sources to service_role;

insert into public.research_recommended_sources (
  slug,
  kind,
  title,
  author_text,
  organization,
  source_type,
  publication_year,
  description,
  topics,
  life_stages,
  evidence_basis,
  evidence_rating,
  ownership_status
)
values
  (
    'expecting-better-emily-oster',
    'book',
    'Expecting Better',
    'Emily Oster',
    null,
    'book',
    2013,
    'Data-oriented guide to pregnancy decisions. Metadata recommendation only — we do not host book content.',
    ARRAY['pregnancy', 'health_and_safety']::text[],
    ARRAY['pre_birth_planning', 'pregnancy']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'cribsheet-emily-oster',
    'book',
    'Cribsheet',
    'Emily Oster',
    null,
    'book',
    2019,
    'Evidence-focused look at early parenting choices. Metadata recommendation only — we do not host book content.',
    ARRAY['newborn', 'infant', 'sleep', 'nutrition']::text[],
    ARRAY['newborn_0_3', 'infant_3_12', 'young_toddler_1_2']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'precious-little-sleep-alexis-dubief',
    'book',
    'Precious Little Sleep',
    'Alexis Dubief',
    null,
    'book',
    2017,
    'Practical infant and toddler sleep strategies. Metadata recommendation only — we do not host book content.',
    ARRAY['sleep', 'infant', 'toddler']::text[],
    ARRAY['newborn_0_3', 'infant_3_12', 'young_toddler_1_2', 'older_toddler_2_3']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'healthy-sleep-habits-happy-child-weissbluth',
    'book',
    'Healthy Sleep Habits, Happy Child',
    'Marc Weissbluth',
    null,
    'book',
    2015,
    'Pediatric sleep guidance across early childhood. Metadata recommendation only — we do not host book content.',
    ARRAY['sleep', 'infant', 'toddler', 'preschool']::text[],
    ARRAY['newborn_0_3', 'infant_3_12', 'young_toddler_1_2', 'older_toddler_2_3', 'preschool_3_5']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'good-inside-becky-kennedy',
    'book',
    'Good Inside',
    'Becky Kennedy',
    null,
    'book',
    2022,
    'Connection-focused parenting framework. Metadata recommendation only — we do not host book content.',
    ARRAY['emotional_development', 'discipline', 'family_systems']::text[],
    ARRAY['young_toddler_1_2', 'older_toddler_2_3', 'preschool_3_5', 'early_elementary_5_8', 'later_elementary_8_11', 'all_stages']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'raising-good-humans-hunter-clarke-fields',
    'book',
    'Raising Good Humans',
    'Hunter Clarke-Fields',
    null,
    'book',
    2019,
    'Mindful approaches to parenting stress and reactivity. Metadata recommendation only — we do not host book content.',
    ARRAY['emotional_development', 'parent_relationship', 'discipline']::text[],
    ARRAY['all_stages']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'the-whole-brain-child-siegel-bryson',
    'book',
    'The Whole-Brain Child',
    'Daniel J. Siegel & Tina Payne Bryson',
    null,
    'book',
    2011,
    'Brain-informed strategies for everyday parenting moments. Metadata recommendation only — we do not host book content.',
    ARRAY['emotional_development', 'discipline', 'toddler', 'preschool']::text[],
    ARRAY['young_toddler_1_2', 'older_toddler_2_3', 'preschool_3_5', 'early_elementary_5_8']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'no-drama-discipline-siegel-bryson',
    'book',
    'No-Drama Discipline',
    'Daniel J. Siegel & Tina Payne Bryson',
    null,
    'book',
    2014,
    'Discipline approaches that connect before correcting. Metadata recommendation only — we do not host book content.',
    ARRAY['discipline', 'emotional_development']::text[],
    ARRAY['older_toddler_2_3', 'preschool_3_5', 'early_elementary_5_8', 'later_elementary_8_11']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'how-to-talk-so-little-kids-will-listen-faber-king',
    'book',
    'How to Talk So Little Kids Will Listen',
    'Joanna Faber & Julie King',
    null,
    'book',
    2017,
    'Communication tools for young children. Metadata recommendation only — we do not host book content.',
    ARRAY['emotional_development', 'discipline', 'toddler', 'preschool']::text[],
    ARRAY['young_toddler_1_2', 'older_toddler_2_3', 'preschool_3_5']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'hunt-gather-parent-michaeleen-doucleff',
    'book',
    'Hunt, Gather, Parent',
    'Michaeleen Doucleff',
    null,
    'book',
    2021,
    'Cross-cultural parenting practices reported for modern families. Metadata recommendation only — we do not host book content.',
    ARRAY['family_systems', 'emotional_development', 'discipline']::text[],
    ARRAY['all_stages']::text[],
    'journalistic_source',
    'expert_opinion',
    null
  ),
  (
    'the-montessori-baby-davies-uzodike',
    'book',
    'The Montessori Baby',
    'Simone Davies & Junnifa Uzodike',
    null,
    'book',
    2021,
    'Montessori-inspired care for babies. Metadata recommendation only — we do not host book content.',
    ARRAY['education', 'newborn', 'infant']::text[],
    ARRAY['newborn_0_3', 'infant_3_12']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'the-montessori-toddler-simone-davies',
    'book',
    'The Montessori Toddler',
    'Simone Davies',
    null,
    'book',
    2019,
    'Montessori-inspired approaches for toddlers. Metadata recommendation only — we do not host book content.',
    ARRAY['education', 'toddler', 'emotional_development']::text[],
    ARRAY['young_toddler_1_2', 'older_toddler_2_3']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'atomic-habits-james-clear',
    'book',
    'Atomic Habits',
    'James Clear',
    null,
    'book',
    2018,
    'Habit formation frameworks useful for household systems. Metadata recommendation only — we do not host book content.',
    ARRAY['family_systems', 'parent_relationship']::text[],
    ARRAY['all_stages']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'tiny-habits-bj-fogg',
    'book',
    'Tiny Habits',
    'BJ Fogg',
    null,
    'book',
    2019,
    'Behavior-design approach to small sustainable changes. Metadata recommendation only — we do not host book content.',
    ARRAY['family_systems', 'parent_relationship']::text[],
    ARRAY['all_stages']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'fair-play-eve-rodsky',
    'book',
    'Fair Play',
    'Eve Rodsky',
    null,
    'book',
    2019,
    'Domestic workload and partnership systems. Metadata recommendation only — we do not host book content.',
    ARRAY['parent_relationship', 'family_systems']::text[],
    ARRAY['all_stages']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'seven-principles-making-marriage-work-gottman-silver',
    'book',
    'The Seven Principles for Making Marriage Work',
    'John Gottman & Nan Silver',
    null,
    'book',
    2015,
    'Research-informed relationship practices for couples. Metadata recommendation only — we do not host book content.',
    ARRAY['parent_relationship', 'family_systems']::text[],
    ARRAY['all_stages']::text[],
    'expert_authored_book',
    'moderate',
    null
  ),
  (
    'the-opposite-of-spoiled-ron-lieber',
    'book',
    'The Opposite of Spoiled',
    'Ron Lieber',
    null,
    'book',
    2015,
    'Raising money-smart kids. Metadata recommendation only — we do not host book content.',
    ARRAY['financial_skills', 'family_systems']::text[],
    ARRAY['preschool_3_5', 'early_elementary_5_8', 'later_elementary_8_11', 'preteen', 'teen']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'smart-money-smart-kids-ramsey-cruze',
    'book',
    'Smart Money Smart Kids',
    'Dave Ramsey & Rachel Cruze',
    null,
    'book',
    2014,
    'Family money conversations and habits. Metadata recommendation only — we do not host book content.',
    ARRAY['financial_skills', 'family_systems']::text[],
    ARRAY['early_elementary_5_8', 'later_elementary_8_11', 'preteen', 'teen']::text[],
    'expert_authored_book',
    'expert_opinion',
    null
  ),
  (
    'org-american-academy-of-pediatrics',
    'organization',
    'American Academy of Pediatrics',
    null,
    'American Academy of Pediatrics',
    'professional_org_guidance',
    null,
    'Trusted pediatric professional organization. Reference metadata only — link to official publications as needed; we do not host their content.',
    ARRAY['health_and_safety', 'newborn', 'infant', 'toddler']::text[],
    ARRAY['all_stages']::text[],
    'professional_consensus',
    'high',
    'reference_only'
  ),
  (
    'org-cdc',
    'organization',
    'CDC',
    null,
    'Centers for Disease Control and Prevention',
    'government_guidance',
    null,
    'U.S. public health guidance. Reference metadata only — consult official CDC materials; we do not host their content.',
    ARRAY['health_and_safety', 'pregnancy', 'nutrition']::text[],
    ARRAY['all_stages']::text[],
    'government_guidance',
    'high',
    'reference_only'
  ),
  (
    'org-acog',
    'organization',
    'ACOG',
    null,
    'American College of Obstetricians and Gynecologists',
    'professional_org_guidance',
    null,
    'Obstetric and gynecologic professional guidance. Reference metadata only — we do not host their content.',
    ARRAY['pregnancy', 'birth', 'health_and_safety']::text[],
    ARRAY['pre_birth_planning', 'pregnancy', 'labor_and_birth']::text[],
    'clinical_guideline',
    'high',
    'reference_only'
  ),
  (
    'org-who',
    'organization',
    'WHO',
    null,
    'World Health Organization',
    'government_guidance',
    null,
    'International public health guidance. Reference metadata only — consult official WHO materials; we do not host their content.',
    ARRAY['health_and_safety', 'nutrition', 'pregnancy']::text[],
    ARRAY['all_stages']::text[],
    'government_guidance',
    'high',
    'reference_only'
  ),
  (
    'org-nih',
    'organization',
    'NIH',
    null,
    'National Institutes of Health',
    'government_guidance',
    null,
    'U.S. biomedical research agency. Reference metadata only — consult official NIH materials; we do not host their content.',
    ARRAY['health_and_safety']::text[],
    ARRAY['all_stages']::text[],
    'government_guidance',
    'high',
    'reference_only'
  ),
  (
    'org-zero-to-three',
    'organization',
    'Zero to Three',
    null,
    'Zero to Three',
    'professional_org_guidance',
    null,
    'Early childhood development organization. Reference metadata only — we do not host their content.',
    ARRAY['infant', 'toddler', 'emotional_development', 'education']::text[],
    ARRAY['newborn_0_3', 'infant_3_12', 'young_toddler_1_2', 'older_toddler_2_3']::text[],
    'professional_consensus',
    'moderate',
    'reference_only'
  )
on conflict (slug) do nothing;
