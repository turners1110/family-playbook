-- Public-source book research pipeline (Phase 2).
-- Extends processing states, stores external public sources, overviews, and coverage.
-- Does not store long copyrighted book text.

-- Expand processing_status allow-list (keep legacy values for existing rows).
alter table public.research_sources
  drop constraint if exists research_sources_processing_status_check;

alter table public.research_sources
  add constraint research_sources_processing_status_check
  check (processing_status in (
    'not_processed',
    'queued',
    'processing',
    'processed',
    'needs_review',
    'processing_failed',
    'metadata_only',
    'archived',
    'public_research_queued',
    'gathering_public_sources',
    'public_overview_ready',
    'awaiting_source_text',
    'source_text_uploaded',
    'extracting_source_text',
    'source_grounded_analysis_ready'
  ));

alter table public.research_recommended_sources
  drop constraint if exists research_recommended_sources_processing_status_check;

alter table public.research_recommended_sources
  add constraint research_recommended_sources_processing_status_check
  check (processing_status in (
    'not_processed',
    'queued',
    'processing',
    'processed',
    'needs_review',
    'processing_failed',
    'metadata_only',
    'archived',
    'public_research_queued',
    'gathering_public_sources',
    'public_overview_ready',
    'awaiting_source_text',
    'source_text_uploaded',
    'extracting_source_text',
    'source_grounded_analysis_ready'
  ));

-- Coverage columns on research_sources
alter table public.research_sources
  add column if not exists public_sources_reviewed int not null default 0;
alter table public.research_sources
  add column if not exists uploaded_file_count int not null default 0;
alter table public.research_sources
  add column if not exists book_pages_processed int not null default 0;
alter table public.research_sources
  add column if not exists chapters_processed int not null default 0;
alter table public.research_sources
  add column if not exists full_book_processed boolean not null default false;
alter table public.research_sources
  add column if not exists public_overview_status text not null default 'not_started'
    check (public_overview_status in ('not_started', 'queued', 'processing', 'complete', 'failed'));
alter table public.research_sources
  add column if not exists source_grounded_status text not null default 'not_started'
    check (source_grounded_status in ('not_started', 'queued', 'processing', 'complete', 'failed'));

