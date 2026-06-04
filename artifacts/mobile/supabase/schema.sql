-- GlazeVault Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query →
-- paste → Run. Then create the public storage bucket (see bottom of file).
--
-- NOTE ON SECURITY: GlazeVault has no user authentication yet, so these tables
-- use permissive policies that allow the anonymous (anon) key full read/write.
-- This is fine for a single-artist MVP. Before sharing the app with multiple
-- users, add Supabase Auth and replace the policies below with per-user rules
-- (e.g. `using (auth.uid() = user_id)`).

-- ── pieces ──────────────────────────────────────────────────────────────────
create table if not exists public.pieces (
  id                   text primary key,
  title                text not null default '',
  notes                text not null default '',
  clay                 text not null default '',
  glaze                text not null default '',
  firing               text not null default '',
  cone                 text not null default '',
  firing_environment   text not null default '',
  dimensions           text not null default '',
  year                 text not null default '',
  image_url            text not null default '',
  created_at           timestamptz not null default now(),
  is_favorite          boolean not null default false,
  -- Explicit, typed organization + curation columns. `collection_ids` holds the
  -- piece's multi-collection membership; the three booleans drive curation +
  -- discovery (see constants/privacy.ts). These replaced an opaque JSON meta
  -- blob (`public_data_settings`) so the state is legible, queryable, indexable.
  collection_ids        text[]  not null default '{}',
  featured_in_portfolio boolean not null default false,
  is_public             boolean not null default false,
  archived              boolean not null default false
);

-- Idempotent migrations for existing databases (create table above only runs on
-- fresh setups, so new columns must also be added here).
alter table public.pieces add column if not exists year text not null default '';

-- ── Promote curation/organization state to typed columns ─────────────────────
-- These columns were previously squeezed into a single repurposed JSON blob
-- (`public_data_settings`), with `collection_id` (singular) kept as a fallback
-- for the first membership. Add the typed columns, backfill from the blob (and
-- from `collection_id`), then retire the blob + the singular column.
alter table public.pieces add column if not exists collection_ids text[]  not null default '{}';
alter table public.pieces add column if not exists featured_in_portfolio boolean not null default false;
alter table public.pieces add column if not exists is_public             boolean not null default false;
alter table public.pieces add column if not exists archived              boolean not null default false;

-- Backfill the typed columns from the legacy JSON blob. Guarded on the blob's
-- existence so this is a no-op on fresh databases (where the column was never
-- created). Rows still carrying the OLD per-field publishing shape (showCone,
-- showYear, …) lack the curation keys, so they correctly default to false and
-- fall back to `collection_id` for membership — matching the app's old reader.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pieces'
      and column_name = 'public_data_settings'
  ) then
    update public.pieces set
      collection_ids = case
        when jsonb_typeof(public_data_settings->'collectionIds') = 'array'
          then coalesce(
            (select array_agg(value)
               from jsonb_array_elements_text(public_data_settings->'collectionIds') as value),
            '{}'::text[])
        when collection_id is not null then array[collection_id]
        else '{}'::text[]
      end,
      featured_in_portfolio = coalesce((public_data_settings->>'featuredInPortfolio')::boolean, false),
      is_public             = coalesce((public_data_settings->>'isPublic')::boolean, false),
      archived              = coalesce((public_data_settings->>'archived')::boolean, false);
  end if;
end $$;

-- Retire the JSON blob and the singular `collection_id` only after backfill.
alter table public.pieces drop column if exists public_data_settings;
alter table public.pieces drop column if exists collection_id;

-- Retire the long-dead per-piece publishing column. The app never read or wrote
-- `pieces.visibility`; piece public/private state now lives in `is_public`.
alter table public.pieces drop column if exists visibility;

-- ── collections ─────────────────────────────────────────────────────────────
create table if not exists public.collections (
  id                text primary key,
  title             text not null default '',
  intro             text not null default '',
  created_at        timestamptz not null default now(),
  -- The collection's public/private state (independent of the Portfolio, which is
  -- now curated per-piece).
  visibility        text not null default 'private',
  cover_image_url   text
);

-- Retire the legacy collection column. "Show in Portfolio" moved to the piece
-- level, so the app no longer reads or writes `collections.featured_on_site`.
-- Dropped here for existing DBs.
alter table public.collections drop column if exists featured_on_site;

-- ── profiles (single row, id = 'default' until auth is added) ────────────────
create table if not exists public.profiles (
  id          text primary key,
  name        text not null default '',
  bio         text not null default '',
  statement   text not null default '',
  website     text not null default '',
  instagram   text not null default '',
  avatar_url  text,
  public_site jsonb
);

-- ── Row Level Security (permissive, anon-only MVP) ───────────────────────────
alter table public.pieces      enable row level security;
alter table public.collections enable row level security;
alter table public.profiles    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['pieces','collections','profiles'] loop
    execute format(
      'drop policy if exists "anon_all_%1$s" on public.%1$s;', t
    );
    execute format(
      'create policy "anon_all_%1$s" on public.%1$s
         for all to anon using (true) with check (true);', t
    );
  end loop;
end $$;

-- RLS controls WHICH rows are visible; table-level GRANTs control whether the
-- anon/authenticated roles may touch the table at all. Both are required for the
-- PostgREST API (used by @supabase/supabase-js) to read/write these tables.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.pieces, public.collections, public.profiles
  to anon, authenticated;

-- ── Storage bucket for images ────────────────────────────────────────────────
-- Create a PUBLIC bucket named `images`:
--   Dashboard → Storage → New bucket → name `images` → toggle "Public" on.
-- Then allow the anon key to upload/read (run this after the bucket exists):
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "anon_images_all" on storage.objects;
create policy "anon_images_all" on storage.objects
  for all to anon
  using (bucket_id = 'images')
  with check (bucket_id = 'images');
