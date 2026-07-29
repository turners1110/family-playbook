import type {
  ConfidenceLevel,
  DecisionStatus,
  DecisionType,
  EvidenceQuality,
  KnowledgeType,
  LifeStage,
  OutcomeDomain,
  QuestionPriority,
  QuestionType,
  ResearchMode,
  SessionLength,
} from "@/lib/constants/enums";

export interface Family {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  role: "parent" | "caregiver" | "child" | "other";
  sort_order: number;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  display_name: string;
  birth_date: string | null;
  expected_due_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface LifeStageRecord {
  id: string;
  slug: LifeStage;
  label: string;
  sort_order: number;
  babymoon_weighted: boolean;
}

export interface Category {
  id: string;
  slug: string;
  label: string;
  parent_slug: string | null;
  sort_order: number;
}

export interface OutcomeDomainRecord {
  id: string;
  slug: OutcomeDomain;
  label: string;
  sort_order: number;
}

export interface Outcome {
  id: string;
  slug: string;
  domain_slug: OutcomeDomain;
  label: string;
  definition: string;
  why_it_matters: string;
  healthy_development: string;
  sort_order: number;
}

export interface OutcomeDevelopmentMap {
  id: string;
  outcome_id: string;
  age_range: string;
  guidance: string[];
  sort_order: number;
}

export interface Principle {
  id: string;
  family_id: string | null;
  slug: string;
  title: string;
  statement: string;
  sort_order: number;
}

export interface Question {
  id: string;
  slug: string;
  text: string;
  short_title: string;
  why_it_matters: string;
  discussion_guidance: string;
  question_type: QuestionType;
  response_schema: Record<string, unknown>;
  life_stages: LifeStage[];
  categories: string[];
  subcategories: string[];
  outcomes: string[];
  related_principles: string[];
  related_questions: string[];
  parent_decision_dependency: string | null;
  logical_order: number;
  priority: QuestionPriority;
  estimated_minutes: number;
  emotional_weight: number;
  evidence_needed: boolean;
  evidence_available: boolean;
  evidence_summary: string | null;
  practical_tip: string | null;
  separate_answers_recommended: boolean;
  cooling_off_recommended: boolean;
  follow_up_prompts: string[];
  review_recommendation: string | null;
  child_dependent: boolean;
  required_before_birth: boolean;
  babymoon_priority: boolean;
  research_mode: ResearchMode;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  value: string;
  label: string;
  sort_order: number;
}

export interface AnswerPayload {
  text?: string;
  choice?: string | string[];
  ranking?: string[];
  scale?: number;
  quick?: string;
  notes?: string;
  agreement_notes?: string;
  disagreement_notes?: string;
}

export interface Answer {
  id: string;
  family_id: string;
  question_id: string;
  member_id: string | null;
  is_shared: boolean;
  payload: AnswerPayload;
  status: DecisionStatus;
  confidence: ConfidenceLevel;
  bookmarked: boolean;
  needs_research: boolean;
  review_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AnswerVersion {
  id: string;
  answer_id: string;
  version: number;
  payload: AnswerPayload;
  status: DecisionStatus;
  confidence: ConfidenceLevel;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  family_id: string;
  title: string;
  statement: string;
  problem: string | null;
  reasoning: string | null;
  sam_perspective: string | null;
  michelle_perspective: string | null;
  shared_conclusion: string | null;
  agreement_notes: string | null;
  disagreement_notes: string | null;
  status: DecisionStatus;
  confidence: ConfidenceLevel;
  decision_type: DecisionType;
  evidence_strength: EvidenceQuality;
  emotional_weight: number;
  reversibility: "easy" | "moderate" | "hard" | "permanent" | null;
  child_dependent: boolean;
  life_stages: LifeStage[];
  categories: string[];
  research_notes: string | null;
  implementation_notes: string | null;
  exceptions: string | null;
  risks: string | null;
  warning_signs: string | null;
  reconsideration_conditions: string | null;
  review_date: string | null;
  has_disagreement: boolean;
  version: number;
  source_question_ids: string[];
  outcome_ids: string[];
  principle_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DecisionVersion {
  id: string;
  decision_id: string;
  version: number;
  snapshot: Partial<Decision>;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  length: SessionLength;
  status: "active" | "paused" | "completed";
  filters: SessionFilters;
  current_index: number;
  note: string | null;
  babymoon_mode: boolean;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface SessionFilters {
  life_stage?: LifeStage;
  category?: string;
  outcome?: string;
  only_unanswered?: boolean;
  include_unresolved?: boolean;
  include_research?: boolean;
  include_separate?: boolean;
  include_high_priority?: boolean;
  include_practical?: boolean;
  include_philosophical?: boolean;
  include_evidence?: boolean;
  preset?: string;
}

export interface SessionQuestion {
  id: string;
  session_id: string;
  question_id: string;
  sort_order: number;
  status: "pending" | "answered" | "skipped";
  answered_at: string | null;
}

export interface KnowledgeItem {
  id: string;
  family_id: string | null;
  title: string;
  summary: string;
  item_type: KnowledgeType;
  source: string | null;
  author: string | null;
  publication: string | null;
  publication_date: string | null;
  url: string | null;
  source_type: string | null;
  evidence_quality: EvidenceQuality;
  life_stages: LifeStage[];
  categories: string[];
  related_question_ids: string[];
  related_decision_ids: string[];
  related_outcome_ids: string[];
  notes: string | null;
  is_sample: boolean;
  date_added: string;
  date_reviewed: string | null;
}

export interface CoolingOffItem {
  id: string;
  family_id: string;
  question_id: string | null;
  decision_id: string | null;
  start_date: string;
  wait_days: number;
  reason: string;
  revisit_date: string;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface ReviewItem {
  id: string;
  family_id: string;
  entity_type: "question" | "answer" | "decision" | "outcome" | "principle";
  entity_id: string;
  review_date: string;
  reason: string | null;
  completed: boolean;
  created_at: string;
}

export interface Bookmark {
  id: string;
  family_id: string;
  member_id: string;
  question_id: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  family_id: string;
  actor_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FamilySettings {
  family_id: string;
  hide_partner_answers_until_both_saved: boolean;
  dark_mode: "system" | "light" | "dark";
  babymoon_target_date: string | null;
  babymoon_daily_questions: number;
  include_perspective_history_in_playbook: boolean;
  updated_at: string;
}

export interface AiOutput {
  id: string;
  family_id: string;
  purpose: string;
  prompt: string;
  output: string;
  approved: boolean;
  model: string;
  created_at: string;
}

export interface PlaybookVersion {
  id: string;
  family_id: string;
  version_date: string;
  completion_status: number;
  include_perspective_history: boolean;
  sections: PlaybookSection[];
  created_at: string;
}

export interface PlaybookSection {
  slug: string;
  title: string;
  content: string;
  decision_ids: string[];
  outcome_ids: string[];
  unresolved_ids: string[];
  coverage: "strong" | "moderate" | "weak" | "empty";
  ai_placeholder: boolean;
}

export interface AppStore {
  family: Family;
  users: UserProfile[];
  members: FamilyMember[];
  children: Child[];
  life_stages: LifeStageRecord[];
  categories: Category[];
  outcome_domains: OutcomeDomainRecord[];
  outcomes: Outcome[];
  development_maps: OutcomeDevelopmentMap[];
  principles: Principle[];
  questions: Question[];
  question_options: QuestionOption[];
  answers: Answer[];
  answer_versions: AnswerVersion[];
  decisions: Decision[];
  decision_versions: DecisionVersion[];
  sessions: Session[];
  session_questions: SessionQuestion[];
  knowledge_items: KnowledgeItem[];
  cooling_off_items: CoolingOffItem[];
  reviews: ReviewItem[];
  bookmarks: Bookmark[];
  activity_log: ActivityLogEntry[];
  settings: FamilySettings;
  ai_outputs: AiOutput[];
  playbook_versions: PlaybookVersion[];
  current_user_id: string;
  demo_mode: boolean;
}
