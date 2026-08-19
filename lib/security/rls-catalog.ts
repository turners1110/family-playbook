/**
 * Explicit classification of every public table created by migrations.
 * A newly added CREATE TABLE in supabase/migrations must be registered here.
 */

export const RLS_CATEGORIES = [
  "family_scoped",
  "global_reference_readonly",
  "service_role_only",
  "intentionally_public",
] as const;

export type RlsCategory = (typeof RLS_CATEGORIES)[number];

export type TablePolicySummary = {
  select: string;
  insert: string;
  update: string;
  delete: string;
};

export type PublicTableSecurity = {
  table: string;
  created_in: string;
  rls_enabled_before: boolean;
  rls_enabled_after: boolean;
  rls_enabled_in: string | null;
  category: RlsCategory;
  family_scoped: boolean;
  policies: TablePolicySummary;
  anon_access: string;
  authenticated_access: string;
  service_role_access: string;
  intended: string;
  current: string;
  mismatch_before: boolean;
  mismatch_after: boolean;
  notes?: string;
};

const familyAll: TablePolicySummary = {
  select: "family_id in user_family_ids()",
  insert: "family_id in user_family_ids()",
  update: "family_id in user_family_ids()",
  delete: "family_id in user_family_ids()",
};

const familySelectOnly: TablePolicySummary = {
  select: "family_id in user_family_ids()",
  insert: "denied (no policy)",
  update: "denied (no policy)",
  delete: "denied (no policy)",
};

const globalRead: TablePolicySummary = {
  select: "authenticated USING (true)",
  insert: "denied (no policy + revoke)",
  update: "denied (no policy + revoke)",
  delete: "denied (no policy + revoke)",
};

const serviceOnly: TablePolicySummary = {
  select: "none for anon/authenticated (RLS + revoke)",
  insert: "none for anon/authenticated",
  update: "none for anon/authenticated",
  delete: "none for anon/authenticated",
};

function familyTable(
  table: string,
  created_in: string,
  policies: TablePolicySummary,
  extras: Partial<PublicTableSecurity> = {},
): PublicTableSecurity {
  return {
    table,
    created_in,
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: created_in === "0001_init.sql" ? "0001_init.sql" : created_in,
    category: "family_scoped",
    family_scoped: true,
    policies,
    anon_access: "deny (RLS; auth.uid empty)",
    authenticated_access: "own family only",
    service_role_access: "bypass RLS; full",
    intended: "Family-scoped product data",
    current: "Family-scoped RLS",
    mismatch_before: false,
    mismatch_after: false,
    ...extras,
  };
}

