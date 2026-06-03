---
name: GlazeVault fullscreen image viewer
description: How the fullscreen artwork viewer scopes pieces and why per-page zoom must be reset explicitly.
---

# Fullscreen image viewer (components/ImageViewer.tsx)

Tap a piece's hero image (in app/piece/[id].tsx) to open a fullscreen Modal that
swipes across pieces. Each piece has a SINGLE image, so "swipe between photos"
means swipe across the archive/collection, not multiple photos per piece.

## Gallery scoping (privacy-critical)
Built in app/piece/[id].tsx, not the viewer. See `glazevault-public-gallery.md` for the public-side detail:
- public preview (`isPublicView`) → same-collection siblings filtered by `isPubliclyVisiblePiece` + `showPhotos` (no collection → `[piece]`); captions honor per-piece publicDataSettings. (Superseded the old "single piece only" behavior.)
- opened from a collection (`from` param) → pieces filtered to that collection.
- otherwise → whole archive.
- always guard: if the current piece isn't in the scoped set, fall back to `[piece]`.

## Zoom/pan reset gotcha
**Per-page zoom/pan shared values must be reset explicitly**, not only via gesture
paths. RN `Modal` + `FlatList` cells stay mounted between sessions, so a page can
reopen still zoomed while the parent's `zoomed` state is false — that re-enables
horizontal paging on a zoomed image and breaks the swipe-vs-pan contract.

**How to apply:** keep a `resetSignal` bumped on each open and an `active` (is-current-page)
flag; in each ZoomablePage, snap transforms to identity (no animation) on
`resetSignal` change and whenever `active` goes false. Pan is `.enabled(zoomed)` and
the FlatList is `scrollEnabled={!zoomed}`; needs `extraData` so cells re-render on
index change.
