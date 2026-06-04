/**
 * Pure drop-target math for the drag-to-reorder photo strip, extracted from the
 * gesture/worklet handlers in components/DraggablePhotoStrip.tsx so it can be
 * unit-tested without a running gesture system.
 *
 * The strip lays thumbnails out on a fixed pixel grid: each slot is one STRIDE
 * (thumbnail width + gap) wide. While a photo is dragged, its displacement in
 * content space is `startIndex * STRIDE + fingerTravel + scrollDelta`, where
 * `scrollDelta` is how far the strip has scrolled since the drag began (it
 * auto-scrolls when the finger nears an edge). Rounding that displacement to the
 * nearest slot and clamping into range gives the slot the photo would drop into.
 *
 * This function carries the "worklet" directive so the same implementation can
 * run on the UI thread inside reanimated worklets AND as plain JS in tests.
 */

const ITEM_W = 72;
const GAP = 12;

/** Pixel pitch of one thumbnail slot (thumbnail width + inter-item gap). */
export const STRIDE = ITEM_W + GAP;

export interface DropTargetArgs {
  /** Slot the dragged photo started in (its original index). */
  startIndex: number;
  /** Finger travel along the strip since the drag began, in px (gesture translationX). */
  translationX: number;
  /** How far the strip has scrolled since the drag began, in px (current offset - start offset). */
  scrollDelta: number;
  /** Number of photos in the strip; the target is clamped to [0, count - 1]. */
  count: number;
  /** Slot pitch in px. Defaults to the strip's STRIDE; injectable for tests. */
  stride?: number;
}

/**
 * Resolve which slot a dragged photo should drop into, clamped to a valid index.
 *
 * Mirrors the displacement math in DraggablePhotoStrip's `onUpdate` and
 * `useFrameCallback` handlers exactly: round the content-space displacement to
 * the nearest slot, then clamp to [0, count - 1].
 */
export function computeDropTarget({
  startIndex,
  translationX,
  scrollDelta,
  count,
  stride = STRIDE,
}: DropTargetArgs): number {
  "worklet";
  const displacement = startIndex * stride + translationX + scrollDelta;
  const target = Math.round(displacement / stride);
  return Math.min(Math.max(target, 0), count - 1);
}
