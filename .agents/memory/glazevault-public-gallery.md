---
name: GlazeVault public piece-detail gallery
description: How the fullscreen swipe gallery is scoped on the public vs owner piece-detail page, and why.
---

# Public piece-detail gallery scoping

The fullscreen `ImageViewer` swipe set on the piece-detail page is scoped differently for public vs owner views.

- **Public view** (`?public=1`): the gallery must include ONLY siblings that are
  `isPubliclyVisiblePiece(p, collections)` **AND** `p.publicDataSettings.showPhotos`,
  restricted to the same `collectionId`. A piece with no collection = `[piece]` only.
  Viewer captions must honor each piece's own `publicDataSettings` (`showTitle`,
  `showClayBody`, `showGlazeName`) — not the owner's raw fields.
- **Owner view**: scope by the `from` collection param if present, else the whole archive.

**Why:** swiping is a back-door that can leak otherwise-hidden work. Scoping by
`collectionId` alone is NOT enough — a public collection can contain private pieces
or pieces with `showPhotos=false`; both must be excluded from the public swipe set,
and per-piece caption gating prevents leaking titles/materials.

**How to apply:** any future change to the public detail gallery (or new public
surfaces that swipe across pieces) must filter through `isPubliclyVisiblePiece` +
`showPhotos`, never bare `collectionId` equality. The public hero is itself a
`Pressable` that opens the viewer, and `ImageViewer` is rendered inside the public
return branch (it is a separate render path from the owner branch).

## Public metadata is TOGGLE-DRIVEN via one shared helper (supersedes curated subset)
The public meta line is built by the single shared helper `buildPublicMetaLine(piece)`
in `constants/privacy.ts`. It joins, with "  ·  ", every field whose
`publicDataSettings` flag is ON **and** whose value is non-empty, in order
`clay · glaze · cone · firingEnvironment · dimensions · year`. Empty/disabled fields
drop out (`.filter(Boolean)` guards separators), so a piece with only clay/dim/year
reads "Stoneware · 12 × 12 × 14 in · 2025", while one with only glaze/cone/firing
reads "Turquoise matt · Cone 10 · Gas Reduction". EVERY public surface calls this one
helper: the public detail line (`publicMeta` in piece/[id].tsx isPublicView), the
fullscreen `ImageViewer` caption (same file), and the public-site portfolio cards
(`renderCaption` in public-site.tsx).

**Why:** the earlier decision hardcoded a curated `clay · dimensions · year` subset
and ignored the glaze/cone/firing toggles. The user explicitly reversed this: any
field that is enabled AND has data must render, consistently across all public
surfaces. The real bug it caused — a piece (the "Mug") with empty clay/dim/year but
populated+toggled glaze/cone/firing showed ONLY its title, because the hardcoded
subset produced an empty line. The minimal/editorial feel lives in the STYLE (serif
title + one quiet " · " line, no labels/ALL-CAPS), not in restricting which toggles
are honored.

**How to apply:** never hardcode a public field subset again — route every public
metadata line through `buildPublicMetaLine`. When adding a new public-display field,
add it to the helper's array AND add its `show*` flag to `showAllPublicDetails()` in
piece/[id].tsx (or "Show all" silently omits it), and list the field on the
`PublicPiece` interface in public-site.tsx. The owner `/collection/[id]` view is NOT
a public surface — it shows the owner's full data (with private badges) and must NOT
be gated by `publicDataSettings`.

## Public-site portfolio cards carry the same whispered caption
The public-site portfolio tiles (`renderTile` in public-site.tsx) render a caption
BENEATH each image — serif title (PlayfairDisplay) + the same `clay · dimensions ·
year` line built via the shared `buildPublicMetaLine` helper (see the toggle-driven
section above) — across all three layouts (catalog/editorial/masonry). The earlier
"silent cards" pass removed all text; this restored minimal artwork identity.

**Why:** image-only cards read as too anonymous/atmospheric; a quiet exhibition-
catalog caption gives archival presence without a database/card-UI feel.

**How to apply:** the data field is `clay` (NOT `clayBody` — that name only exists
as the `showClayBody` flag). Tiles are a column: `Pressable(tileCol) > tileImage box
(absoluteFill Image) > caption`. Tile styles are split into a wrapper/layout style
(flex/width/margin, e.g. `catalogLargeCol`) and an image-box style (aspectRatio, e.g.
`catalogLargeImg`); keep that split when adding tile variants or the caption width
won't match the image. The local `PublicPiece` interface must list any piece field
the caption reads (objects are full PotteryPiece cast by `getPublicCollectionPieces`).
