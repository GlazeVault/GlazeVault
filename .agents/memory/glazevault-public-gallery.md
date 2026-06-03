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

## Curated public metadata (monograph, not database)
Public-facing piece metadata is deliberately reduced to ONE quiet line:
`clay · dimensions · year`, joined by " · " (e.g. "Stoneware · 12 × 12 × 14 in ·
2026"). Cone, glaze and firing environment are intentionally NOT shown on any
public surface (cone was previously the dimensions-fallback — it was dropped from
public when the `year` field landed). Both the public detail line (`publicMeta` in
piece/[id].tsx isPublicView) and the fullscreen `ImageViewer` caption use the same
formula and must stay in lockstep.

**Why:** the public portfolio should read artwork-first; long technical strings
("STONEWARE · NO GLAZE · CONE 6 · ELECTRIC") feel inventory-like. Owner/private
detail branch keeps the FULL `InfoRow` card (clay/glaze/cone/firing/dimensions/year)
— nothing was deleted, only the public projection was curated.

**How to apply:** still respect `publicDataSettings` toggles (include a field only
if its `show*` flag is on AND the value is non-empty — `showClayBody`/
`showDimensions`/`showYear`; `.filter(Boolean)` guards separators). When adding a
new public-display field, also add its `show*` flag to `showAllPublicDetails()` in
piece/[id].tsx or "Show all" silently omits it. Do not reintroduce
glaze/firing/cone to public surfaces.

## Public-site portfolio cards carry the same whispered caption
The public-site portfolio tiles (`renderTile` in public-site.tsx) render a caption
BENEATH each image — serif title (PlayfairDisplay) + the same `clay · dimensions ·
year` line — across all three layouts (catalog/editorial/masonry). The earlier
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
