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
  visibility           text not null default 'private',
  public_data_settings jsonb,
  collection_id        text
);

-- Idempotent migrations for existing databases (create table above only runs on
-- fresh setups, so new columns must also be added here).
alter table public.pieces add column if not exists year text not null default '';

-- ── collections ─────────────────────────────────────────────────────────────
create table if not exists public.collections (
  id                text primary key,
  title             text not null default '',
  intro             text not null default '',
  created_at        timestamptz not null default now(),
  visibility        text not null default 'private',
  featured_on_site  boolean not null default false,
  cover_image_url   text
);

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
