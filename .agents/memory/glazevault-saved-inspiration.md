---
name: GlazeVault Saved / Follow (quiet network)
description: How the on-device "Save to Inspiration" + "Follow Artist" features are stored and gated, and why.
---

# Saved to Inspiration + Follow Artist

The first "quiet network" features. Deliberately NON-social: no hearts/likes/counts/metrics/rankings/gamification. Feedback is opacity-only; saved/followed status is a private bookmark.

## Storage is LOCAL-ONLY (not Supabase)
SavedContext persists to AsyncStorage alone (key `@glazevault_saved_v1`), NOT the Supabase source-of-truth.
**Why:** the app has no viewer identity/auth — saves/follows are viewer-side curation, distinct from the artist's archive. There is intentionally no shared backend for them.
**How to apply:** never wire Saved/Follow into the Supabase sync path; keep it viewer-private and device-local.

## Hydration must MERGE, never overwrite
The initial AsyncStorage read merges (union) stored state into current state via `setSaved(prev => union(stored, prev))`, not `setSaved(stored)`.
**Why:** if the user taps Save/Follow before the async read resolves, a plain overwrite drops that action (hydration race). State starts empty so any pre-hydrate change is an add — a union preserves both.
**How to apply:** keep persist-only-after-`hydrated` AND merge-on-hydrate together; don't revert to a replace.

## Saved surfaces MUST re-gate privacy on every render
The Saved shelf resolves saved ids against live contexts and re-applies `isPubliclyVisiblePiece` (pieces) and `isCollectionPublic` (collections); cover fallback uses `getPublicCollectionPieces`.
**Why:** an item saved while public but later made private/archived must silently fall off the shelf — a viewer bookmark can never override the owner's current privacy choice. Without this, the Saved tab leaks now-private content.
**How to apply:** any new surface that renders saved/bookmarked content must gate through the same privacy helpers, never render raw saved ids.

## Jest harness note
Render tests that import real screens/contexts pulling SavedContext need the AsyncStorage jest mock (`jest.setup.js` → `setupFiles`) AND a per-suite `jest.mock("@/context/SavedContext", ...)` returning a no-op value (mirrors how Pottery/Collections/Profile are mocked).
