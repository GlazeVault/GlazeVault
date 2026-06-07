---
name: GlazeVault Supabase column status
description: Which Supabase pieces/collections columns are alive vs. dead, after curation state was promoted to typed columns.
---

# GlazeVault Supabase columns: alive vs. dead

DB-column access is centralized in `services/dataService.ts` (`pieceToRow`/`rowToPiece`,
`collectionToRow`/`rowToCollection`). That is the authoritative place to check whether a
column is read/written — app-model fields with similar names (in contexts/screens) are NOT
the same thing as DB columns.

**Pieces — current typed columns (alive):**
- `pieces.collection_ids text[]` — multi-collection membership.
- `pieces.featured_in_portfolio`, `pieces.is_public`, `pieces.archived` — curation/discovery booleans.
  These replaced the repurposed JSON blob; they back `constants/privacy.ts` gating.
- `pieces.image_urls text[]` — ordered multi-photo set (cover `image_url` is always a member).
- `pieces.show_glaze_details`, `pieces.show_studio_notes` (boolean, default false) — per-piece
  public opt-ins for the glaze bucket / notes bucket (see glazevault-privacy.md). Added idempotently
  in schema.sql.

`savePiece` is RESILIENT via `OPTIONAL_PIECE_COLUMNS` = [`image_urls`, `show_glaze_details`,
`show_studio_notes`]: if any are missing on the live DB the upsert fails (PGRST204 / 42703 naming the
column), and a strip-and-retry LOOP drops EXACTLY the named column(s) (one per attempt) and retries,
so the core piece — cover `image_url`, `is_public`, `featured_in_portfolio`, `collection_ids`,
`user_id` — still saves and the write reaches Supabase (public link works); dropped values live only
in the local cache until schema.sql is applied. Core columns are deliberately NOT optional — their
absence is a real error that must surface.

**Prod schema drift history:** the PROD DB is repeatedly set up from an OLDER schema.sql than the repo.
On 2026-06-07 a backend diagnosis found prod `pieces` was missing ALL THREE optional columns
(`image_urls`, `show_glaze_details`, `show_studio_notes`) — so every save did 4 round-trips
(strip-and-retry converges, save still works) and glaze/notes opt-ins + multi-photo NEVER reached the
server (silently absent on the public site). Applied the idempotent DDL via the aws-1 pooler, backfilled
`image_urls` from each cover, verified PostgREST exposes them (live REST 200). **RLS, grants, ownership,
and the 4 user flows (profile save / archive save / archive delete / public-link open) ALL tested
healthy** — there is NO RLS/auth root cause; owner writes pass when `auth.uid()` is set, anon public
reads return enabled profiles + public pieces. The only backend defect was this schema drift.

**Retired (dropped from live DB + create-table; backfill+drop kept idempotent in schema.sql):**
- `pieces.public_data_settings` (jsonb) — the old repurposed meta blob. Backfilled into the
  typed columns, then dropped. Some legacy rows held the EVEN OLDER per-field publish shape
  (`showCone`, `showYear`, …) with no curation keys → those correctly default to false.
- `pieces.collection_id` (singular) — was the first-membership fallback; superseded by
  `collection_ids`, dropped after backfill.
- `pieces.visibility` — long dead (never in row type); finally dropped.

**Collections (alive despite legacy-sounding name):**
- `collections.visibility` — source of truth for a collection's public/private state.
- `collections.featured_on_site` — dead, dropped (Portfolio moved to piece level).

**Why:** Curation state used to be squeezed into a single JSON blob to dodge a schema change.
It was promoted to typed columns (legible/queryable). The backfill matched `rowToPiece` exactly,
verified on the live DB before dropping the blob.

**How to apply:** DDL from the sandbox DOES work — use the exact recipe in
`glazevault-db-connection.md` (rebuild the URL from `SUPABASE_POOLER_URL` creds but swap host to
`aws-1-us-east-1.pooler.supabase.com:6543`; direct `SUPABASE_DB_URL` is IPv6-only/unreachable). That
connection is a superuser, so `alter table ... add column if not exists` runs fine and PostgREST
auto-reloads its schema cache within seconds (verify with a live REST select of the new columns; if
stale, run `notify pgrst, 'reload schema';`). Keep `supabase/schema.sql` as the canonical, idempotent
migration AND keep the `dataService.ts` strip-and-retry fallback (`isMissingColumnError`) so writes
survive a not-yet-migrated DB. When retiring a column: backfill first, verify against dataService row
mappers, then `drop column if exists`, placing drops AFTER `create table` so a fresh-DB run doesn't fail.
