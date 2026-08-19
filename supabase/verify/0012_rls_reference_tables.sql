-- Manual verification for 0012 (run in Supabase SQL Editor as postgres).
-- Does not mutate family answers.

-- 1. RLS enabled
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('question_options', 'outcome_development_maps', 'questions', 'outcomes')
order by 1;

-- 2. Policies
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('question_options', 'outcome_development_maps')
order by tablename, policyname;

-- 3. Privileges
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('question_options', 'outcome_development_maps')
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by table_name, grantee, privilege_type;

-- 4. Row counts (content must be unchanged)
select 'question_options' as table_name, count(*)::bigint as n from public.question_options
union all
select 'outcome_development_maps', count(*)::bigint from public.outcome_development_maps
union all
select 'questions', count(*)::bigint from public.questions;
