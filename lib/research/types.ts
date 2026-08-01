/** Research & Books domain types (Phase 1+). */

export const RESEARCH_SOURCE_TYPES = [
  "book",
  "research_paper",
  "clinical_guideline",
  "government_guidance",
  "professional_org_guidance",
  "article",
  "website",
  "podcast",
  "video",
  "personal_note",
  "uploaded_document",
] as const;

export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];

export const RESEARCH_SOURCE_TYPE_LABELS: Record<ResearchSourceType, string> = {
  book: "Book",
  research_paper: "Research paper",
  clinical_guideline: "Clinical guideline",
  government_guidance: "Government guidance",
  professional_org_guidance: "Professional organization guidance",
  article: "Article",
  website: "Website",
  podcast: "Podcast",
  video: "Video",
  personal_note: "Personal note",
  uploaded_document: "Uploaded document",
};

export const RESEARCH_AVAILABILITY_TYPES = [
  "full_text",
  "partial_text",
  "notes_only",
  "metadata_only",
] as const;

export type ResearchAvailabilityType = (typeof RESEARCH_AVAILABILITY_TYPES)[number];

export const RESEARCH_AVAILABILITY_LABELS: Record<ResearchAvailabilityType, string> = {
  full_text: "Full text available",
  partial_text: "Partial text available",
  notes_only: "Notes only",
  metadata_only: "Metadata only",
};

export const RESEARCH_PROCESSING_STATUSES = [
  "not_processed",
  "queued",
  "processing",
  "processed",
  "needs_review",
  "processing_failed",
  "metadata_only",
  "archived",
  "public_research_queued",
  "gathering_public_sources",
  "public_overview_ready",
  "awaiting_source_text",
  "source_text_uploaded",
  "extracting_source_text",
  "source_grounded_analysis_ready",
] as const;

export type ResearchProcessingStatus = (typeof RESEARCH_PROCESSING_STATUSES)[number];

export const RESEARCH_PROCESSING_LABELS: Record<ResearchProcessingStatus, string> = {
  not_processed: "Not processed",
  queued: "Queued",
  processing: "Processing",
  processed: "Processed",
  needs_review: "Needs review",
  processing_failed: "Processing failed",
  metadata_only: "Metadata only",
  archived: "Archived",
  public_research_queued: "Public research queued",
  gathering_public_sources: "Gathering public sources",
  public_overview_ready: "Public overview ready",
  awaiting_source_text: "Awaiting book text",
  source_text_uploaded: "Book text uploaded",
  extracting_source_text: "Extracting book text",
  source_grounded_analysis_ready: "Source-grounded analysis ready",
};

export const RESEARCH_EVIDENCE_RATINGS = [
  "high",
  "moderate",
  "low",
  "expert_opinion",
  "personal_experience",
  "unknown",
] as const;

export type ResearchEvidenceRating = (typeof RESEARCH_EVIDENCE_RATINGS)[number];

export const RESEARCH_EVIDENCE_RATING_LABELS: Record<ResearchEvidenceRating, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  expert_opinion: "Expert opinion",
  personal_experience: "Personal experience",
  unknown: "Unknown",
};

export const RESEARCH_EVIDENCE_BASES = [
  "systematic_review",
  "meta_analysis",
  "randomized_trial",
  "observational_research",
  "clinical_guideline",
  "government_guidance",
  "professional_consensus",
  "expert_authored_book",
  "journalistic_source",
  "memoir",
  "personal_anecdote",
  "opinion",
  "mixed",
  "unknown",
] as const;

export type ResearchEvidenceBasis = (typeof RESEARCH_EVIDENCE_BASES)[number];

export const RESEARCH_OWNERSHIP_STATUSES = [
  "owned_physical",
  "owned_digital",
  "borrowed",
  "library",
  "reference_only",
  "unknown",
] as const;

export type ResearchOwnershipStatus = (typeof RESEARCH_OWNERSHIP_STATUSES)[number];

export const RESEARCH_SUMMARY_TYPES = [
  "short_summary",
  "full_summary",
  "chapter_summary",
  "practical_takeaways",
  "important_conclusions",
  "limitations",
  "questions_raised",
  "parenting_applications",
  "contradictions",
  "why_it_matters",
  "main_argument",
  "core_framework",
] as const;

export type ResearchSummaryType = (typeof RESEARCH_SUMMARY_TYPES)[number];

export const RESEARCH_NOTE_SCOPES = ["sam", "michelle", "shared"] as const;
export type ResearchNoteScope = (typeof RESEARCH_NOTE_SCOPES)[number];

