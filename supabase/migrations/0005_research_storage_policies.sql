-- Private research source file storage.
-- Bucket: research-sources
-- Only trusted server code should mint signed download URLs.
-- Browser clients must never receive the service-role key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-sources',
  'research-sources',
  false,
  52428800, -- 50 MiB
  array[
    'application/pdf',
    'application/epub+zip',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths are: {family_id}/{source_id}/{filename}
-- Authenticated family members can upload/read/delete their family folder only.
-- Trip Mode / emergency access uses the service role on the server (bypasses RLS).

create policy research_sources_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'research-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.families
      where id in (select public.user_family_ids())
    )
  );

create policy research_sources_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'research-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.families
      where id in (select public.user_family_ids())
    )
  );

create policy research_sources_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'research-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.families
      where id in (select public.user_family_ids())
    )
  )
  with check (
    bucket_id = 'research-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.families
      where id in (select public.user_family_ids())
    )
  );

create policy research_sources_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'research-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.families
      where id in (select public.user_family_ids())
    )
  );
