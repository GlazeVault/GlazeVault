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

// How close (px) the finger must get to a strip edge before auto-scroll kicks
// in, and the peak scroll speed (px/frame ~= px per 16ms) at the very edge.
export const EDGE_ZONE = 56;
export const MAX_AUTO_SCROLL = 9;

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

export interface EdgeAutoScrollArgs {
  /** Finger position relative to the strip's left edge, in px (absoluteX - stripPageX). */
  local: number;
  /** Visible width of the strip, in px. The right edge zone is measured from here. */
  viewportW: number;
  /** Width (px) of each edge zone where auto-scroll engages. Defaults to EDGE_ZONE. */
  edgeZone?: number;
  /** Peak scroll speed (px/frame) reached at the very edge. Defaults to MAX_AUTO_SCROLL. */
  maxAutoScroll?: number;
}

/**
 * Resolve the signed auto-scroll speed (px/frame) for a finger held near a
 * strip edge while dragging. Mirrors the edge-ramp math in
 * DraggablePhotoStrip's `onUpdate` handler exactly:
 *
 *   - In the dead zone (between the two edge zones): 0 — no scroll.
 *   - Inside the left edge zone: negative (scroll content left/back), ramping
 *     linearly from 0 at the inner boundary to -maxAutoScroll at the edge.
 *   - Inside the right edge zone: positive (scroll content right/forward),
 *     ramping linearly to +maxAutoScroll at the edge.
 *
 * The ramp is clamped to [-maxAutoScroll, maxAutoScroll], so dragging past an
 * edge (local < 0 or local > viewportW) holds peak speed rather than overshoot.
 */
export function computeEdgeAutoScroll({
  local,
  viewportW,
  edgeZone = EDGE_ZONE,
  maxAutoScroll = MAX_AUTO_SCROLL,
}: EdgeAutoScrollArgs): number {
  "worklet";
  if (local < edgeZone) {
    const ramp = Math.min((edgeZone - local) / edgeZone, 1);
    return -maxAutoScroll * ramp;
  }
  if (local > viewportW - edgeZone) {
    const ramp = Math.min((local - (viewportW - edgeZone)) / edgeZone, 1);
    return maxAutoScroll * ramp;
  }
  return 0;
}
