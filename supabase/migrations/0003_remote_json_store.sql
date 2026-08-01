-- Turner Family Principles — temporary remote JSON store bridge (Trip Online Mode)
-- Apply after 0001_init.sql and 0002_auth_and_identity.sql.
--
-- Security model:
--   * These tables hold the full application JSON store (answers, decisions, etc.).
--   * They must NEVER be exposed to the browser or to the anon/authenticated roles.
--   * Access is via the Supabase service role from trusted Next.js server code only
--     (lib/db/remote-json-store.ts, scripts/upload-local-store.ts).
--   * RLS is enabled with NO policies for anon/authenticated → all client access denied.
--   * Grants are revoked from PUBLIC / anon / authenticated; service_role retains access.
--   * Do not add browser Supabase queries against these tables.

create table if not exists public.family_json_stores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  store_data jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_json_store_versions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  version bigint not null,
  store_data jsonb not null,
  created_at timestamptz not null default now(),
  created_by text null,
  unique (family_id, version)
);

create index if not exists family_json_stores_family_id_idx
  on public.family_json_stores (family_id);

create index if not exists family_json_store_versions_family_id_idx
  on public.family_json_store_versions (family_id);

create index if not exists family_json_store_versions_family_version_idx
  on public.family_json_store_versions (family_id, version);

create index if not exists family_json_store_versions_created_at_idx
  on public.family_json_store_versions (created_at);

-- Atomic replace: snapshot prior version, bump current row, prune to 50 history rows.
create or replace function public.replace_family_json_store(
  p_family_id uuid,
  p_expected_version bigint,
  p_new_data jsonb,
  p_created_by text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_version bigint;
  v_prior_data jsonb;
  v_new_version bigint;
  v_updated int;
begin
  select version, store_data
    into v_current_version, v_prior_data
  from public.family_json_stores
  where family_id = p_family_id
  for update;

  if not found then
    raise exception 'family_json_store_not_found';
  end if;

  if v_current_version is distinct from p_expected_version then
    raise exception 'family_json_store_version_conflict'
      using detail = format('expected %s got %s', p_expected_version, v_current_version);
  end if;

  insert into public.family_json_store_versions (family_id, version, store_data, created_by)
  values (p_family_id, v_current_version, v_prior_data, p_created_by)
  on conflict (family_id, version) do nothing;

  v_new_version := v_current_version + 1;

  update public.family_json_stores
  set store_data = p_new_data,
      version = v_new_version,
      updated_at = now()
  where family_id = p_family_id
    and version = p_expected_version;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'family_json_store_version_conflict';
  end if;

  delete from public.family_json_store_versions
  where family_id = p_family_id
    and id in (
      select id
      from public.family_json_store_versions
      where family_id = p_family_id
      order by version desc
      offset 50
    );

  return v_new_version;
end;
$$;

revoke all on function public.replace_family_json_store(uuid, bigint, jsonb, text) from public;
revoke all on function public.replace_family_json_store(uuid, bigint, jsonb, text) from anon, authenticated;
grant execute on function public.replace_family_json_store(uuid, bigint, jsonb, text) to service_role;

alter table public.family_json_stores enable row level security;
alter table public.family_json_store_versions enable row level security;

-- No policies for anon/authenticated → denied by default under RLS.
revoke all on table public.family_json_stores from public;
revoke all on table public.family_json_stores from anon, authenticated;
revoke all on table public.family_json_store_versions from public;
revoke all on table public.family_json_store_versions from anon, authenticated;

grant all on table public.family_json_stores to service_role;
grant all on table public.family_json_store_versions to service_role;
