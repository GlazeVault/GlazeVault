---
name: GlazeVault collection editorial layout
description: How the Collection detail screen dedupes the cover hero and arranges pieces in an editorial rhythm.
---

# Collection detail editorial layout

The Collection detail screen (`app/collection/[id].tsx`) is an editorial gallery, not a single-column card list.

## Cover/hero de-duplication
- The collection cover image is the banner/intro. To avoid showing the same image twice, `gridPieces` filters out any piece whose `imageUri` equals the active cover (`isEditing ? coverImageUri : collection.coverImageUri`).
- **Why:** users frequently set the cover to one of the pieces' photos, which otherwise rendered the identical image as both banner and first card.
- **How to apply:** if a collection's only piece is also its cover, the grid is intentionally empty — the empty-state ("No pieces yet") is gated on `collectionPieces.length === 0`, NOT `gridPieces`, so it does not show a misleading empty state in that case.

## Rhythm
- `buildGalleryRows()` walks pieces with a repeating pattern `["feature","pair","spread","pair"]`. feature = 4/5 tall full width, spread = 3/2 wide full width, pair = two 3/4 tiles side by side with one column raised (alternating) for asymmetry. A trailing single piece in a pair slot falls back to a feature tile.
- Motion: `FadeInView` (reanimated shared values, mount-time rise+fade, index-staggered) wraps each FlatList row; because FlatList mounts rows lazily this reads as fade-in on scroll. Tiles scale on press for soft tap feedback.
- Tiles navigate to `/piece/[id]` — the fullscreen viewer lives in piece detail, so it is preserved by keeping that navigation.
