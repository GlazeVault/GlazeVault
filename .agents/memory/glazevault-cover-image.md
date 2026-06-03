---
name: GlazeVault collection cover image
description: How collection cover images are chosen, displayed, and deduped
---

- Collection has a single `coverImageUri` (DB column `cover_image_url`).
- Selection (edit mode, `collection/[id].tsx`): a Modal offers two sources — upload via Expo Image Picker (`pickCover` → `persistPieceImage`) and a grid of the collection's own pieces (tap sets `coverImageUri = piece.imageUri`). No re-upload of a piece's already-remote URL: `uploadImage` returns http(s)/@seed URIs unchanged.
- Display fallback order: `coverImageUri` → first piece image → neutral placeholder (layers icon).
  - Owner surfaces (collection card, detail header) fall back to the FIRST piece (any visibility) — owner-only, no leak.
  - Public site falls back to first PUBLIC piece that allows photos (`showPhotos`), never a private/hidden image.
- Dedup (`activeCover`/`gridPieces`): the resolved displayed cover (incl. fallback in view mode; only explicit selection in edit mode) is filtered out of the gallery grid so it never appears twice.
**Why:** edit mode shows only the explicit selection so Remove visibly clears; view mode resolves the fallback so a coverless collection still gets a banner without duplicating its first piece below.

## Web upload trap (cover/avatar/piece pickers)
On web (preview iframe), ImagePicker returns a `blob:` URI. `fetch(blob:)` FAILS inside the sandboxed preview iframe, so `persistPieceImage` (which fetches the blob) silently throws and the image is never applied.
**Fix pattern (must use for every web image picker):** call `launchImageLibraryAsync({ base64: Platform.OS === "web" })` and build a `data:` URI from `asset.base64` directly — never fetch the blob. Native still uses `persistPieceImage`.
Cover upload also persists immediately via `updateCollection` (not deferred to Save). `uploadImage` skips http(s) URIs, so a later Save never re-uploads. `readImageBytes`/`uploadImage` both accept `data:` URIs.

## Public-site cover & catalog layout
- Public site must dedup the cover artwork from the grid (mirror collection detail): `gridPieces = coverUri ? cp.filter(p => p.imageUri !== coverUri) : cp`, render grid only when non-empty. Without this the cover repeats immediately below.
- The `HomepageLayout` key `"grid"` was repurposed into an asymmetric "art-book catalog" (`renderCatalog`): alternating large+small staggered pairs, occasional full-bleed wide image, lone trailing piece as an offset 68%-width "solo". Stored key stays `"grid"` (no migration); only its settings label/hint changed to "Catalog".
- Collection cover aspect ratio has see-sawed by request: settled on 16/9 cinematic banner (tried 16/10 = too dominant, 2.2 = too compressed). Piece-count metadata uses full collection count, not deduped count.
- Catalog asymmetry is seeded by the collection index (`beat = rowIndex + seed`), so lone "solo" pieces alternate side/drop across collections instead of every collection hugging the left. Without the seed, sparse collections (one grid piece each) all stack identically left.
- Pottery photos have beige backgrounds that blend into the page bg, so container alignment (68% solo width, left/right) is visually hard to perceive — judge layout by code/logic, not by where the subject appears in a screenshot.
