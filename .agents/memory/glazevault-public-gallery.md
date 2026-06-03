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
Public-facing piece metadata is deliberately reduced to ONE quiet line: material
(clay) + a single secondary detail — dimensions preferred, else cone — joined by
" · " (e.g. "Stoneware · 7 × 7 × 5 in", "Porcelain · Cone 10"). Glaze and firing
environment are intentionally NOT shown on any public surface. Both the public
detail line (`publicMeta` in piece/[id].tsx isPublicView) and the fullscreen
`ImageViewer` caption use the same formula and must stay in lockstep.

**Why:** the public portfolio should read artwork-first; long technical strings
("STONEWARE · NO GLAZE · CONE 6 · ELECTRIC") feel inventory-like. Owner/private
detail branch keeps the FULL `InfoRow` card (clay/glaze/cone/firing/dimensions) —
nothing was deleted, only the public projection was curated.

**How to apply:** still respect `publicDataSettings` toggles (include a field only
if its `show*` flag is on AND the value is non-empty; `.filter(Boolean)` guards
separators). Do not reintroduce glaze/firing to public surfaces; if adding a new
public surface, reuse the same material + dimensions-or-cone formula.
