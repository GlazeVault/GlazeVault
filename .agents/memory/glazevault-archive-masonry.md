---
name: GlazeVault archive masonry
description: Why the owner Archive tab uses FlashList masonry and how no-crop tiles avoid transient cropping.
---

# Owner Archive masonry (app/(tabs)/index.tsx + components/PotteryCard.tsx)

The owner Archive tab is a two-column **adaptive masonry** that preserves each
image's natural aspect ratio (no crop, organic non-uniform heights). Public-site
layout is unaffected — this is owner-surface only.

## Use FlashList masonry, not ScrollView
Render via `<FlashList numColumns={2} masonry />` (`@shopify/flash-list`, bundled
in Expo SDK 54 so it works in Expo Go). True staggered masonry can't be done with
RN `FlatList numColumns` (that aligns rows into a grid) and a plain `ScrollView`
loses virtualization.
**Why:** an earlier ScrollView version was flagged as a perf regression vs the
original virtualized list. FlashList keeps virtualization AND staggered heights.
**How to apply:** leave `optimizeItemArrangement` off so tiles keep a stable
column as images measure (no reshuffle = calm). Gutter: contentContainerStyle
`paddingHorizontal:15` + per-cell `paddingHorizontal:9` → 24 outer / 18 between;
header/empty wrapped in matching 9px inset.

## No-crop tile measuring (PotteryCard `preserveAspectRatio` prop)
Tiles start at a 4:5 placeholder ratio, then set the exact natural ratio onLoad.
The masonry passes `preserveAspectRatio` → exact ratio (no clamp) + expo-image
`contentFit="contain"`; other surfaces (Favorites) keep the clamped 0.62–1.4
range + `contentFit="cover"` (unchanged).
**Why:** with `cover`, non-4:5 images crop during the brief pre-measure window;
`contain` avoids any transient crop and, once the wrapper matches the image
exactly, fills edge-to-edge anyway. Wrapper bg = `colors.secondary` as the
measuring placeholder.
