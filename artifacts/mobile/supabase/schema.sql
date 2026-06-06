-- GlazeVault Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query →
-- paste → Run. Then create the public storage bucket (see bottom of file).
--
-- SECURITY: GlazeVault uses Supabase Auth (email + password). Every row is owned
-- by a user via `user_id` (FK auth.users). RLS gives the owner full access to
-- their own rows and lets anon + authenticated read only PUBLIC content (public
-- pieces, public collections, profiles whose public site is enabled) so shared
-- exhibition links resolve without login. The first account to sign up inherits
-- the pre-auth archive via the one-time `claim_legacy_archive()` function.

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
  -- Ordered set of all photo URLs for the piece; `image_url` (the cover) is
  -- always a member. Older rows predate this column (see migration below).
  image_urls           text[] not null default '{}',
  created_at           timestamptz not null default now(),
  is_favorite          boolean not null default false,
  -- Explicit, typed organization + curation columns. `collection_ids` holds the
  -- piece's multi-collection membership; the three booleans drive curation +
  -- discovery (see constants/privacy.ts). These replaced an opaque JSON meta
  -- blob (`public_data_settings`) so the state is legible, queryable, indexable.
  collection_ids        text[]  not null default '{}',
  featured_in_portfolio boolean not null default false,
  is_public             boolean not null default false,
  archived              boolean not null default false,
  -- Per-piece public field exposure. Both OFF by default: a public piece keeps
  -- its glaze details (glaze/cone/firing_environment) and notes private until
  -- the artist opts each in. Enforced in constants/privacy.ts → toPublicPiece.
  show_glaze_details    boolean not null default false,
  show_studio_notes     boolean not null default false
);

-- Idempotent migrations for existing databases (create table above only runs on
-- fresh setups, so new columns must also be added here).
alter table public.pieces add column if not exists year text not null default '';

-- ── Multiple photos per piece ────────────────────────────────────────────────
-- `image_urls` holds the ordered photo set; `image_url` remains the cover and is
-- always a member. Backfill seeds the array from the existing cover for any row
-- that predates the column (empty array + non-empty cover), so the cover never
-- vanishes from a piece's photo set.
alter table public.pieces add column if not exists image_urls text[] not null default '{}';
update public.pieces
  set image_urls = array[image_url]
  where coalesce(array_length(image_urls, 1), 0) = 0
    and image_url <> '';

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

-- ── Per-piece public field exposure ──────────────────────────────────────────
-- Separate opt-in flags so a Public piece can still keep its glaze details and
-- studio notes private. Both default false; existing rows stay private until the
-- artist opts in. `dataService.savePiece` retries without these keys if a
-- database predates this migration, so older schemas never break saving.
alter table public.pieces add column if not exists show_glaze_details boolean not null default false;
alter table public.pieces add column if not exists show_studio_notes  boolean not null default false;

-- Per-user ownership. Null only for legacy rows created before auth (claimed by
-- the first account via claim_legacy_archive). On delete of the user, their
-- pieces cascade away.
alter table public.pieces add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists pieces_user_id_idx on public.pieces(user_id);

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

-- Per-user ownership (see pieces.user_id).
alter table public.collections add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists collections_user_id_idx on public.collections(user_id);

-- ── profiles (one row per user; legacy id = 'default' until claimed) ─────────
-- New accounts store their profile with id = user_id::text and user_id = uid.
-- The legacy single-artist row (id = 'default', user_id null) is migrated into
-- the first account's profile and deleted by claim_legacy_archive().
create table if not exists public.profiles (
  id          text primary key,
  name        text not null default '',
  tagline     text not null default '',
  bio         text not null default '',
  statement   text not null default '',
  website     text not null default '',
  instagram   text not null default '',
  avatar_url  text,
  public_site jsonb
);

-- Optional single-line identity (studio/motto/nickname) under the public name.
alter table public.profiles add column if not exists tagline text not null default '';
-- Large landing/portfolio hero image, independent of the small round avatar, plus
-- its vertical focal point (0 = top .. 1 = bottom) used when the image is taller
-- than its display frame so the artist can reposition without distorting it.
alter table public.profiles add column if not exists hero_image_url text;
alter table public.profiles add column if not exists hero_focal_y real not null default 0.5;
-- Horizontal focal point (0 = left .. 1 = right) and zoom factor (>= 1) so the
-- artist can pan/zoom the hero crop within the frame, not just shift it vertically.
alter table public.profiles add column if not exists hero_focal_x real not null default 0.5;
alter table public.profiles add column if not exists hero_zoom real not null default 1;
-- One-time backfill: existing artists whose avatar doubled as the hero keep that
-- image as their hero. Runs only where no hero has been set yet (idempotent).
update public.profiles set hero_image_url = avatar_url
  where hero_image_url is null and avatar_url is not null;
-- Per-user ownership. Unique (partial) so a user has at most one profile row.
alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists profiles_user_id_key on public.profiles(user_id) where user_id is not null;

