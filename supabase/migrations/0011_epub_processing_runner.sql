-- Durable EPUB processing runner schema.
-- Safe to re-run. Also backfills columns that 0008 may not have applied.

-- ---------------------------------------------------------------------------
-- Processing status allow-list (expanded public + EPUB pipeline statuses)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Research source coverage / EPUB columns (from 0008/0009 if missing)
-- ---------------------------------------------------------------------------
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
  add column if not exists public_overview_status text;
alter table public.research_sources
  add column if not exists source_grounded_status text;
alter table public.research_sources
  add column if not exists finding_count int not null default 0;
alter table public.research_sources
  add column if not exists needs_review boolean not null default false;
alter table public.research_sources
  add column if not exists epub_uploaded boolean not null default false;
alter table public.research_sources
  add column if not exists drm_protected boolean not null default false;
alter table public.research_sources
  add column if not exists readable_text_extracted boolean not null default false;
alter table public.research_sources
  add column if not exists total_words_extracted int not null default 0;

-- ---------------------------------------------------------------------------
-- Processing jobs: public-research + EPUB runner columns
-- ---------------------------------------------------------------------------
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
alter table public.research_processing_jobs
  add column if not exists file_id uuid references public.research_source_files(id) on delete set null;
alter table public.research_processing_jobs
  add column if not exists updated_at timestamptz not null default now();
alter table public.research_processing_jobs
  add column if not exists claimed_at timestamptz;
alter table public.research_processing_jobs
  add column if not exists claim_token text;
alter table public.research_processing_jobs
  add column if not exists last_completed_stage text;

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
    'compare_public_and_uploaded',
    'epub_extract',
    'epub_source_grounded'
  ));

create unique index if not exists research_processing_jobs_active_dedupe_idx
  on public.research_processing_jobs (source_id, dedupe_key)
  where status in ('queued', 'running') and dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Atomic claim of one queued EPUB job (service role)
-- ---------------------------------------------------------------------------
create or replace function public.claim_research_processing_job(
  p_job_type text default 'epub_source_grounded',
  p_claim_token text default null
)
returns public.research_processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.research_processing_jobs;
  token text := coalesce(nullif(p_claim_token, ''), gen_random_uuid()::text);
begin
  update public.research_processing_jobs j
  set
    status = 'running',
    started_at = coalesce(j.started_at, now()),
    claimed_at = now(),
    claim_token = token,
    updated_at = now()
  where j.id = (
    select id
    from public.research_processing_jobs
    where status = 'queued'
      and job_type = p_job_type
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_research_processing_job(text, text) from public;
grant execute on function public.claim_research_processing_job(text, text) to service_role;
