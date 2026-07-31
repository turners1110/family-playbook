-- Turner Family Principles — auth identity and profile policies
-- Safe to run once after 0001_init.sql

-- ---------------------------------------------------------------------------
-- Profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when profiles.display_name is null or profiles.display_name = '' then excluded.display_name
          else profiles.display_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill profiles for any existing auth users missing a row
insert into public.profiles (id, email, display_name)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'member'), '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_family on public.profiles;
create policy profiles_select_family on public.profiles
  for select to authenticated
  using (
    id in (
      select fm.user_id
      from public.family_members fm
      where fm.family_id in (select public.user_family_ids())
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Ordinary users may only insert their own profile (callback fallback).
-- Primary creation path is the security-definer trigger on auth.users.

drop policy if exists profiles_insert_deny on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_delete_deny on public.profiles;
create policy profiles_delete_deny on public.profiles
  for delete to authenticated
  using (false);

-- Ensure family members in the same family remain readable
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select to authenticated
  using (family_id in (select public.user_family_ids()));

-- Family settings readable/writable only within the member's family
drop policy if exists settings_all on public.family_settings;
create policy settings_all on public.family_settings
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));
