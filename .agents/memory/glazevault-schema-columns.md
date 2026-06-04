---
name: GlazeVault Supabase column status
description: Which Supabase columns are genuinely dead vs. actively used (despite legacy-sounding names/comments).
---

# GlazeVault Supabase columns: dead vs. alive

DB-column access is centralized in `services/dataService.ts` (`pieceToRow`/`rowToPiece`,
`collectionToRow`/`rowToCollection`). That is the authoritative place to check whether a
column is read/written — app-model fields with similar names (in contexts/screens) are NOT
the same thing as DB columns.

**Genuinely dead (safe to drop):**
- `pieces.visibility` — not in the row type, never read/written.
- `collections.featured_on_site` — "Show in Portfolio" moved to the piece level; never read/written.

**Actively used despite legacy-sounding names — DO NOT DROP:**
- `pieces.public_data_settings` — REPURPOSED into a JSON meta blob holding
  `{ collectionIds, featuredInPortfolio, isPublic, archived }`. Dropping it loses all
  multi-collection membership + curation flags and breaks save/load.
- `collections.visibility` — the source of truth for a collection's public/private state.

**Why:** A task once asserted all three of (`pieces.visibility`, `pieces.public_data_settings`,
`collections.visibility`) were dead and asked to drop them. Two were still load-bearing; only
`pieces.visibility` was actually dead. Always verify against `dataService.ts` before dropping.

**How to apply:** When retiring DB columns, drop only ones absent from the dataService row
mappers. Use idempotent `alter table ... drop column if exists` and place collection drops
AFTER the `create table` so a fresh-DB run doesn't fail.
