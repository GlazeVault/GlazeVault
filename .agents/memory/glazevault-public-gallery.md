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