export const PUBLIC_TABLE_SECURITY: PublicTableSecurity[] = [
  familyTable("families", "0001_init.sql", familySelectOnly, {
    intended: "Read own family row; create via setup/service role",
  }),
  {
    table: "profiles",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0002_auth_and_identity.sql",
    category: "family_scoped",
    family_scoped: true,
    policies: {
      select: "own row or family co-members",
      insert: "own id = auth.uid()",
      update: "own id = auth.uid()",
      delete: "denied (using false)",
    },
    anon_access: "deny",
    authenticated_access: "own profile + family co-members read",
    service_role_access: "full",
    intended: "Auth profile identity",
    current: "RLS via 0002",
    mismatch_before: false,
    mismatch_after: false,
  },
  familyTable("family_members", "0001_init.sql", familySelectOnly, {
    rls_enabled_in: "0001_init.sql",
    notes: "0002 restates select policy TO authenticated",
  }),
  familyTable("children", "0001_init.sql", familyAll),
  {
    table: "life_stages",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0001_init.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny (policy TO authenticated)",
    authenticated_access: "SELECT only",
    service_role_access: "full (seed)",
    intended: "Global taxonomy read",
    current: "authenticated SELECT",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "categories",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0001_init.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny",
    authenticated_access: "SELECT only",
    service_role_access: "full",
    intended: "Global taxonomy read",
    current: "authenticated SELECT",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "outcome_domains",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0001_init.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny",
    authenticated_access: "SELECT only",
    service_role_access: "full",
    intended: "Global taxonomy read",
    current: "authenticated SELECT",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "outcomes",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0001_init.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny",
    authenticated_access: "SELECT only",
    service_role_access: "full",
    intended: "Global taxonomy read",
    current: "authenticated SELECT",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "outcome_development_maps",
    created_in: "0001_init.sql",
    rls_enabled_before: false,
    rls_enabled_after: true,
    rls_enabled_in: "0012_secure_reference_tables.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny after 0012",
    authenticated_access: "SELECT only after 0012",
    service_role_access: "full",
    intended: "Global reference read-only",
    current: "Secured in 0012 (was missing RLS)",
    mismatch_before: true,
    mismatch_after: false,
    notes: "Audit finding VALID. Sibling outcomes table had RLS; this table did not.",
  },
  familyTable("principles", "0001_init.sql", {
    select: "family_id is null OR family_id in user_family_ids()",
    insert: "denied (no policy)",
    update: "denied (no policy)",
    delete: "denied (no policy)",
  }),
  {
    table: "questions",
    created_in: "0001_init.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0001_init.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny",
    authenticated_access: "SELECT only",
    service_role_access: "full",
    intended: "Canonical question bank; mutate via seed/service role",
    current: "authenticated SELECT",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "question_options",
    created_in: "0001_init.sql",
    rls_enabled_before: false,
    rls_enabled_after: true,
    rls_enabled_in: "0012_secure_reference_tables.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: globalRead,
    anon_access: "deny after 0012",
    authenticated_access: "SELECT only after 0012",
    service_role_access: "full",
    intended: "Global reference read-only",
    current: "Secured in 0012 (was missing RLS)",
    mismatch_before: true,
    mismatch_after: false,
    notes: "Audit finding VALID. Sibling questions table had RLS; this table did not.",
  },
  familyTable("answers", "0001_init.sql", familyAll, {
    notes: "Live product answers primarily live in family_json_stores; this table remains protected.",
  }),
  familyTable("answer_versions", "0001_init.sql", {
    select: "via parent answers family_id",
    insert: "denied (no policy)",
    update: "denied (no policy)",
    delete: "denied (no policy)",
  }),
  familyTable("decisions", "0001_init.sql", familyAll),
  familyTable("decision_versions", "0001_init.sql", {
    select: "via parent decisions family_id",
    insert: "denied (no policy)",
    update: "denied (no policy)",
    delete: "denied (no policy)",
  }),
  familyTable("sessions", "0001_init.sql", familyAll),
  familyTable("session_questions", "0001_init.sql", {
    select: "via parent sessions family_id",
    insert: "via parent sessions family_id",
    update: "via parent sessions family_id",
    delete: "via parent sessions family_id",
  }),
  familyTable("knowledge_items", "0001_init.sql", {
    select: "family_id is null OR family_id in user_family_ids()",
    insert: "family_id in user_family_ids()",
    update: "family_id in user_family_ids()",
    delete: "family_id in user_family_ids()",
  }),
  familyTable("cooling_off_items", "0001_init.sql", familyAll),
  familyTable("reviews", "0001_init.sql", familyAll),
  familyTable("bookmarks", "0001_init.sql", familyAll),
  familyTable("activity_log", "0001_init.sql", familyAll),
  familyTable("family_settings", "0001_init.sql", familyAll, {
    notes: "0002 restates policy TO authenticated",
  }),
  familyTable("ai_outputs", "0001_init.sql", familyAll),
  familyTable("playbook_versions", "0001_init.sql", familyAll),
  {
    table: "family_json_stores",
    created_in: "0003_remote_json_store.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0003_remote_json_store.sql",
    category: "service_role_only",
    family_scoped: true,
    policies: serviceOnly,
    anon_access: "REVOKE ALL",
    authenticated_access: "REVOKE ALL",
    service_role_access: "GRANT ALL + RPC replace_family_json_store",
    intended: "Shared Turner AppStore JSONB; never PostgREST for family users",
    current: "service_role only",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "family_json_store_versions",
    created_in: "0003_remote_json_store.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0003_remote_json_store.sql",
    category: "service_role_only",
    family_scoped: true,
    policies: serviceOnly,
    anon_access: "REVOKE ALL",
    authenticated_access: "REVOKE ALL",
    service_role_access: "GRANT ALL",
    intended: "Store version history",
    current: "service_role only",
    mismatch_before: false,
    mismatch_after: false,
  },
  familyTable("research_sources", "0004_research_library.sql", familyAll, {
    rls_enabled_in: "0004_research_library.sql",
  }),
  familyTable("research_source_files", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_topics", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_life_stages", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_summaries", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_findings", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_links", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_notes", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_processing_jobs", "0004_research_library.sql", {
    select: "via research_sources.family_id (source_id)",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_conflicts", "0004_research_library.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  {
    table: "family_json_store_mutations",
    created_in: "0006_remote_store_mutations.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0006_remote_store_mutations.sql",
    category: "service_role_only",
    family_scoped: true,
    policies: serviceOnly,
    anon_access: "REVOKE ALL",
    authenticated_access: "REVOKE ALL",
    service_role_access: "GRANT ALL",
    intended: "Optimistic-lock mutation ids",
    current: "service_role only",
    mismatch_before: false,
    mismatch_after: false,
  },
  {
    table: "research_recommended_sources",
    created_in: "0007_seed_recommended_library.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0007_seed_recommended_library.sql",
    category: "global_reference_readonly",
    family_scoped: false,
    policies: {
      select: "authenticated USING (true)",
      insert: "denied",
      update: "denied",
      delete: "denied",
    },
    anon_access: "REVOKE from public",
    authenticated_access: "GRANT SELECT",
    service_role_access: "GRANT ALL",
    intended: "Catalog of recommended books",
    current: "authenticated SELECT + service writes",
    mismatch_before: false,
    mismatch_after: false,
  },
  familyTable("research_recommended_family_state", "0007_seed_recommended_library.sql", {
    select: "family_id in user_family_ids()",
    insert: "family_id in user_family_ids()",
    update: "family_id in user_family_ids()",
    delete: "family_id in user_family_ids()",
  }),
  familyTable("research_external_sources", "0008_public_book_research.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_public_overviews", "0008_public_book_research.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_coverage_comparisons", "0008_public_book_research.sql", {
    select: "via research_sources.family_id",
    insert: "via research_sources.family_id",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  familyTable("research_source_documents", "0009_epub_documents.sql", {
    select: "via research_sources.family_id; GRANT SELECT authenticated",
    insert: "via research_sources.family_id (service typically)",
    update: "via research_sources.family_id",
    delete: "via research_sources.family_id",
  }),
  {
    table: "research_source_chapters",
    created_in: "0009_epub_documents.sql",
    rls_enabled_before: true,
    rls_enabled_after: true,
    rls_enabled_in: "0009_epub_documents.sql",
    category: "service_role_only",
    family_scoped: true,
    policies: {
      select: "RLS family policy exists; GRANT revoked from authenticated/anon",
      insert: "service_role",
      update: "service_role",
      delete: "service_role",
    },
    anon_access: "REVOKE ALL",
    authenticated_access: "REVOKE ALL (chapter full text)",
    service_role_access: "GRANT ALL",
    intended: "Copyrighted chapter text not exposed via PostgREST",
    current: "service_role grants + family RLS",
    mismatch_before: false,
    mismatch_after: false,
  },
];

export const SECURE_REFERENCE_TABLES = [
  "question_options",
  "outcome_development_maps",
] as const;

export function publicTableNames(): string[] {
  return PUBLIC_TABLE_SECURITY.map((t) => t.table);
}

export function uncategorizedIsForbidden(): true {
  return true;
}
