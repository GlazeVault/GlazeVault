---
name: GlazeVault artwork grids (orientation-aware, no-crop)
description: How artwork cards lay out and size across Archive, Collection works, and Portfolio works — landscape full-width, portrait/square paired, contain everywhere except covers.
---

# Orientation-aware, no-crop artwork grids

All three artwork grids (Archive `app/(tabs)/index.tsx`, Collection works `app/collection/[id].tsx`, Portfolio works `app/public-site.tsx`) share one layout model driven by `hooks/useImageOrientations.ts`.

## The rule
- Landscape pieces (natural `ratio = width/height > LANDSCAPE_THRESHOLD` = 1.05) span the **full grid width** as a wide catalog plate.
- Portrait & square pieces are packed **two-up** (paired half cards), preserving original order.
- **Every artwork card uses `contentFit="contain"` + the piece's natural ratio. No cover-crop on artwork.**
- Crop (`contentFit="cover"`) is allowed **only** for the collection hero/cover and the public collection cover — these are intentional and must stay.

## How it works
- `useImageOrientations(uris)` measures each uri once via `RNImage.getSize`, stores in a module-level `ratioCache` (survives the session, deduped within a batch), defaults to portrait `0.8` until measured.
- `buildOrientationRows(items, getKey, isLandscape)` returns ordered rows: `{kind:"full",item}` for landscape, `{kind:"pair",left,right:T|null}` for portrait/square (trailing single → half card + empty mate).
- `PotteryCard` accepts optional `initialAspectRatio` to seed the measured ratio and reduce layout flash.
- **Hook placement:** in `collection/[id].tsx` the hook is called BEFORE the `if (!collection) return` early-return so hook order stays stable.

## Add-time orientation
- `PhotoSetEditor` computes `cropAspect` from the picked asset's natural w/h and passes it to `ImageCropper` (which defaults to 4/5), so a new landscape photo stays landscape instead of being forced to 4:5. The editor's cover **preview** uses `contain` (not the cropper's crop).

## Why
Pottery silhouettes were being clipped by fixed-aspect cover-crop tiles. Contain + natural ratio keeps every form fully visible; landscape work needs the full width to read.

## Testing gotcha
`__tests__/public-privacy.test.tsx` stubs `useImageOrientations` (keeping the real `buildOrientationRows`/`isLandscapeRatio` via `requireActual`) because jest-expo's `Image.getSize` mock is incompatible with RN 0.81's promise-based `ImageLoader` (throws `success is not a function`). Privacy assertions are untouched.