export const RESEARCH_LINK_TYPES = [
  "supports",
  "qualifies",
  "challenges",
  "related",
  "informs",
] as const;

export type ResearchLinkType = (typeof RESEARCH_LINK_TYPES)[number];

export const RESEARCH_TOPIC_KEYS = [
  "pregnancy",
  "birth",
  "newborn",
  "infant",
  "toddler",
  "preschool",
  "school_age",
  "teen",
  "parent_relationship",
  "family_systems",
  "financial_skills",
  "health_and_safety",
  "emotional_development",
  "discipline",
  "education",
  "sleep",
  "nutrition",
  "technology",
] as const;

export type ResearchTopicKey = (typeof RESEARCH_TOPIC_KEYS)[number];

export const RESEARCH_TOPIC_LABELS: Record<ResearchTopicKey, string> = {
  pregnancy: "Pregnancy",
  birth: "Birth",
  newborn: "Newborn",
  infant: "Infant",
  toddler: "Toddler",
  preschool: "Preschool",
  school_age: "School age",
  teen: "Teen years",
  parent_relationship: "Parent relationship",
  family_systems: "Family systems",
  financial_skills: "Financial skills",
  health_and_safety: "Health and safety",
  emotional_development: "Emotional development",
  discipline: "Discipline",
  education: "Education",
  sleep: "Sleep",
  nutrition: "Nutrition",
  technology: "Technology",
};

/** Max upload size: 50 MiB */
export const RESEARCH_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const RESEARCH_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

export const RESEARCH_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".epub",
  ".txt",
  ".docx",
  ".doc",
] as const;

export const RESEARCH_REJECTED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".msi",
  ".dmg",
  ".app",
  ".js",
  ".mjs",
  ".cjs",
  ".php",
  ".py",
  ".rb",
  ".jar",
  ".wasm",
] as const;

export type ResearchSource = {
  id: string;
  family_id: string;
  title: string;
  subtitle: string | null;
  source_type: ResearchSourceType;
  author_text: string | null;
  organization: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  isbn: string | null;
  description: string | null;
  source_url: string | null;
  cover_image_url: string | null;
  availability_type: ResearchAvailabilityType;
  processing_status: ResearchProcessingStatus;
  evidence_rating: ResearchEvidenceRating | null;
  evidence_rating_reason: string | null;
  evidence_basis: ResearchEvidenceBasis | null;
  evidence_rating_approved: boolean;
  ownership_status: ResearchOwnershipStatus | null;
  topics: string[];
  life_stages: string[];
  rights_attested: boolean;
  added_by_member_id: string | null;
  added_by_display_name: string | null;
  /** Present when this family source was added from the built-in Recommended Library. */
  recommended_slug: string | null;
  public_sources_reviewed?: number;
  uploaded_file_count?: number;
  book_pages_processed?: number;
  chapters_processed?: number;
  full_book_processed?: boolean;
  public_overview_status?: "not_started" | "queued" | "processing" | "complete" | "failed";
  source_grounded_status?: "not_started" | "queued" | "processing" | "complete" | "failed";
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  archived_at: string | null;
};

export type ResearchSourceCard = ResearchSource & {
  finding_count: number;
  linked_question_count: number;
  linked_principle_count: number;
  has_summary: boolean;
  file_count: number;
  /** Catalog vs family library card. */
  library_origin?: "family" | "recommended";
  /** Built-in catalog recommendation. */
  built_in?: boolean;
  /** Family already added this recommendation. */
  in_my_library?: boolean;
  /** Family source id when added from catalog. */
  added_source_id?: string | null;
};

export type ResearchLibraryStore = {
  sources: ResearchSource[];
  files: ResearchSourceFile[];
  summaries: ResearchSourceSummary[];
  notes: ResearchSourceNote[];
  links: ResearchSourceLink[];
  recommended_prefs?: Record<
    string,
    {
      hidden: string[];
      added: Record<string, string>;
    }
  >;
};

export type ResearchSourceFile = {
  id: string;
  source_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  page_count: number | null;
  extraction_status: string;
  created_at: string;
};

export type ResearchSourceSummary = {
  id: string;
  source_id: string;
  summary_type: ResearchSummaryType;
  content: string;
  content_basis: "manual" | "source_states" | "ai_interpretation" | "practical_application";
  model_name: string | null;
  prompt_version: string | null;
  source_version: number;
  chapter_title: string | null;
  created_at: string;
  approved_by_member_id: string | null;
  approved_at: string | null;
  review_status: "needs_review" | "approved" | "rejected" | "edited";
};

