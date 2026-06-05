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

## Persistence (typed columns now — see glazevault-schema-columns.md)
- Piece curation flags `{collectionIds, featuredInPortfolio, isPublic, archived}` are TYPED columns (`collection_ids[]`, `featured_in_portfolio`, `is_public`, `archived`). The old `public_data_settings` blob is RETIRED. Do NOT reintroduce blob-stashing.
- Collection public/private uses the EXISTING `collections.visibility` text column.
- `normalizePiece` migrates legacy rows: `collectionId → [collectionId]`, and defaults `featuredInPortfolio/isPublic/archived` to FALSE.

## Migration is conservative → Portfolio starts EMPTY
Existing pieces default to not-featured, not-public, not-archived. **Tell the user the Portfolio starts empty and they curate it.** **Why:** no accidental public exposure on upgrade.

## Public fields = always-public core + TWO per-piece opt-ins (default OFF)
Public output has two tiers, both enforced by the single boundary `toPublicPiece(piece)` in `constants/privacy.ts`:
- **ALWAYS public** (when piece is public): id, title, imageUri, clay, dimensions, year. Meta line = clay·dimensions·year via `buildPublicMetaLine`.
- **OPT-IN per piece, OFF by default** — two INDEPENDENT buckets gated by typed boolean flags `piece.showGlazeDetails` / `piece.showStudioNotes`:
  - glaze bucket = `glaze + cone + firingEnvironment` (firingEnvironment falls back to `firing`).
  - notes bucket = `notes`.
  These keys are ADDED to the projection only when the flag is on (never defaulted), so an opted-out piece has NO key at all — structurally impossible to leak.
- **GATED ON isPublic too (defense in depth):** `toPublicPiece` adds the opt-in keys only when `piece.isPublic && flag`, so a non-public piece never projects glaze/notes even if its flags are on. `ProjectablePiece` therefore carries `isPublic`. Render paths ALSO gate via `isPubliclyVisiblePiece`; both layers are intentional.
- UI: a quiet collapsible "Advanced public visibility" (`components/AdvancedPublicVisibility.tsx`) shown only when main Public is ON, on BOTH `add.tsx` and `piece/[id].tsx`. Unpublishing resets both flags to false.
- Share payload stays title + clay·dims·year ONLY — opted-in glaze/notes live on the public PAGE behind the link, never in the share text (`buildShareContent` reads only title+meta from the projection).
- **How to apply:** to expose a NEW always-public field, add it to `PublicPieceView` + `toPublicPiece` + the guard test (`__tests__/public-privacy.test.tsx`). The guard test asserts default-off projection == the 6 core keys AND that owner-only sentinels never appear on either public surface unless the matching opt-in is on; it FAILS otherwise. **Why:** type casts don't strip runtime fields — a physical projection does.

## Public Site (generated gallery)
- Curated Portfolio = `getPortfolioPieces(pieces)` (featured pieces). Optional public-collections section gated by `isCollectionPublic`.
- `hasContent` empty-state when neither portfolio pieces nor public collections exist.

## Add/Save flow = progressive curation (NOT a post-config form)
The "Save to Archive" screen (`app/(tabs)/add.tsx`) uses stepped disclosure: Private default → Public reveals the Collection step → selecting a collection reveals the Feature step. Collection is OPTIONAL with an explicit "None" chip (rendered first, selected when `collectionIds.length===0`); public pieces NEVER require a collection. **Why:** calm, low-pressure curation for non-technical artists. **How to apply:** keep "None" as the calm default; `selectNone()`/toggling Public off/removing last collection must all clear `featured`; the save handler is the hard gate (`featuredInPortfolio` only when public && ≥1 collection). The edit-piece screen uses a DIFFERENT expandable "Add to Collections" pattern by design — don't unify them blindly.
