/**
 * Drag-strip drop targeting: the pure reorder + cover-remap math (reorderPhotos)
 * is covered separately, but it only does the right thing if it's handed the
 * RIGHT target slot. That slot is decided by the gesture/worklet layer in
 * DraggablePhotoStrip — `computeDropTarget` is that math, extracted so it's
 * testable without a running gesture system.
 *
 * It maps a content-space displacement (startIndex * STRIDE + finger travel +
 * scroll delta) to the nearest slot, clamped to [0, count - 1]. These tests pin
 * the representative finger positions: a nudge that stays put, a move that
 * clears exactly one slot (and the half-slot threshold around it), drags past
 * either end that clamp, and a move while the strip has auto-scrolled.
 */
import { computeDropTarget, STRIDE } from "@/constants/photoDropTarget";

const COUNT = 5;

describe("computeDropTarget rounds displacement to the nearest slot", () => {
  it("a small move that stays under half a slot keeps the original index", () => {
    const target = computeDropTarget({
      startIndex: 2,
      translationX: STRIDE * 0.4,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(2);
  });

  it("a small backward nudge under half a slot also stays put", () => {
    const target = computeDropTarget({
      startIndex: 2,
      translationX: -STRIDE * 0.4,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(2);
  });

  it("a move that clears one full slot forward lands one slot over", () => {
    const target = computeDropTarget({
      startIndex: 1,
      translationX: STRIDE,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(2);
  });

  it("a move that clears one full slot backward lands one slot back", () => {
    const target = computeDropTarget({
      startIndex: 3,
      translationX: -STRIDE,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(2);
  });

  it("rounds up once the finger passes the half-slot threshold", () => {
    // Just over half a stride forward → snaps to the next slot.
    const target = computeDropTarget({
      startIndex: 1,
      translationX: STRIDE * 0.5 + 1,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(2);
  });

  it("still holds the slot just under the half-slot threshold", () => {
    const target = computeDropTarget({
      startIndex: 1,
      translationX: STRIDE * 0.5 - 1,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(1);
  });

  it("clamps to the last slot when dragged past the end", () => {
    const target = computeDropTarget({
      startIndex: 0,
      translationX: STRIDE * 10,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(COUNT - 1);
  });

  it("clamps to the first slot when dragged before the start", () => {
    const target = computeDropTarget({
      startIndex: 4,
      translationX: -STRIDE * 10,
      scrollDelta: 0,
      count: COUNT,
    });
    expect(target).toBe(0);
  });

  it("folds an auto-scroll offset into the target slot", () => {
    // Finger held still (translationX 0) but the strip auto-scrolled two slots
    // forward beneath it → the dragged photo has effectively moved two slots.
    const target = computeDropTarget({
      startIndex: 1,
      translationX: 0,
      scrollDelta: STRIDE * 2,
      count: COUNT,
    });
    expect(target).toBe(3);
  });

  it("combines finger travel and auto-scroll in the same direction", () => {
    // One slot of finger travel + one slot of auto-scroll = two slots over.
    const target = computeDropTarget({
      startIndex: 1,
      translationX: STRIDE,
      scrollDelta: STRIDE,
      count: COUNT,
    });
    expect(target).toBe(3);
  });

  it("clamps even when auto-scroll pushes well past the last slot", () => {
    const target = computeDropTarget({
      startIndex: 3,
      translationX: STRIDE,
      scrollDelta: STRIDE * 5,
      count: COUNT,
    });
    expect(target).toBe(COUNT - 1);
  });
});
