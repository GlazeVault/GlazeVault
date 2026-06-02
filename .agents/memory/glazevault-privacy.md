---
name: GlazeVault privacy / visibility model
description: How piece + collection visibility, public-data field toggles, and public-surface gating work in the mobile app
---

# Privacy model

Pieces and collections each carry `visibility: "public" | "private"`. Pieces also carry a `publicDataSettings` object (11 field toggles). Helpers live in `constants/privacy.ts`: `isPiecePublic`, `isCollectionPublic`, `getPublicCollectionPieces`, `isPubliclyVisiblePiece`.

## Source-of-truth rule
Piece privacy is the source of truth. Collection visibility can **suppress** a public piece but can **never** reveal a private one. A private piece is never public regardless of `publicDataSettings`.

**How to apply:** any new public/non-owner surface must filter through `isPubliclyVisiblePiece(piece, collections)` — never just `isPiecePublic`. That helper hides a public piece if its parent collection is private; pieces with no collection (or a deleted one) surface as long as the piece is public.

## collectionId vs pieceIds (intentional)
The spec described `pieceIds[]` on collections, but the app uses `collectionId`-per-piece (one collection per piece). We kept `collectionId` — it already references by ID with no duplication, and avoids a risky migration. `getPublicCollectionPieces` computes membership via `collectionId`, not a `pieceIds` array. Do not add `pieceIds[]` unless multi-collection membership is actually needed.

**Why:** lower risk, no dual source of truth, identical user-facing behavior.

## Defaults & backward compat
- New pieces AND new collections default to `private`.
- `normalizePiece` migrates legacy `isPublic` → `visibility` (only when `visibility` absent) and backfills `publicDataSettings` from `DEFAULT_PUBLIC_DATA_SETTINGS`.
- CollectionsContext load defaults missing `visibility` to `private`.
- `PUBLIC_DATA_FIELDS` (ordered key+label list) drives the field-toggle UI in Edit Piece AND the Public Display Settings section in Piece Detail; field controls only render when the piece is public.

## Public renderer & field gating
- Canonical public renderer is the piece detail route in public mode (`/piece/[id]?public=1`). `public` is a reserved word — read it via the params object (`params.public === "1"`), don't destructure. Public mode is read-only: hide favorite/edit/delete/visibility/collection/field-settings; show a private notice when `!isPubliclyVisiblePiece`.
- Data model has FEWER content fields than the 11 toggles: `showGlazeRecipe`/`showFiringNotes`/`showPrice` intentionally map to no field. Do NOT add new data fields to satisfy them.
- **Gate every outbound channel, not just on-screen rows.** A hidden field can still leak through side channels — e.g. ShareSheet was leaking `piece.title` when `showTitle=false`. **Why:** the architect flagged this as a privacy violation. **How to apply:** in public mode, pass share/export metadata through the same `publicDataSettings` gate (fall back to a generic label like "Untitled piece" when a field is off).

## Public Site (generated gallery)
- The Public Site lives as a section INSIDE the Profile screen (no new bottom tab) plus a `/public-site` preview route. Config is `profile.publicSite` in ProfileContext: `enabled`, `featuredCollectionIds`, `homepageLayout` ("grid"|"editorial"|"masonry"), `contactEmail`, `etsy`, `shopify`. Name/bio/statement/website/instagram are REUSED from the profile, never duplicated.
- **Three-layer filter, applied at render (defense in depth):** featured IDs → keep only collections that still exist AND are public (`isCollectionPublic`) → `getPublicCollectionPieces` → thumbnails gate photo by `showPhotos` and title by `showTitle`. A collection featured then later made private must drop off automatically. **How to apply:** never trust `featuredCollectionIds` alone; re-check public status every render.
- **ProfileContext writes must be race-safe.** Immediate-save toggle/selector handlers + the edit-form `handleSave` can fire near-simultaneously; the old closure-based `updateProfile` clobbered nested `publicSite`. **Why:** architect flagged real data loss. **How to apply:** `updateProfile` merges against a `profileRef` (mirror of latest state, updated synchronously before the await), and nested writes go through `updatePublicSite(partial)` which merges from `profileRef.current.publicSite` — callers must NOT hand-spread `{...profile.publicSite,...}` from render-closure state.
