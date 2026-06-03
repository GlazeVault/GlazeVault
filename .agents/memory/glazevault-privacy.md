---
name: GlazeVault privacy / curation model
description: How per-piece visibility/featuring and collection visibility gate public surfaces after Collection↔Portfolio separation
---

# Curation model (per-piece)

Collection (organization) and Portfolio (curation) are SEPARATE concerns.

- **Collection** = how a piece is organized. A piece can belong to many collections (`piece.collectionIds: string[]`). Collections have their own independent visibility (`Collection.visibility: "public" | "private"`).
- **Portfolio** = a curated set chosen per-PIECE via `piece.featuredInPortfolio`.
- Adding/removing a piece to/from a collection is PURE organization — it must NEVER change `isPublic`/`featuredInPortfolio`.

## Piece flags + coupling (the invariant)
`piece` has `featuredInPortfolio`, `isPublic`, `archived`. The toggles are kept coupled so **Portfolio ⊆ Public**:
- Enable Feature → `{ featuredInPortfolio: true, isPublic: true }`.
- Disable Public → `{ isPublic: false, featuredInPortfolio: false }`.
**Why:** a featured piece must always be publicly viewable; un-publishing must not leave a dangling featured-but-private piece. **How to apply:** any new surface that writes these two flags must preserve this coupling.

`archived` excludes a piece from Portfolio AND every public surface, but keeps the data (no deletion). Minimal archive/restore action only; no separate browsing section.

## Helper signatures (all single-arg, PIECE/COLLECTION only)
In `constants/privacy.ts`:
- `isPortfolioPiece(piece)` — featured + has image + not archived.
- `isPubliclyVisiblePiece(piece)` — public + has image + not archived. SINGLE source of truth for public gating (listings AND `/piece/[id]?public=1` preview).
- `isCollectionPublic(collection)` — `collection.visibility === "public"`.
- `getCollectionPieces(collection, pieces)` / `getPublicCollectionPieces(collection, pieces)` / `getPortfolioPieces(pieces)`.
Do NOT reintroduce the old two-arg `isPubliclyVisiblePiece(piece, collections)` or any collection-driven publishing helper (`isCollectionInPortfolio`, `featuredOnSite`).

## Persistence (NO Supabase DDL — sandbox can't run it)
- Piece flags `{collectionIds, featuredInPortfolio, isPublic, archived}` are stashed in the EXISTING `pieces.public_data_settings` jsonb column; `collection_id` keeps the first id for back-compat/fallback read. See `glazevault-supabase.md`.
- Collection public/private uses the EXISTING `collections.visibility` text column; `featured_on_site` column is left unused (not dropped).
- `normalizePiece` migrates legacy rows: `collectionId → [collectionId]`, and defaults `featuredInPortfolio/isPublic/archived` to FALSE.

## Migration is conservative → Portfolio starts EMPTY
Existing pieces default to not-featured, not-public, not-archived. **Tell the user the Portfolio starts empty and they curate it.** **Why:** no accidental public exposure on upgrade.

## Fixed public fields
Public output is a FIXED set: **Title, Photo, Clay, Dimensions, Year** via `buildPublicMetaLine(piece)`. Public piece detail renders ONLY title + photo + meta line — NEVER `notes`/glaze/cone/firing on any `?public=1` surface.

## Public Site (generated gallery)
- Curated Portfolio = `getPortfolioPieces(pieces)` (featured pieces). Optional public-collections section gated by `isCollectionPublic`.
- `hasContent` empty-state when neither portfolio pieces nor public collections exist.
