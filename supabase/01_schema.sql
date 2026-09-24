begin;

create extension if not exists pgcrypto;

create table if not exists public.studio_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text,
  year integer,
  series text not null check (length(btrim(series)) > 0),
  medium text,
  dimensions text,
  alt_text text,
  storage_path text,
  legacy_path text,
  aspect_width integer not null,
  aspect_height integer not null,
  sort_order integer not null check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artworks_year_check check (year is null or year between 1000 and 2100),
  constraint artworks_aspect_check check (aspect_width > 0 and aspect_height > 0),
  constraint artworks_source_check check (coalesce(storage_path, legacy_path) is not null),
  constraint artworks_order_unique unique (sort_order) deferrable initially immediate
);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null,
  group_name text,
  title text,
  alt_text text,
  external_url text,
  storage_path text,
  legacy_path text,
  mime_type text,
  aspect_width integer,
  aspect_height integer,
  sort_order integer not null check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_kind_check check (kind in ('portrait','canvas_video','youtube','spotify_image')),
  constraint media_aspect_check check (
    (aspect_width is null and aspect_height is null) or
    (aspect_width > 0 and aspect_height > 0)
  ),
  constraint media_mime_check check (
    mime_type is null or mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')
  ),
  constraint media_source_check check (
    (kind = 'youtube' and external_url is not null and storage_path is null and legacy_path is null) or
    (kind <> 'youtube' and external_url is null and coalesce(storage_path, legacy_path) is not null)
  ),
  constraint media_group_check check (
    (kind = 'spotify_image' and length(btrim(group_name)) > 0) or
    (kind <> 'spotify_image' and group_name is null)
  ),
  constraint media_order_unique unique nulls not distinct (kind, group_name, sort_order)
    deferrable initially immediate
);

create table if not exists public.cv_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null,
  year text not null check (length(btrim(year)) > 0),
  description text not null check (length(btrim(description)) > 0),
  sort_order integer not null check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cv_category_check check (category in ('exhibition','project','fair')),
  constraint cv_order_unique unique (category, sort_order) deferrable initially immediate
);

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artworks_set_updated_at on public.artworks;
create trigger artworks_set_updated_at before update on public.artworks
for each row execute function public.set_updated_at();
drop trigger if exists media_items_set_updated_at on public.media_items;
create trigger media_items_set_updated_at before update on public.media_items
for each row execute function public.set_updated_at();
drop trigger if exists cv_entries_set_updated_at on public.cv_entries;
create trigger cv_entries_set_updated_at before update on public.cv_entries
for each row execute function public.set_updated_at();

create or replace function public.is_studio_user()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.studio_users where user_id = auth.uid())
$$;

revoke all on function public.is_studio_user() from public;
grant execute on function public.is_studio_user() to anon, authenticated;

alter table public.studio_users enable row level security;
alter table public.artworks enable row level security;
alter table public.media_items enable row level security;
alter table public.cv_entries enable row level security;

drop policy if exists studio_user_reads_self on public.studio_users;
create policy studio_user_reads_self on public.studio_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists public_reads_published_artworks on public.artworks;
create policy public_reads_published_artworks on public.artworks for select to anon, authenticated
using (published or public.is_studio_user());
drop policy if exists studio_writes_artworks on public.artworks;
create policy studio_writes_artworks on public.artworks for all to authenticated
using (public.is_studio_user()) with check (public.is_studio_user());

drop policy if exists public_reads_published_media on public.media_items;
create policy public_reads_published_media on public.media_items for select to anon, authenticated
using (published or public.is_studio_user());
drop policy if exists studio_writes_media on public.media_items;
create policy studio_writes_media on public.media_items for all to authenticated
using (public.is_studio_user()) with check (public.is_studio_user());

drop policy if exists public_reads_published_cv on public.cv_entries;
create policy public_reads_published_cv on public.cv_entries for select to anon, authenticated
using (published or public.is_studio_user());
drop policy if exists studio_writes_cv on public.cv_entries;
create policy studio_writes_cv on public.cv_entries for all to authenticated
using (public.is_studio_user()) with check (public.is_studio_user());