-- Lawful public sources used for preliminary overviews (short notes only).
create table if not exists public.research_external_sources (
  id uuid primary key default gen_random_uuid(),
  research_source_id uuid not null references public.research_sources(id) on delete cascade,
  title text not null,
  author text,
  publisher text,
  url text,
  source_type text not null check (source_type in (
    'publisher_page',
    'author_website',
    'author_interview',
    'author_podcast',
    'public_talk',
    'author_article',
    'book_review',
    'library_catalog',
    'related_study',
    'professional_guidance',
    'other_public'
  )),
  publication_date date,
  accessed_at timestamptz not null default now(),
  reliability_rating text not null default 'moderate' check (reliability_rating in (
    'high', 'moderate', 'low', 'reviewer_interpretation', 'unknown'
  )),
  notes text,
  supports_finding_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists research_external_sources_source_idx
  on public.research_external_sources (research_source_id);

-- Structured public-source overview (not a full-book summary).
create table if not exists public.research_public_overviews (
  id uuid primary key default gen_random_uuid(),
  research_source_id uuid not null references public.research_sources(id) on delete cascade,
  processing_mode text not null default 'public_sources_only'
    check (processing_mode in ('public_sources_only', 'source_grounded', 'comparison')),
  short_summary text not null,
  detailed_overview text not null,
  main_themes jsonb not null default '[]',
  author_arguments jsonb not null default '[]',
  core_framework text,
  important_conclusions jsonb not null default '[]',
  practical_lessons jsonb not null default '[]',
  questions_raised jsonb not null default '[]',
  discussion_points jsonb not null default '[]',
  relevant_checklist_task_ids text[] not null default '{}',
  relevant_question_ids text[] not null default '{}',
  potential_principles jsonb not null default '[]',
  related_research jsonb not null default '[]',
  criticism_limitations jsonb not null default '[]',
  areas_of_disagreement jsonb not null default '[]',
  confidence text not null default 'low' check (confidence in ('low', 'moderate', 'high')),
  review_status text not null default 'needs_review' check (review_status in (
    'needs_review', 'approved', 'rejected', 'edited'
  )),
  full_book_processed boolean not null default false,
  source_basis text not null default 'public_sources',
  ai_provider text,
  model_name text,
  prompt_version text,
  source_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by_member_id text,
  approved_at timestamptz
);

create unique index if not exists research_public_overviews_source_mode_idx
  on public.research_public_overviews (research_source_id, processing_mode);

-- Comparison rows between public overview and uploaded-text analysis.
create table if not exists public.research_coverage_comparisons (
  id uuid primary key default gen_random_uuid(),
  research_source_id uuid not null references public.research_sources(id) on delete cascade,
  claim_key text not null,
  claim_text text not null,
  comparison_status text not null check (comparison_status in (
    'confirmed_by_uploaded_text',
    'expanded_by_uploaded_text',
    'not_supported_by_uploaded_text',
    'contradicted_by_uploaded_text',
    'still_uncertain'
  )),
  public_overview_id uuid references public.research_public_overviews(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists research_coverage_comparisons_source_idx
  on public.research_coverage_comparisons (research_source_id);

-- Expand finding model for preliminary public-source findings.
alter table public.research_source_findings
  add column if not exists source_basis text not null default 'public_sources'
    check (source_basis in ('public_sources', 'uploaded_text', 'mixed'));
alter table public.research_source_findings
  add column if not exists is_preliminary boolean not null default true;
alter table public.research_source_findings
  add column if not exists external_source_ids uuid[] not null default '{}';
alter table public.research_source_findings
  add column if not exists related_topics text[] not null default '{}';
alter table public.research_source_findings
  add column if not exists linked_question_ids text[] not null default '{}';
alter table public.research_source_findings
  add column if not exists linked_checklist_task_ids text[] not null default '{}';
alter table public.research_source_findings
  drop constraint if exists research_source_findings_confidence_check;
alter table public.research_source_findings
  add constraint research_source_findings_confidence_check
  check (confidence is null or confidence in ('low', 'medium', 'moderate', 'high'));

-- Expand job types for public research pipeline.
alter table public.research_processing_jobs
  drop constraint if exists research_processing_jobs_job_type_check;

alter table public.research_processing_jobs
  add constraint research_processing_jobs_job_type_check
  check (job_type in (
    'extract',
    'summarize',
    'findings',
    'link',
    'reprocess',
    'full_pipeline',
    'gather_public_sources',
    'generate_public_overview',
    'extract_preliminary_findings',
    'generate_preliminary_lessons',
    'public_book_research',
    'source_grounded_analysis',
    'compare_public_and_uploaded'
  ));

alter table public.research_processing_jobs
  add column if not exists family_id uuid references public.families(id) on delete cascade;
alter table public.research_processing_jobs
  add column if not exists ai_provider text;
alter table public.research_processing_jobs
  add column if not exists model_name text;
alter table public.research_processing_jobs
  add column if not exists prompt_version text;
alter table public.research_processing_jobs
  add column if not exists source_count int not null default 0;
alter table public.research_processing_jobs
  add column if not exists dedupe_key text;

create unique index if not exists research_processing_jobs_active_dedupe_idx
  on public.research_processing_jobs (source_id, dedupe_key)
  where status in ('queued', 'running') and dedupe_key is not null;

-- RLS
alter table public.research_external_sources enable row level security;
alter table public.research_public_overviews enable row level security;
alter table public.research_coverage_comparisons enable row level security;

drop policy if exists research_external_sources_family on public.research_external_sources;
create policy research_external_sources_family
  on public.research_external_sources for all
  using (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  )
  with check (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  );

drop policy if exists research_public_overviews_family on public.research_public_overviews;
create policy research_public_overviews_family
  on public.research_public_overviews for all
  using (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  )
  with check (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  );

drop policy if exists research_coverage_comparisons_family on public.research_coverage_comparisons;
create policy research_coverage_comparisons_family
  on public.research_coverage_comparisons for all
  using (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  )
  with check (
    research_source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  );

grant all on table public.research_external_sources to service_role;
grant all on table public.research_public_overviews to service_role;
grant all on table public.research_coverage_comparisons to service_role;
grant select, insert, update, delete on table public.research_external_sources to authenticated;
grant select, insert, update, delete on table public.research_public_overviews to authenticated;
grant select, insert, update, delete on table public.research_coverage_comparisons to authenticated;
