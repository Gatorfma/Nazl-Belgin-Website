-- Run after 01_schema.sql, 02_seed_content.sql, 03_authorize_artist.sql,
-- and the media migration. Every block is read-only and aborts on drift.

do $$
declare
  missing_tables integer;
begin
  select count(*) into missing_tables
  from unnest(array['studio_users','artworks','media_items','cv_entries']) wanted(name)
  where to_regclass('public.' || wanted.name) is null;
  if missing_tables <> 0 then
    raise exception 'Missing % required public tables', missing_tables;
  end if;
end $$;

do $$
declare
  missing_functions integer;
begin
  select count(*) into missing_functions
  from unnest(array[
    'public.is_studio_user()',
    'public.reorder_artworks(uuid[])',
    'public.reorder_media(text,text,uuid[])',
    'public.reorder_cv(text,uuid[])'
  ]) wanted(signature)
  where to_regprocedure(wanted.signature) is null;
  if missing_functions <> 0 then
    raise exception 'Missing % required public functions', missing_functions;
  end if;
end $$;

do $$
declare
  insecure_tables text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into insecure_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('studio_users','artworks','media_items','cv_entries')
    and not c.relrowsecurity;
  if insecure_tables is not null then
    raise exception 'RLS is disabled for: %', insecure_tables;
  end if;
end $$;

do $$
declare
  bucket_ok boolean;
begin
  select public and file_size_limit = 104857600 into bucket_ok
  from storage.buckets where id = 'site-media';
  if coalesce(bucket_ok, false) is not true then
    raise exception 'site-media bucket is missing, private, or has the wrong size limit';
  end if;
end $$;

do $$
declare
  studio_count integer;
begin
  select count(*) into studio_count from public.studio_users;
  if studio_count <> 1 then
    raise exception 'Expected exactly one studio user, found %', studio_count;
  end if;
end $$;

do $$
declare
  invalid_count integer;
begin
  select
    (select count(*) from public.media_items
      where kind not in ('portrait','canvas_video','youtube','spotify_image')) +
    (select count(*) from public.cv_entries
      where category not in ('exhibition','project','fair'))
  into invalid_count;
  if invalid_count <> 0 then
    raise exception 'Found % rows with unsupported kind/category', invalid_count;
  end if;
end $$;

do $$
declare
  duplicate_groups integer;
begin
  select
    (select count(*) from (
      select sort_order from public.artworks group by sort_order having count(*) > 1
    ) duplicates) +
    (select count(*) from (
      select kind, group_name, sort_order from public.media_items
      group by kind, group_name, sort_order having count(*) > 1
    ) duplicates) +
    (select count(*) from (
      select category, sort_order from public.cv_entries
      group by category, sort_order having count(*) > 1
    ) duplicates)
  into duplicate_groups;
  if duplicate_groups <> 0 then
    raise exception 'Found % duplicate display-order groups', duplicate_groups;
  end if;
end $$;

do $$
declare
  missing_sources integer;
begin
  select count(*) into missing_sources
  from public.media_items
  where kind <> 'youtube' and coalesce(storage_path, legacy_path) is null;
  if missing_sources <> 0 then
    raise exception 'Found % file-backed media rows without a source', missing_sources;
  end if;
end $$;

do $$
declare
  artwork_count integer;
  media_count integer;
  cv_count integer;
begin
  select count(*) into artwork_count from public.artworks;
  select count(*) into media_count from public.media_items;
  select count(*) into cv_count from public.cv_entries;
  if artwork_count <> 41 or media_count <> 20 or cv_count <> 15 then
    raise exception 'Unexpected seed counts: artworks %, media %, CV %',
      artwork_count, media_count, cv_count;
  end if;
end $$;

select 'artworks' as relation, count(*) as rows from public.artworks
union all select 'media_items', count(*) from public.media_items
union all select 'cv_entries', count(*) from public.cv_entries
union all select 'studio_users', count(*) from public.studio_users
order by relation;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname = 'public' and tablename in ('studio_users','artworks','media_items','cv_entries'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'site-media';

select u.email, s.user_id, s.created_at
from public.studio_users s
join auth.users u on u.id = s.user_id;