revoke all on public.studio_users, public.artworks, public.media_items, public.cv_entries from anon, authenticated;
grant select on public.artworks, public.media_items, public.cv_entries to anon;
grant select, insert, update, delete on public.artworks, public.media_items, public.cv_entries to authenticated;
grant select on public.studio_users to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 104857600,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists studio_inserts_site_media on storage.objects;
create policy studio_inserts_site_media on storage.objects for insert to authenticated
with check (bucket_id = 'site-media' and public.is_studio_user());
drop policy if exists studio_selects_site_media on storage.objects;
create policy studio_selects_site_media on storage.objects for select to authenticated
using (bucket_id = 'site-media' and public.is_studio_user());
drop policy if exists studio_updates_site_media on storage.objects;
create policy studio_updates_site_media on storage.objects for update to authenticated
using (bucket_id = 'site-media' and public.is_studio_user())
with check (bucket_id = 'site-media' and public.is_studio_user());
drop policy if exists studio_deletes_site_media on storage.objects;
create policy studio_deletes_site_media on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and public.is_studio_user());

create or replace function public.reorder_artworks(ordered_ids uuid[])
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_studio_user() then raise exception 'Studio access required' using errcode = '42501'; end if;
  perform id from public.artworks for update;
  if ordered_ids is null
     or cardinality(ordered_ids) <> (select count(*) from public.artworks)
     or cardinality(ordered_ids) <> (select count(distinct value) from unnest(ordered_ids) as ids(value))
     or exists (
       select 1 from unnest(ordered_ids) as ids(value)
       where value is null or not exists (select 1 from public.artworks where id = value)
     ) then
    raise exception 'Artwork order must contain every artwork ID exactly once';
  end if;
  set constraints artworks_order_unique deferred;
  update public.artworks target
  set sort_order = source.ordinality - 1
  from unnest(ordered_ids) with ordinality as source(id, ordinality)
  where target.id = source.id;
end;
$$;

create or replace function public.reorder_media(target_kind text, target_group text, ordered_ids uuid[])
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_studio_user() then raise exception 'Studio access required' using errcode = '42501'; end if;
  if target_kind not in ('portrait','canvas_video','youtube','spotify_image') then
    raise exception 'Unsupported media kind';
  end if;
  perform id from public.media_items
  where kind = target_kind and group_name is not distinct from target_group for update;
  if ordered_ids is null
     or cardinality(ordered_ids) <> (
       select count(*) from public.media_items
       where kind = target_kind and group_name is not distinct from target_group
     )
     or cardinality(ordered_ids) <> (select count(distinct value) from unnest(ordered_ids) as ids(value))
     or exists (
       select 1 from unnest(ordered_ids) as ids(value)
       where value is null or not exists (
         select 1 from public.media_items
         where id = value and kind = target_kind and group_name is not distinct from target_group
       )
     ) then
    raise exception 'Media order must contain every target media ID exactly once';
  end if;
  set constraints media_order_unique deferred;
  update public.media_items target
  set sort_order = source.ordinality - 1
  from unnest(ordered_ids) with ordinality as source(id, ordinality)
  where target.id = source.id;
end;
$$;

create or replace function public.reorder_cv(target_category text, ordered_ids uuid[])
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_studio_user() then raise exception 'Studio access required' using errcode = '42501'; end if;
  if target_category not in ('exhibition','project','fair') then raise exception 'Unsupported CV category'; end if;
  perform id from public.cv_entries where category = target_category for update;
  if ordered_ids is null
     or cardinality(ordered_ids) <> (select count(*) from public.cv_entries where category = target_category)
     or cardinality(ordered_ids) <> (select count(distinct value) from unnest(ordered_ids) as ids(value))
     or exists (
       select 1 from unnest(ordered_ids) as ids(value)
       where value is null or not exists (
         select 1 from public.cv_entries where id = value and category = target_category
       )
     ) then
    raise exception 'CV order must contain every target category ID exactly once';
  end if;
  set constraints cv_order_unique deferred;
  update public.cv_entries target
  set sort_order = source.ordinality - 1
  from unnest(ordered_ids) with ordinality as source(id, ordinality)
  where target.id = source.id;
end;
$$;

revoke all on function public.reorder_artworks(uuid[]) from public;
revoke all on function public.reorder_media(text,text,uuid[]) from public;
revoke all on function public.reorder_cv(text,uuid[]) from public;
grant execute on function public.reorder_artworks(uuid[]) to authenticated;
grant execute on function public.reorder_media(text,text,uuid[]) to authenticated;
grant execute on function public.reorder_cv(text,uuid[]) to authenticated;

commit;
