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
- The Public Site lives as a section INSIDE the Profile screen (no new bottom tab) plus a `/public-site` preview route. Config is `profile.publicSite` in ProfileContext: `enabled`, `homepageLayout` ("grid"|"editorial"|"masonry"), `contactEmail`, `etsy`, `shopify`. Name/bio/statement/website/instagram are REUSED from the profile, never duplicated.
- **Featuring lives on the Collection, not the profile.** Each `Collection` has `featuredOnSite: boolean`; the toggle is in Collection detail AND the create/edit modal, shown only when the collection is public, and forced to `false` whenever visibility flips to private (both in UI state and on save). The old profile-side `publicSite.featuredCollectionIds` chip selector was REMOVED. `normalizeProfile` whitelists `publicSite` keys so the legacy `featuredCollectionIds` is dropped and never re-persisted. **Why:** single source of truth for "is this collection on my site". **How to apply:** use `isCollectionFeatured(c)` (= public AND featuredOnSite) — never reintroduce a profile-side ID list.
- **Filter chain, applied at render (defense in depth):** `collections.filter(isCollectionFeatured)` → `getPublicCollectionPieces` → tiles/covers gate photo by `showPhotos` and title by `showTitle`. Collection cover = first public piece whose `showPhotos` is true (so a hidden image never leaks as a cover). A featured collection later made private drops off automatically because `isCollectionFeatured` re-checks public status every render.
- Profile's "Featured Collections" list (replaced the old per-piece "Public Works" grid) shows cover + title + public-piece count for `isCollectionFeatured` collections; tapping a card opens that collection's detail.
- **ProfileContext writes must be race-safe.** Immediate-save toggle/selector handlers + the edit-form `handleSave` can fire near-simultaneously; the old closure-based `updateProfile` clobbered nested `publicSite`. **Why:** architect flagged real data loss. **How to apply:** `updateProfile` merges against a `profileRef` (mirror of latest state, updated synchronously before the await), and nested writes go through `updatePublicSite(partial)` which merges from `profileRef.current.publicSite` — callers must NOT hand-spread `{...profile.publicSite,...}` from render-closure state.
