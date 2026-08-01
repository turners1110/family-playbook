-- Research & Books library (Phase 1+)
-- Normalized evidence sources. Files live in private Storage, not JSON store.

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  subtitle text,
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
  author_text text,
  organization text,
  publisher text,
  publication_year int,
  edition text,
  isbn text,
  description text,
  source_url text,
  cover_image_url text,
  availability_type text not null default 'metadata_only' check (availability_type in (
    'full_text',
    'partial_text',
    'notes_only',
    'metadata_only'
  )),
  processing_status text not null default 'not_processed' check (processing_status in (
    'not_processed',
    'queued',
    'processing',
    'processed',
    'needs_review',
    'processing_failed',
    'metadata_only',
    'archived'
  )),
  evidence_rating text check (evidence_rating in (
    'high',
    'moderate',
    'low',
    'expert_opinion',
    'personal_experience',
    'unknown'
  )),
  evidence_rating_reason text,
  evidence_basis text check (evidence_basis is null or evidence_basis in (
    'systematic_review',
    'meta_analysis',
    'randomized_trial',
    'observational_research',
    'clinical_guideline',
    'government_guidance',
    'professional_consensus',
    'expert_authored_book',
    'journalistic_source',
    'memoir',
    'personal_anecdote',
    'opinion',
    'mixed',
    'unknown'
  )),
  evidence_rating_approved boolean not null default false,
  ownership_status text check (ownership_status is null or ownership_status in (
    'owned_physical',
    'owned_digital',
    'borrowed',
    'library',
    'reference_only',
    'unknown'
  )),
  topics text[] not null default '{}',
  life_stages text[] not null default '{}',
  rights_attested boolean not null default false,
  added_by_member_id text,
  added_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  archived_at timestamptz
);

create index if not exists research_sources_family_idx
  on public.research_sources (family_id);
create index if not exists research_sources_status_idx
  on public.research_sources (family_id, processing_status);
create index if not exists research_sources_type_idx
  on public.research_sources (family_id, source_type);
create index if not exists research_sources_title_idx
  on public.research_sources (family_id, lower(title));

create table if not exists public.research_source_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  file_hash text not null,
  page_count int,
  extraction_status text not null default 'not_started' check (extraction_status in (
    'not_started',
    'queued',
    'extracting',
    'extracted',
    'failed',
    'skipped'
  )),
  created_at timestamptz not null default now(),
  unique (source_id, file_hash)
);

create index if not exists research_source_files_source_idx
  on public.research_source_files (source_id);
create index if not exists research_source_files_hash_idx
  on public.research_source_files (file_hash);

create table if not exists public.research_source_topics (
  source_id uuid not null references public.research_sources(id) on delete cascade,
  topic_key text not null,
  primary key (source_id, topic_key)
);

create table if not exists public.research_source_life_stages (
  source_id uuid not null references public.research_sources(id) on delete cascade,
  life_stage text not null,
  primary key (source_id, life_stage)
);

create table if not exists public.research_source_summaries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  summary_type text not null check (summary_type in (
    'short_summary',
    'full_summary',
    'chapter_summary',
    'practical_takeaways',
    'important_conclusions',
    'limitations',
    'questions_raised',
    'parenting_applications',
    'contradictions',
    'why_it_matters',
    'main_argument',
    'core_framework'
  )),
  content text not null,
  content_basis text not null default 'manual' check (content_basis in (
    'manual',
    'source_states',
    'ai_interpretation',
    'practical_application'
  )),
  model_name text,
  prompt_version text,
  source_version int not null default 1,
  chapter_title text,
  created_at timestamptz not null default now(),
  approved_by_member_id text,
  approved_at timestamptz,
  review_status text not null default 'needs_review' check (review_status in (
    'needs_review',
    'approved',
    'rejected',
    'edited'
  ))
);

create index if not exists research_source_summaries_source_idx
  on public.research_source_summaries (source_id);

