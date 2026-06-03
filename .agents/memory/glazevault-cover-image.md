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
