---
name: GlazeVault immersive collection viewing
description: How a collection is entered as an immersive art-book viewer, and why firing stays owner-only even there.
---

# Immersive collection viewing mode

Collections can be browsed as an exhibition-catalog / monograph via the existing
fullscreen `ImageViewer` (it already does horizontal swipe, vertical-down dismiss,
single-tap chrome toggle, warm dark backdrop, contain/no-crop). There is NO second
viewer component — reuse it.

- **Entry is an `immersive=1` route param** on piece-detail, not a new screen. A
  "View as gallery" affordance on the owner collection page and on each public
  collection section routes to the collection's first piece with `immersive=1`
  (owner adds `from=<cid>`, public adds `public=1`). piece-detail auto-opens the
  viewer on mount when the param is set. **Why:** all the swipe-set scoping +
  privacy projection already lives in piece-detail; routing through it (instead of
  mounting the viewer elsewhere) guarantees the immersive path can't drift from the
  normal path's privacy rules.

- **Web (react-native-web) needs its own page renderer in `ImageViewer`.**
  gesture-handler's `GestureDetector` applies `touch-action: none` on web, and it
  sits directly on the horizontal swipe path (both the outer dismiss-pan wrapper
  AND each `ZoomablePage`), so the FlatList's native horizontal scroll never
  starts — most visibly on iOS Safari from a shared public link. Fix: on
  `Platform.OS === "web"` render a plain `Pressable`-based `WebPage` (no gesture
  detector, tap toggles chrome, browser owns pinch) and DON'T wrap the stage in
  the dismiss `GestureDetector`; let native scroll page between pieces. Keep the
  counter synced via `onScroll` on web (react-native-web doesn't reliably fire
  `onMomentumScrollEnd`). **Why:** native and web disagree on how gesture-handler
  cooperates with scroll views; don't try to make one gesture tree serve both.

- **Firing atmosphere is OWNER-ONLY, even in immersive mode.** The owner viewer
  caption materials line includes `firingEnvironment || firing`; the public branch
  still projects through `toPublicPiece` + `buildPublicMetaLine` (title · clay ·
  dimensions · year, NO firing). **Why:** the user was asked directly and chose to
  keep firing private — visitors get a museum-label subset, only the owner sees
  firing. Do not add firing to any public projection to satisfy an immersive
  request. **How to apply:** the auto-open `useEffect` must stay above the
  `if (!piece) return` early return (hook order), and any new immersive entry must
  reuse the public/owner branch split, never hand-build a public caption.
