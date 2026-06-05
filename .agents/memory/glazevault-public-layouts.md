---
name: GlazeVault public-site layout modes
description: The three homepageLayout modes must stay visually distinct rhythms, not share a render path
---

# Public-site layout modes (homepageLayout)

`profile.publicSite.homepageLayout` has THREE values that MUST render through
three different code paths in `app/public-site.tsx` `renderPieces`:

- **`grid` ("Catalog")** — orderly museum grid: two even columns of identical
  fixed-ratio (4:5) matted frames, `contentFit="contain"` so nothing is cropped
  (letterboxed, not cropped). Equal rhythm row after row.
- **`masonry` ("Masonry")** — organic flow: greedy shortest-column packing of two
  columns at each piece's NATURAL ratio (variable heights → staggered); landscape
  pieces (`isLandscapeRatio`) break out into full-width bands between column blocks.
- **`editorial` ("Editorial")** — every piece stacked full-width.

**Why:** they previously looked identical — `grid` and `masonry` both fell
through to the same `buildOrientationRows` path (only `editorial` differed), so
switching modes did nothing perceptible. The user requires an obvious difference
within ~1s of switching.

**How to apply:** never collapse two modes onto one renderer. Catalog stays
uniform/cropless (letterbox in a fixed frame); Masonry stays natural-ratio +
column-packed. Catalog's fixed frame is the ONE place public artwork is boxed to
a set ratio, but it still uses `contain` so the no-crop principle (see
glazevault-artwork-grids) holds.
