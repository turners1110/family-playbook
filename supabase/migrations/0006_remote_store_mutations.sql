-- Trip Online Mode — mutation idempotency + strengthened atomic replace RPC.
-- Apply after 0003_remote_json_store.sql.
--
-- Keeps optimistic locking. Adds:
--   * family_json_store_mutations for duplicate mutation_id protection
--   * p_mutation_id on replace_family_json_store
-- History insert + current-store update remain in one plpgsql transaction.

create table if not exists public.family_json_store_mutations (
  family_id uuid not null references public.families(id) on delete cascade,
  mutation_id text not null,
  result_version bigint not null,
  operation text null,
  created_at timestamptz not null default now(),
  primary key (family_id, mutation_id)
);

create index if not exists family_json_store_mutations_family_created_idx
  on public.family_json_store_mutations (family_id, created_at desc);

alter table public.family_json_store_mutations enable row level security;

revoke all on table public.family_json_store_mutations from public;
revoke all on table public.family_json_store_mutations from anon, authenticated;
grant all on table public.family_json_store_mutations to service_role;

-- Drop prior overloads so callers use the extended jsonb-returning signature.
drop function if exists public.replace_family_json_store(uuid, bigint, jsonb, text);
drop function if exists public.replace_family_json_store(uuid, bigint, jsonb, text, text);

create or replace function public.replace_family_json_store(
  p_family_id uuid,
  p_expected_version bigint,
  p_new_data jsonb,
  p_created_by text default null,
  p_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_version bigint;
  v_prior_data jsonb;
  v_new_version bigint;
  v_updated int;
  v_existing_version bigint;
begin
  -- Idempotent replay: same mutation_id must not re-apply.
  if p_mutation_id is not null and length(trim(p_mutation_id)) > 0 then
    select result_version
      into v_existing_version
    from public.family_json_store_mutations
    where family_id = p_family_id
      and mutation_id = p_mutation_id;

    if found then
      return jsonb_build_object(
        'version', v_existing_version,
        'idempotent_replay', true
      );
    end if;
  end if;

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

  if p_mutation_id is not null and length(trim(p_mutation_id)) > 0 then
    insert into public.family_json_store_mutations (
      family_id, mutation_id, result_version, operation
    )
    values (p_family_id, p_mutation_id, v_new_version, p_created_by)
    on conflict (family_id, mutation_id) do nothing;
  end if;

  -- Keep recent mutation ids only.
  delete from public.family_json_store_mutations
  where family_id = p_family_id
    and mutation_id in (
      select mutation_id
      from public.family_json_store_mutations
      where family_id = p_family_id
      order by created_at desc
      offset 500
    );

  delete from public.family_json_store_versions
  where family_id = p_family_id
    and id in (
      select id
      from public.family_json_store_versions
      where family_id = p_family_id
      order by version desc
      offset 50
    );

  return jsonb_build_object(
    'version', v_new_version,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.replace_family_json_store(uuid, bigint, jsonb, text, text) from public;
revoke all on function public.replace_family_json_store(uuid, bigint, jsonb, text, text) from anon, authenticated;
grant execute on function public.replace_family_json_store(uuid, bigint, jsonb, text, text) to service_role;
