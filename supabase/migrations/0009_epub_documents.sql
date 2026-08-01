-- EPUB documents, chapters, and DRM-aware extraction statuses.
-- Apply after 0008_public_book_research.sql.

-- Expand file extraction statuses for DRM.
alter table public.research_source_files
  drop constraint if exists research_source_files_extraction_status_check;

alter table public.research_source_files
  add constraint research_source_files_extraction_status_check
  check (extraction_status in (
    'not_started',
    'queued',
    'extracting',
    'extracted',
    'failed',
    'skipped',
    'drm_protected',
    'partial'
  ));

alter table public.research_source_files
  add column if not exists drm_protected boolean not null default false;
alter table public.research_source_files
  add column if not exists extraction_error_code text;
alter table public.research_source_files
  add column if not exists extraction_error_message text;

create table if not exists public.research_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  file_id uuid not null references public.research_source_files(id) on delete cascade,
  extraction_version text not null default 'epub-v1',
  language text,
  total_word_count int not null default 0,
  chapter_count int not null default 0,
  full_text_available boolean not null default false,
  extraction_status text not null default 'not_started' check (extraction_status in (
    'not_started',
    'queued',
    'extracting',
    'extracted',
    'failed',
    'skipped',
    'drm_protected',
    'partial'
  )),
  extraction_error_code text,
  title text,
  author text,
  publisher text,
  identifier text,
  drm_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (file_id)
);

create index if not exists research_source_documents_source_idx
  on public.research_source_documents (source_id);

create table if not exists public.research_source_chapters (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.research_source_documents(id) on delete cascade,
  source_id uuid not null references public.research_sources(id) on delete cascade,
  chapter_index int not null,
  chapter_title text not null,
  source_href text,
  word_count int not null default 0,
  extracted_text text not null default '',
  summary_status text not null default 'not_started' check (summary_status in (
    'not_started', 'queued', 'complete', 'failed', 'needs_review'
  )),
  finding_count int not null default 0,
  review_status text not null default 'needs_review' check (review_status in (
    'needs_review', 'approved', 'rejected', 'edited'
  )),
  created_at timestamptz not null default now(),
  unique (document_id, chapter_index)
);

create index if not exists research_source_chapters_source_idx
  on public.research_source_chapters (source_id);
create index if not exists research_source_chapters_document_idx
  on public.research_source_chapters (document_id);

-- Processing job stages for EPUB pipeline (extend job_type list if needed).
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

alter table public.research_sources
  add column if not exists drm_protected boolean not null default false;
alter table public.research_sources
  add column if not exists readable_text_extracted boolean not null default false;
alter table public.research_sources
  add column if not exists epub_uploaded boolean not null default false;
alter table public.research_sources
  add column if not exists total_words_extracted int not null default 0;

alter table public.research_source_documents enable row level security;
alter table public.research_source_chapters enable row level security;

drop policy if exists research_source_documents_family on public.research_source_documents;
create policy research_source_documents_family
  on public.research_source_documents for all
  using (
    source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  )
  with check (
    source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  );

drop policy if exists research_source_chapters_family on public.research_source_chapters;
create policy research_source_chapters_family
  on public.research_source_chapters for all
  using (
    source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  )
  with check (
    source_id in (
      select id from public.research_sources
      where family_id in (select public.user_family_ids())
    )
  );

-- Chapter full text is sensitive: revoke broad public/anon access; service role retains.
revoke all on table public.research_source_documents from public;
revoke all on table public.research_source_chapters from public;
revoke all on table public.research_source_documents from anon;
revoke all on table public.research_source_chapters from anon;

grant all on table public.research_source_documents to service_role;
grant all on table public.research_source_chapters to service_role;
-- Chapter extracted_text is server-only (service role). Authenticated clients never get full text via PostgREST.
grant select on table public.research_source_documents to authenticated;
revoke all on table public.research_source_chapters from authenticated;
