---
name: GlazeVault privacy / visibility model
description: How piece + collection visibility and public-surface gating work after the Portfolio Publishing Redesign
---

# Privacy model (collection-driven)

Publishing is driven entirely by the **collection**, not the piece. There are NO per-piece publishing controls anymore (the piece visibility toggle and the per-field "Public Display Settings" were removed).

## Single rule
A piece is public IFF its parent collection is in the portfolio AND the piece has an `imageUri`. The one source of truth is `isPubliclyVisiblePiece(piece, collections)` in `constants/privacy.ts`.

- `isCollectionInPortfolio(c) = !!c.featuredOnSite` — the ONE collection switch ("Show in Portfolio").
- `getPublicCollectionPieces` = pieces matching `collectionId` AND having `imageUri`.
- Pieces with no collection (or a deleted one) are NEVER public.

**How to apply:** every public/non-owner surface (listing OR detail) must gate through `isPubliclyVisiblePiece` (or `getPublicCollectionPieces`). The owner-facing `/piece/[id]?public=1` preview ALSO uses `isPubliclyVisiblePiece` now (no special-case on piece visibility anymore).

## Fixed public fields
Public output is a FIXED set: **Title, Photo, Clay, Dimensions, Year**. No user toggles.
- `buildPublicMetaLine(piece)` always renders `clay · dimensions · year`.
- **Public piece detail must render ONLY title + photo + buildPublicMetaLine.** Do NOT render `notes` (Studio Notes), glaze, cone, firing, etc. on any `?public=1` surface. **Why:** the architect flagged that the public view was leaking `piece.notes` — a privacy violation, since public-site tiles route into `/piece/[id]?public=1`. **How to apply:** when adding anything to the public branch, confirm the field is in the fixed set; everything else is owner-only.

## Legacy fields kept for round-trip ONLY
- `piece.visibility` is still STORED but no longer gates anything. Don't read it for visibility decisions; use `isPubliclyVisiblePiece`.
- `Collection.visibility` is kept in lockstep with `featuredOnSite` (visibility `public` iff in portfolio) purely for Supabase round-trip compatibility — write both together, read neither for gating.
- `PublicDataSettings` type + `DEFAULT_PUBLIC_DATA_SETTINGS` are kept ONLY so the Supabase row shape round-trips. `addPiece` still seeds `visibility:"private"` + defaults. `PUBLIC_DATA_FIELDS` and the `isPiecePublic`/`isCollectionPublic`/`isCollectionFeatured` helpers were REMOVED — do not reintroduce.

## collectionId vs pieceIds (intentional)
One collection per piece via `collectionId` (no `pieceIds[]` array). Membership is computed from `collectionId`. Don't add `pieceIds[]` unless multi-collection membership is genuinely needed.

## Post-save "Add to a Collection?" prompt
On Add Piece save, if no collection was chosen, prompt: Choose a Collection / Create New / Later.
- `addPiece` returns the created `PotteryPiece` (so the new id is available).
- "Choose a Collection" → navigate to `/piece/[id]` (assign via its collection row).
- "Create New" → `/collection/new?attachPieceId=<id>`; that screen links the piece via `updatePiece(attachPieceId, { collectionId })` AFTER `addCollection` (which returns the new `Collection`).

## Public Site (generated gallery)
- Lives inside Profile + a `/public-site` preview route. Featuring is the collection's `featuredOnSite` (the "Show in Portfolio" switch) — surfaced via `isCollectionInPortfolio`.
- Filter chain at render (defense in depth): `collections.filter(isCollectionInPortfolio)` → `getPublicCollectionPieces` → tiles render image when `imageUri` exists, title always shown.
- Collection cover precedence: artist-chosen `coverImageUri` → first public piece with `imageUri` → placeholder. Artist cover is a deliberate gallery choice, not gated by piece privacy; fallback only inspects already-public pieces.
- ProfileContext writes must stay race-safe via `profileRef` + `updatePublicSite(partial)` (see prior note — unchanged by this redesign).
