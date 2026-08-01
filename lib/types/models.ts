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
  /** Exactly one primary discussion timing window (seeded/migrated). */
  primary_discussion_stage?: LifeStage | null;
  /** Optional later review stages (not equal to primary). */
  review_stages?: LifeStage[];
  /** Optional event that should resurface this question. */
  trigger_event?: string | null;
  /** Why this question is timed the way it is. */
  timing_reason?: string | null;
  /** True when primary stage was set by deterministic rules, not manual edit. */
  primary_stage_source?: "seeded" | "rule_based" | "manual" | null;
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
  /** Responsibility matrix: row label → owner label. */
  matrix?: Record<string, string>;
  /** Named people / support list. */
  named_people?: string[];
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
  include_answered?: boolean;
  review_changed?: boolean;
  review_undecided?: boolean;
  review_due?: boolean;
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
  /** Family expected due date (YYYY-MM-DD). Drives Before Baby scheduling. */
  expected_due_date?: string | null;
  /** Actual birth date (YYYY-MM-DD). When set, post-birth tasks recalculate from this. */
  actual_birth_date?: string | null;
  before_baby_scheduling_mode?: BeforeBabySchedulingMode;
  /** Preferred weekdays 0=Sun … 6=Sat for flexible task placement. */
  before_baby_preferred_task_days?: number[];
  before_baby_max_tasks_per_week?: number | null;
  before_baby_weekend_heavy?: boolean;
  before_baby_include_post_birth?: boolean;
  before_baby_hide_completed?: boolean;
  /** YYYY-MM-DD dates to avoid when placing flexible tasks. */
  before_baby_avoid_travel_dates?: string[];
  updated_at: string;
}

export type BeforeBabySchedulingMode =
  | "recommended"
  | "earlier"
  | "compact"
  | "manual_only";

export type ChecklistTimingType =
  | "before_birth"
  | "after_birth"
  | "exact_date"
  | "no_date";

export type ChecklistTimingFlexibility = "fixed" | "flexible" | "optional";

export type ChecklistDateSource = "calculated" | "manual" | "none";

export type ChecklistTimelineBadge =
  | "overdue"
  | "do_now"
  | "due_this_week"
  | "upcoming"
  | "final_month"
  | "final_week"
  | "after_birth"
  | "no_date"
  | "completed";

export type ChecklistTimelineGroup =
  | "overdue"
  | "do_now"
  | "due_this_week"
  | "due_next_week"
  | "due_next_2_weeks"
  | "final_month"
  | "final_week"
  | "later"
  | "after_birth"
  | "completed"
  | "no_date";


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

export type ChecklistOwner = "sam" | "michelle" | "both";
export type ChecklistPriority = "high" | "medium" | "low";

export interface ChecklistInstance {
  id: string;
  family_id: string;
  template_slug: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export type ChecklistDependencyStatus =
  | "open"
  | "blocked"
  | "satisfied"
  | "overridden";

export type ChecklistOwnershipSource =
  | "suggested"
  | "explicit"
  | "bulk"
  | "default"
  | "decide_later";

export type ChecklistTimingWindowLabel =
  | "second_trimester"
  | "early_third_trimester"
  | "by_30_weeks"
  | "by_32_weeks"
  | "by_34_weeks"
  | "by_36_weeks"
  | "final_two_weeks"
  | "final_week"
  | "after_birth"
  | "triggered_after_birth"
  | "unscheduled";

export type ChecklistTaskTag =
  | "setup"
  | "assembly"
  | "purchase"
  | "legal"
  | "insurance"
  | "provider_selection"
  | "training"
  | "final_check"
  | "confirm_with_provider";

export interface ChecklistTask {
  id: string;
  checklist_id: string;
  template_task_slug: string | null;
  title: string;
  category: string;
  category_label: string;
  completed: boolean;
  completed_at: string | null;
  /** Effective display due date (manual or calculated). */
  due_date: string | null;
  priority: ChecklistPriority;
  owner: ChecklistOwner;
  /** Optional contributor (other parent) when owner is not both. */
  contributor?: ChecklistOwner | null;
  joint_approval_required?: boolean;
  ownership_source?: ChecklistOwnershipSource | null;
  ownership_updated_at?: string | null;
  notes: string | null;
  is_custom: boolean;
  is_default: boolean;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Days relative to scheduling anchor (negative = before birth). */
  recommended_start_offset_days?: number | null;
  recommended_due_offset_days?: number | null;
  /** Alias preferred by content architecture; mirrors recommended_due_offset_days. */
  recommended_target_offset_days?: number | null;
  hard_deadline_offset_days?: number | null;
  timing_reason?: string | null;
  timing_window_label?: ChecklistTimingWindowLabel | null;
  timing_flexibility?: ChecklistTimingFlexibility;
  timing_type?: ChecklistTimingType;
  provider_confirmation_needed?: boolean;
  task_tags?: ChecklistTaskTag[];
  manual_due_date?: string | null;
  calculated_due_date?: string | null;
  calculated_start_date?: string | null;
  date_source?: ChecklistDateSource;
  /** True when post-birth date is still estimated from due date. */
  date_estimated?: boolean;
  /** Task IDs this task depends on (prerequisites). */
  depends_on_task_ids?: string[];
  /** Template slugs used when IDs are not yet resolved. */
  depends_on_template_slugs?: string[];
  blocked_by_count?: number;
  dependency_status?: ChecklistDependencyStatus;
  dependency_reason?: string | null;
  dependency_override?: boolean;
  /** Optional milestone id this task belongs to. */
  milestone_id?: string | null;
  /** House-reset style nested checklist steps (title only). */
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
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
  checklist_instances: ChecklistInstance[];
  checklist_tasks: ChecklistTask[];
  current_user_id: string;
  demo_mode: boolean;
}
