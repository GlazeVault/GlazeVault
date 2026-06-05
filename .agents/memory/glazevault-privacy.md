---
name: GlazeVault privacy / curation model
description: How per-piece visibility/featuring and collection visibility gate public surfaces after Collection↔Portfolio separation
---

# Curation model (per-piece)

Collection (organization) and Portfolio (curation) are SEPARATE concerns.

- **Collection** = how a piece is organized. A piece can belong to many collections (`piece.collectionIds: string[]`). Collections have their own independent visibility (`Collection.visibility: "public" | "private"`).
- **Portfolio** = a curated set chosen per-PIECE via `piece.featuredInPortfolio`.
- Adding/removing a piece to/from a collection is PURE organization — it must NEVER change `isPublic`/`featuredInPortfolio`.

## Piece flags + GATE + coupling (the invariant)
`piece` has `featuredInPortfolio`, `isPublic`, `collectionIds[]`, `archived`. Featuring is GATED — a piece is featurable ONLY IF `isPublic && collectionIds.length>0`. The toggles are kept coupled so **Portfolio ⊆ Public ⊆ collected**:
- Enable Feature → requires ≥1 collection (else a `notice`, abort); on success `{ featuredInPortfolio: true, isPublic: true }`.
- Disable Public → `{ isPublic: false, featuredInPortfolio: false }`.
- Remove from LAST collection (`collectionIds` becomes empty) → auto-unfeature. Centralized in `PotteryContext.removePieceFromCollection` so every caller inherits it.
- Adding a PRIVATE piece to a collection → `confirm()` make-public first (no silent publish); decline aborts the add. Applies to piece detail add-branch AND `collection/new.tsx` attach.
**Why:** a featured piece must always be publicly viewable AND grouped under a collection (Portfolio is rendered grouped by public collection); un-publishing or de-collecting must not leave a dangling featured piece. **How to apply:** any new surface that writes these flags must preserve the gate + coupling; enforcement is UI-path based (no central addPiece/updatePiece normalization), but render-time `isPortfolioPiece` gating prevents exposure of any legacy orphan-featured rows.

`archived` excludes a piece from Portfolio AND every public surface, but keeps the data (no deletion). UI label is **"Retire"/"Retired"** (the data field stays `archived`). Minimal retire/restore action only; no separate browsing section.

## Helper signatures (all single-arg, PIECE/COLLECTION only)
In `constants/privacy.ts`:
- `isPortfolioPiece(piece)` — the SINGLE gate: `featuredInPortfolio && isPublic && !archived && !!imageUri && collectionIds.length>0`. Read by badge, public-site, profile preview, and the public swipe set.
- `getPortfolioCollectionPieces(collection, pieces)` — members where `collectionIds.includes(collection.id) && isPortfolioPiece`.
- `isPubliclyVisiblePiece(piece)` — public + has image + not archived. SINGLE source of truth for public gating (listings AND `/piece/[id]?public=1` preview).
- `isCollectionPublic(collection)` — `collection.visibility === "public"`.
- `getCollectionPieces(collection, pieces)` / `getPublicCollectionPieces(collection, pieces)` / `getPortfolioPieces(pieces)`.
Do NOT reintroduce the removed `isFeaturedPublicPiece` / `getFeaturedCollectionPieces`, the old two-arg `isPubliclyVisiblePiece(piece, collections)`, or any collection-driven publishing helper (`isCollectionInPortfolio`, `featuredOnSite`).

## Persistence (NO Supabase DDL — sandbox can't run it)
- Piece flags `{collectionIds, featuredInPortfolio, isPublic, archived}` are stashed in the EXISTING `pieces.public_data_settings` jsonb column; `collection_id` keeps the first id for back-compat/fallback read. See `glazevault-supabase.md`.
- Collection public/private uses the EXISTING `collections.visibility` text column; `featured_on_site` column is left unused (not dropped).
- `normalizePiece` migrates legacy rows: `collectionId → [collectionId]`, and defaults `featuredInPortfolio/isPublic/archived` to FALSE.

## Migration is conservative → Portfolio starts EMPTY
Existing pieces default to not-featured, not-public, not-archived. **Tell the user the Portfolio starts empty and they curate it.** **Why:** no accidental public exposure on upgrade.

## Fixed public fields + structural projection boundary
Public output is a FIXED allowlist: **id, title, imageUri, clay, dimensions, year** (meta line = clay·dimensions·year via `buildPublicMetaLine`). NEVER `notes`/glaze/cone/firing/firingEnvironment/price/tags on any public surface.
- `toPublicPiece(piece)` in `constants/privacy.ts` is the SINGLE enforcement boundary: it returns a `PublicPieceView` containing ONLY the allowlist keys, so private fields cannot leak even by accident. Every public surface (public-site tiles, `/piece/[id]?public=1` detail + its fullscreen-viewer caption mapping) must consume `toPublicPiece(p)` and render only from it — never the raw piece.
- **Why:** "protect studio knowledge by default" — type-only casts (`as PublicPiece[]`) don't strip runtime fields; a physical projection does. **How to apply:** to expose a NEW public field, add it to `PublicPieceView` + `toPublicPiece` + the privacy guard test (`__tests__/public-privacy.test.tsx`) — nowhere else. The guard test renders both public surfaces with per-field sentinels and also asserts `toPublicPiece` keys == allowlist; it FAILS if any owner-only sentinel appears.
- cone/firing temp is owner-only by default (NOT shown publicly) even though it's a permissible public field — there is no per-field public toggle, so default-safe wins and the guard test locks cone as private.
- ShareSheet is currently a stub (renders only the title); real share/export must also go through `toPublicPiece`.

## Public Site (generated gallery)
- Curated Portfolio = `getPortfolioPieces(pieces)` (featured pieces). Optional public-collections section gated by `isCollectionPublic`.
- `hasContent` empty-state when neither portfolio pieces nor public collections exist.

## Add/Save flow = progressive curation (NOT a post-config form)
The "Save to Archive" screen (`app/(tabs)/add.tsx`) uses stepped disclosure: Private default → Public reveals the Collection step → selecting a collection reveals the Feature step. Collection is OPTIONAL with an explicit "None" chip (rendered first, selected when `collectionIds.length===0`); public pieces NEVER require a collection. **Why:** calm, low-pressure curation for non-technical artists. **How to apply:** keep "None" as the calm default; `selectNone()`/toggling Public off/removing last collection must all clear `featured`; the save handler is the hard gate (`featuredInPortfolio` only when public && ≥1 collection). The edit-piece screen uses a DIFFERENT expandable "Add to Collections" pattern by design — don't unify them blindly.
