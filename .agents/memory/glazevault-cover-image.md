---
name: GlazeVault collection cover image
description: How collection cover images are chosen, displayed, and deduped
---

- Collection has a single `coverImageUri` (DB column `cover_image_url`).
- Selection (edit mode, `collection/[id].tsx`): a Modal offers two sources — upload via Expo Image Picker (`pickCover` → `persistPieceImage`) and a grid of the collection's own pieces (tap sets `coverImageUri = piece.imageUri`). No re-upload of a piece's already-remote URL: `uploadImage` returns http(s)/@seed URIs unchanged.
- Display fallback order: `coverImageUri` → first piece **that actually has an `imageUri`** → neutral placeholder (layers icon).
  - Owner surfaces (collection card in `(tabs)/collections.tsx`, detail header in `collection/[id].tsx`) fall back to the first piece **with a photo**, any visibility — owner-only, no leak. CRITICAL: use `collectionPieces.find(p => p.imageUri)?.imageUri`, NOT `collectionPieces[0]?.imageUri`. The old `[0]` form showed the layers placeholder whenever the first piece was imageless even though later pieces had photos (reported bug: "image renders in Archive/Detail but collection cover shows placeholder"). The grid tiles were never the bug — they use the same `resolveImageSource(piece.imageUri)` as Archive.
  - Public site falls back to first PUBLIC piece WITH an `imageUri` (`cp.find(p => p.imageUri)`), never a private image (the candidate set is already privacy-filtered by `getPublicCollectionPieces`). `showPhotos` is deprecated as a gate.
- Dedup (`activeCover`/`gridPieces`): the resolved displayed cover (incl. fallback in view mode; only explicit selection in edit mode) is filtered out of the gallery grid so it never appears twice.
**Why:** edit mode shows only the explicit selection so Remove visibly clears; view mode resolves the fallback so a coverless collection still gets a banner without duplicating its first piece below.

## Web upload trap (cover/avatar/piece pickers)
On web (preview iframe), ImagePicker returns a `blob:` URI. `fetch(blob:)` FAILS inside the sandboxed preview iframe, so `persistPieceImage` (which fetches the blob) silently throws and the image is never applied.
**Fix pattern (must use for every web image picker):** call `launchImageLibraryAsync({ base64: Platform.OS === "web" })` and build a `data:` URI from `asset.base64` directly — never fetch the blob. Native still uses `persistPieceImage`.
Cover upload also persists immediately via `updateCollection` (not deferred to Save). `uploadImage` skips http(s) URIs, so a later Save never re-uploads. `readImageBytes`/`uploadImage` both accept `data:` URIs.

## Gated cover resolution (anti-leak)

A cover can be picked FROM an in-collection piece, so on PUBLIC/PORTFOLIO surfaces the cover must pass the SAME gate as the grid, or an uncurated piece's artwork leaks onto the Portfolio (looks featured even though grids exclude it). Use `resolveGatedCover(collection, eligible, available)` in `constants/privacy.ts` for every gated cover; the four owner-org surfaces (`collection/[id].tsx` detail header, `(tabs)/collections.tsx` card) stay ungated — owner sees all.
- ALL non-owner cover surfaces pass the FEATURED set (`getPortfolioCollectionPieces`): public-site portfolio + single-collection page, profile preview, AND the `saved.tsx` saved-exhibition thumbnail. **Why:** the public-portfolio rule is "public collections show featured-only"; a separate visibility-gate (`getPublicCollectionPieces`) on any cover surface lets `resolveGatedCover`'s fallback re-pick a non-featured public piece as a collection cover (the fallback only draws from the eligible set), leaking a non-featured piece onto a Portfolio/Featured surface. **How to apply:** every non-owner cover callsite must pass `getPortfolioCollectionPieces` as `eligible`; never reintroduce a non-featured-inclusive eligible set on a cover. `getPublicCollectionPieces` survives only as a tested helper, used by no rendering surface.
- Rule: cover matching an eligible piece is kept + tappable; a dedicated uploaded cover (matches no piece AND not a piece-storage image) is kept, non-tappable; a cover pointing at an uncurated piece is DROPPED to the first eligible piece image.
- **Why the storage-namespace net:** on a REMOTE public view a private piece used as cover is absent from `available`, so it'd masquerade as an "uploaded" cover. Piece photos live in the `pieces/` namespace, covers in `collections/`; detect via `/(?:^|\/)pieces\//` to catch BOTH the remote URL form (`.../pieces/…`) and the native relative form (`pieces/…`, no leading slash).

## Public-site cover & grid layout
- Public site must dedup the cover artwork from the grid (mirror collection detail): `gridPieces = coverUri ? cp.filter(p => p.imageUri !== coverUri) : cp`, render grid only when non-empty. Without this the cover repeats immediately below.
- The grid below the cover is now the single signature monograph flow (see glazevault-public-layouts.md) — the old per-collection Catalog/Masonry/Editorial modes and `HomepageLayout` are GONE; do not look for `renderCatalog`/`homepageLayout`.
- Collection cover aspect ratio has see-sawed by request: settled on 16/9 cinematic banner (tried 16/10 = too dominant, 2.2 = too compressed). Piece-count metadata uses full collection count, not deduped count.
- Pottery photos have beige backgrounds that blend into the page bg, so layout alignment is visually hard to perceive in screenshots — judge layout by code/logic, not by where the subject appears.
