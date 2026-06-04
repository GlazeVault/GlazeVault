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
- public preview (`isPublicView`) → same-collection siblings filtered by `isPubliclyVisiblePiece` + `!!imageUri` (no collection → `[piece]`); captions honor per-piece publicDataSettings. `showPhotos` is deprecated as a gate (see glazevault-public-gallery.md). (Superseded the old "single piece only" behavior.)
- opened from a collection (`from` param) → pieces filtered to that collection.
- otherwise → whole archive.
- always guard: if the current piece isn't in the scoped set, fall back to `[piece]`.

## Swipe-to-dismiss gesture model
Vertical swipe up OR down dismisses the viewer (in addition to the X button). A
root-level `Gesture.Pan` wraps the horizontal paging FlatList in an animated
"stage" (translateY + slight scale) with the backdrop in a separate absolute
Animated.View whose opacity fades as |dragY| grows.

**Why:** three gesture systems must coexist — horizontal FlatList paging, per-page
pinch/double-tap zoom + pan, and the new vertical dismiss.

**How to apply:** dismiss pan is `.enabled(!zoomed)` (zoom owns pan when zoomed),
`.activeOffsetY([-14,14])` + `.failOffsetX([-16,16])` so horizontal drags yield to
paging and only vertical drags dismiss. onEnd closes if |translationY|>130 or
|velocityY|>900 (animate to ±height then runOnJS(onClose)), else springs back to 0.
Reset `dragY=0` in the visible-open effect (Modal stays mounted between sessions).

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