export type ResearchSourceNote = {
  id: string;
  source_id: string;
  note_scope: ResearchNoteScope;
  author_member_id: string | null;
  author_display_name: string | null;
  text: string;
  page_or_chapter: string | null;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type ResearchSourceLink = {
  id: string;
  source_id: string;
  link_type: ResearchLinkType;
  question_id: string | null;
  principle_id: string | null;
  outcome_id: string | null;
  knowledge_item_id: string | null;
  checklist_task_id: string | null;
  finding_id: string | null;
  relevance_note: string | null;
  created_at: string;
};

export const RESEARCH_EXTERNAL_SOURCE_TYPES = [
  "publisher_page",
  "author_website",
  "author_interview",
  "author_podcast",
  "public_talk",
  "author_article",
  "book_review",
  "library_catalog",
  "related_study",
  "professional_guidance",
  "other_public",
] as const;

export type ResearchExternalSourceType = (typeof RESEARCH_EXTERNAL_SOURCE_TYPES)[number];

export type ResearchExternalSource = {
  id: string;
  research_source_id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  url: string | null;
  source_type: ResearchExternalSourceType;
  publication_date: string | null;
  accessed_at: string;
  reliability_rating:
    | "high"
    | "moderate"
    | "low"
    | "reviewer_interpretation"
    | "unknown";
  notes: string | null;
  supports_finding_ids: string[];
  created_at: string;
};

export type ResearchPublicOverview = {
  id: string;
  research_source_id: string;
  processing_mode: "public_sources_only" | "source_grounded" | "comparison";
  short_summary: string;
  detailed_overview: string;
  main_themes: string[];
  author_arguments: string[];
  core_framework: string | null;
  important_conclusions: string[];
  practical_lessons: string[];
  questions_raised: string[];
  discussion_points: string[];
  relevant_checklist_task_ids: string[];
  relevant_question_ids: string[];
  potential_principles: string[];
  related_research: string[];
  criticism_limitations: string[];
  areas_of_disagreement: string[];
  confidence: "low" | "moderate" | "high";
  review_status: "needs_review" | "approved" | "rejected" | "edited";
  full_book_processed: boolean;
  source_basis: "public_sources" | "uploaded_text" | "mixed";
  ai_provider: string | null;
  model_name: string | null;
  prompt_version: string | null;
  source_count: number;
  created_at: string;
  updated_at: string;
  approved_by_member_id: string | null;
  approved_at: string | null;
};

export type ResearchPreliminaryFinding = {
  id: string;
  source_id: string;
  finding_type:
    | "claim"
    | "recommendation"
    | "principle"
    | "warning"
    | "statistic"
    | "framework"
    | "exercise"
    | "question";
  title: string;
  finding_text: string;
  confidence: "low" | "medium" | "moderate" | "high" | null;
  evidence_strength: string | null;
  source_basis: "public_sources" | "uploaded_text" | "mixed";
  is_preliminary: boolean;
  external_source_ids: string[];
  related_topics: string[];
  linked_question_ids: string[];
  linked_checklist_task_ids: string[];
  ai_generated: boolean;
  review_status: "needs_review" | "approved" | "rejected" | "edited";
  created_at: string;
  updated_at: string;
};

export type ResearchProcessingJob = {
  id: string;
  source_id: string;
  family_id: string | null;
  job_type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress_percent: number;
  current_stage: string | null;
  error_code: string | null;
  safe_error_message: string | null;
  ai_provider: string | null;
  model_name: string | null;
  prompt_version: string | null;
  source_count: number;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ResearchCoverageComparison = {
  id: string;
  research_source_id: string;
  claim_key: string;
  claim_text: string;
  comparison_status:
    | "confirmed_by_uploaded_text"
    | "expanded_by_uploaded_text"
    | "not_supported_by_uploaded_text"
    | "contradicted_by_uploaded_text"
    | "still_uncertain";
  public_overview_id: string | null;
  notes: string | null;
  created_at: string;
};

export type ResearchSourceCoverage = {
  public_sources_reviewed: number;
  uploaded_files: number;
  book_pages_processed: number;
  chapters_processed: number;
  full_book_processed: boolean;
  public_overview: "not_started" | "queued" | "processing" | "complete" | "failed";
  source_grounded_analysis: "not_started" | "queued" | "processing" | "complete" | "failed";
};