-- ── One-time legacy claim ────────────────────────────────────────────────────
-- The pre-auth archive (pieces/collections/profile with user_id null) belongs to
-- whoever signs up first. `app_meta.legacy_claimed` is a one-row latch; the
-- SECURITY DEFINER function assigns all unowned rows to the first authenticated
-- caller, folds the 'default' profile into theirs, deletes it, and trips the
-- latch so no later account can claim. Returns true only for that first caller.
create table if not exists public.app_meta (
  id             int primary key default 1,
  legacy_claimed boolean not null default false,
  constraint app_meta_singleton check (id = 1)
);
insert into public.app_meta (id, legacy_claimed) values (1, false) on conflict (id) do nothing;

create or replace function public.claim_legacy_archive()
returns boolean language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); already boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select legacy_claimed into already from public.app_meta where id = 1 for update;
  if already is null then
    insert into public.app_meta (id, legacy_claimed) values (1, false) on conflict (id) do nothing;
    already := false;
  end if;
  if already then return false; end if;
  update public.pieces      set user_id = uid where user_id is null;
  update public.collections set user_id = uid where user_id is null;
  update public.profiles p set
    name = d.name, tagline = d.tagline, bio = d.bio, statement = d.statement,
    website = d.website, instagram = d.instagram, avatar_url = d.avatar_url,
    hero_image_url = d.hero_image_url, hero_focal_y = d.hero_focal_y,
    hero_focal_x = d.hero_focal_x, hero_zoom = d.hero_zoom,
    public_site = d.public_site
  from public.profiles d
  where d.id = 'default' and d.user_id is null and p.user_id = uid;
  delete from public.profiles where id = 'default' and user_id is null;
  update public.app_meta set legacy_claimed = true where id = 1;
  return true;
end; $fn$;
revoke all on function public.claim_legacy_archive() from public, anon;
grant execute on function public.claim_legacy_archive() to authenticated;

-- ── Row Level Security (per-user owner + public read) ────────────────────────
alter table public.pieces      enable row level security;
alter table public.collections enable row level security;
alter table public.profiles    enable row level security;

-- Drop the old permissive anon-everything policies.
drop policy if exists "anon_all_pieces"      on public.pieces;
drop policy if exists "anon_all_collections" on public.collections;
drop policy if exists "anon_all_profiles"    on public.profiles;

-- pieces: owner sees all of theirs; anyone may read public, non-archived pieces.
drop policy if exists "pieces_select" on public.pieces;
create policy "pieces_select" on public.pieces for select to anon, authenticated
  using (user_id = auth.uid() or (is_public = true and archived = false));
drop policy if exists "pieces_insert" on public.pieces;
create policy "pieces_insert" on public.pieces for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "pieces_update" on public.pieces;
create policy "pieces_update" on public.pieces for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pieces_delete" on public.pieces;
create policy "pieces_delete" on public.pieces for delete to authenticated
  using (user_id = auth.uid());

-- collections: owner sees all; anyone may read public collections.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections for select to anon, authenticated
  using (user_id = auth.uid() or visibility = 'public');
drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "collections_delete" on public.collections;
create policy "collections_delete" on public.collections for delete to authenticated
  using (user_id = auth.uid());

-- profiles: owner sees their own; anyone may read a profile whose public site is
-- enabled (so shared exhibition links resolve for logged-out visitors).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to anon, authenticated
  using (user_id = auth.uid() or (public_site->>'enabled') = 'true');
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RLS controls WHICH rows are visible; table-level GRANTs control whether a role
-- may touch the table at all. anon is read-only (public viewing); authenticated
-- gets full CRUD (still constrained to their own rows by RLS).
grant usage on schema public to anon, authenticated;
revoke insert, update, delete on public.pieces, public.collections, public.profiles from anon;
grant select on public.pieces, public.collections, public.profiles to anon;
grant select, insert, update, delete
  on public.pieces, public.collections, public.profiles
  to authenticated;

-- ── Storage bucket for images ────────────────────────────────────────────────
-- Create a PUBLIC bucket named `images`:
--   Dashboard → Storage → New bucket → name `images` → toggle "Public" on.
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

-- Public read (the bucket is public anyway); only authenticated users may write.
drop policy if exists "anon_images_all" on storage.objects;
drop policy if exists "images_read"   on storage.objects;
drop policy if exists "images_write"  on storage.objects;
drop policy if exists "images_update" on storage.objects;
drop policy if exists "images_delete" on storage.objects;
create policy "images_read"   on storage.objects for select using (bucket_id = 'images');
create policy "images_write"  on storage.objects for insert to authenticated with check (bucket_id = 'images');
create policy "images_update" on storage.objects for update to authenticated using (bucket_id = 'images') with check (bucket_id = 'images');
create policy "images_delete" on storage.objects for delete to authenticated using (bucket_id = 'images');
