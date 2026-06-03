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

**Why the reconciliation is the way it is.** Startup is cache-first (instant paint) then remote load. Conflicts are **remote-wins** per the user's explicit spec ("load Supabase first, fallback to cache only if offline"). To avoid silently losing a just-added record whose remote push failed, startup additionally preserves **cache-only creations** (ids absent from remote): they're merged into state and pushed up. 

**Known limitation (intentional, documented in code):** offline *edits* to an existing record and offline *deletes* still follow remote-wins, so they can be overwritten/resurrected on reconnect. There is NO durable dirty-flag/tombstone sync queue. A full bidirectional offline sync queue is the agreed future step — do not assume it exists.

**How to apply:** any change to startup load logic in the three contexts (Pottery/Collections/Profile) must keep: (1) seed-only-when-unconfigured, (2) cache-only-creations preserved, (3) image URLs folded back into cache after upload/migration so images aren't re-uploaded every session.
