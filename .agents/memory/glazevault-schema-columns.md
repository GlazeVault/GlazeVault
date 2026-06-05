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
- `pieces.show_glaze_details`, `pieces.show_studio_notes` (boolean, default false) — per-piece
  public opt-ins for the glaze bucket / notes bucket (see glazevault-privacy.md). Added idempotently
  in schema.sql. `savePiece` is RESILIENT: if these columns are missing on the live DB the upsert
  fails (PGRST204 / 42703 naming the column), and it retries once WITHOUT them, warns, and the flags
  then live only in the local cache until schema.sql is applied. So a fresh column may not be on the
  live DB yet even though the app uses it.

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

**How to apply:** The pooler psql workaround (`psql "${SUPABASE_POOLER_URL/aws-0/aws-1}"`) is
UNRELIABLE — it has failed with `Tenant or user not found`, and direct `SUPABASE_DB_URL` fails with
IPv6 ENETUNREACH from the sandbox. Treat `supabase/schema.sql` as the canonical migration the USER
applies (idempotent `add/drop column if exists`), and make new-column writes survive a not-yet-migrated
DB with a strip-and-retry fallback in `dataService.ts` (see `isMissingColumnError`). If you DO get a
psql connection, run `notify pgrst, 'reload schema';` after DDL. When retiring a column: backfill
first, verify against dataService row mappers, then `drop column if exists`, placing drops AFTER
`create table` so a fresh-DB run doesn't fail.