create table if not exists public.research_source_findings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  finding_type text not null check (finding_type in (
    'claim',
    'recommendation',
    'principle',
    'warning',
    'statistic',
    'framework',
    'exercise',
    'question'
  )),
  title text not null,
  finding_text text not null,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  evidence_strength text check (evidence_strength is null or evidence_strength in (
    'high', 'moderate', 'low', 'expert_opinion', 'unknown'
  )),
  source_location text,
  page_start int,
  page_end int,
  chapter_title text,
  short_excerpt text,
  ai_generated boolean not null default false,
  review_status text not null default 'needs_review' check (review_status in (
    'needs_review',
    'approved',
    'rejected',
    'edited'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_source_findings_source_idx
  on public.research_source_findings (source_id);

create table if not exists public.research_source_links (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  link_type text not null check (link_type in (
    'supports',
    'qualifies',
    'challenges',
    'related',
    'informs'
  )),
  question_id text,
  principle_id text,
  outcome_id text,
  knowledge_item_id text,
  checklist_task_id text,
  finding_id uuid references public.research_source_findings(id) on delete set null,
  relevance_note text,
  created_at timestamptz not null default now(),
  check (
    question_id is not null
    or principle_id is not null
    or outcome_id is not null
    or knowledge_item_id is not null
    or checklist_task_id is not null
  )
);

create index if not exists research_source_links_source_idx
  on public.research_source_links (source_id);
create index if not exists research_source_links_question_idx
  on public.research_source_links (question_id)
  where question_id is not null;
create index if not exists research_source_links_principle_idx
  on public.research_source_links (principle_id)
  where principle_id is not null;

create table if not exists public.research_source_notes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  note_scope text not null check (note_scope in ('sam', 'michelle', 'shared')),
  author_member_id text,
  author_display_name text,
  text text not null,
  page_or_chapter text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_source_notes_source_idx
  on public.research_source_notes (source_id);

create table if not exists public.research_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources(id) on delete cascade,
  job_type text not null check (job_type in (
    'extract',
    'summarize',
    'findings',
    'link',
    'reprocess',
    'full_pipeline'
  )),
  status text not null default 'queued' check (status in (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
  )),
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  current_stage text,
  error_code text,
  safe_error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists research_processing_jobs_source_idx
  on public.research_processing_jobs (source_id);
create index if not exists research_processing_jobs_status_idx
  on public.research_processing_jobs (status);

create table if not exists public.research_source_conflicts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  topic text not null,
  source_a_id uuid not null references public.research_sources(id) on delete cascade,
  source_b_id uuid not null references public.research_sources(id) on delete cascade,
  position_a text not null,
  position_b text not null,
  evidence_a text,
  evidence_b text,
  disagreement_reasons text,
  population_differences text,
  date_differences text,
  open_question text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.research_sources enable row level security;
alter table public.research_source_files enable row level security;
alter table public.research_source_topics enable row level security;
alter table public.research_source_life_stages enable row level security;
alter table public.research_source_summaries enable row level security;
alter table public.research_source_findings enable row level security;
alter table public.research_source_links enable row level security;
alter table public.research_source_notes enable row level security;
alter table public.research_processing_jobs enable row level security;
alter table public.research_source_conflicts enable row level security;

create policy research_sources_all on public.research_sources
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy research_source_files_all on public.research_source_files
  for all using (
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

create policy research_source_topics_all on public.research_source_topics
  for all using (
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

create policy research_source_life_stages_all on public.research_source_life_stages
  for all using (
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

create policy research_source_summaries_all on public.research_source_summaries
  for all using (
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

create policy research_source_findings_all on public.research_source_findings
  for all using (
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

create policy research_source_links_all on public.research_source_links
  for all using (
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

create policy research_source_notes_all on public.research_source_notes
  for all using (
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

create policy research_processing_jobs_all on public.research_processing_jobs
  for all using (
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

create policy research_source_conflicts_all on public.research_source_conflicts
  for all using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));
