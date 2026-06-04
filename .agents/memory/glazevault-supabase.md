---
name: GlazeVault Supabase persistence
description: How the mobile app syncs to Supabase vs the AsyncStorage cache, and the deliberate remote-wins limitation.
---

# GlazeVault Supabase persistence

The mobile app (`artifacts/mobile`) uses Supabase as source of truth and AsyncStorage as an offline cache. The user deliberately chose Supabase (external signup, 2 pasted keys) over the repo's existing Replit Postgres + api-server, knowing the tradeoff.

- Config is gated on `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. When absent, `isSupabaseConfigured` is false, the client is null, every remote call no-ops/throws `SupabaseNotConfiguredError`, and the app runs purely on cache + seed. EXPO_PUBLIC_* are inlined at bundle time — **restart the `artifacts/mobile: expo` workflow after setting/changing them**.
- Seeding only happens when NOT configured (so the cloud DB is never polluted with seed data).
- `dataService.ts` imports context types with `import type` only — avoids a runtime import cycle.
- Schema (`supabase/schema.sql`) grants `anon` full read/write + a public `images` bucket. Acceptable ONLY for the no-auth single-artist MVP; unsafe for multi-user.
- **Piece curation now lives in TYPED columns** `pieces.collection_ids text[]` + `featured_in_portfolio`/`is_public`/`archived` booleans (no longer a JSON blob; `public_data_settings`/`collection_id` retired). Collection public/private uses the EXISTING `collections.visibility` text column. See `glazevault-schema-columns.md` + `glazevault-privacy.md`. **Sandbox CAN run Supabase DDL** via `psql "${SUPABASE_POOLER_URL/aws-0/aws-1}"`; after DDL run `notify pgrst, 'reload schema';`. **How to apply:** add new piece state as a real column + idempotent backfill in `supabase/schema.sql`, not a jsonb blob.

**Why the reconciliation is the way it is.** Startup is cache-first (instant paint) then remote load. Conflicts are **remote-wins** per the user's explicit spec ("load Supabase first, fallback to cache only if offline"). To avoid silently losing a just-added record whose remote push failed, startup additionally preserves **cache-only creations** (ids absent from remote): they're merged into state and pushed up. 

**Known limitation (intentional, documented in code):** offline *edits* to an existing record and offline *deletes* still follow remote-wins, so they can be overwritten/resurrected on reconnect. There is NO durable dirty-flag/tombstone sync queue. A full bidirectional offline sync queue is the agreed future step — do not assume it exists.

**How to apply:** any change to startup load logic in the three contexts (Pottery/Collections/Profile) must keep: (1) seed-only-when-unconfigured, (2) cache-only-creations preserved, (3) image URLs folded back into cache after upload/migration so images aren't re-uploaded every session.

## Ops: PGRST205 + pooler host quirk
- **`PGRST205 "Could not find table public.X in the schema cache"` is a stale PostgREST cache, NOT a missing/broken table.** First confirm tables exist with a direct DB query, then fix by reloading the cache — do not "recreate" anything. Reload: connect via the pooler and run `NOTIFY pgrst, 'reload schema';` (takes ~1-3s). Verify against the REST API the app actually uses: `curl ${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/<table>?select=id&limit=1` with `apikey`+`Authorization: Bearer` = anon key → expect `200`/`[]` instead of PGRST205.
- **The `SUPABASE_POOLER_URL` secret has the wrong region host (`aws-0-us-east-1...`) → `FATAL: Tenant or user not found`.** The working host is `aws-1-us-east-1.pooler.supabase.com`. Connect without editing the secret via in-shell substitution: `psql "${SUPABASE_POOLER_URL/aws-0/aws-1}"`. The app itself talks to PostgREST (EXPO_PUBLIC_SUPABASE_URL), not the pooler, so this only affects psql/scripts.
