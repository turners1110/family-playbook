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
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  archived_at: string | null;
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

export type ResearchSourceCard = ResearchSource & {
  finding_count: number;
  linked_question_count: number;
  linked_principle_count: number;
  has_summary: boolean;
  file_count: number;
};

export type ResearchLibraryStore = {
  sources: ResearchSource[];
  files: ResearchSourceFile[];
  summaries: ResearchSourceSummary[];
  notes: ResearchSourceNote[];
  links: ResearchSourceLink[];
};
