/**
 * Drag-strip edge auto-scroll: when a finger nears the left/right edge of the
 * thumbnail strip while dragging, the strip must scroll to reveal more photos —
 * otherwise long strips can't be reordered because you can't scroll mid-drag.
 *
 * The speed ramp (finger position relative to the strip edges → signed
 * px/frame) is decided by the gesture/worklet layer in DraggablePhotoStrip.
 * `computeEdgeAutoScroll` is that math, extracted so it's testable without a
 * running gesture system. These tests pin: the dead zone (no scroll), the left
 * edge zone (negative, ramping with depth), the right edge zone (positive), and
 * the exact edges / past-the-edge cases that must clamp to peak speed.
 */
import {
  computeEdgeAutoScroll,
  EDGE_ZONE,
  MAX_AUTO_SCROLL,
} from "@/constants/photoDropTarget";

const VIEWPORT_W = 400;

describe("computeEdgeAutoScroll ramps speed near the strip edges", () => {
  it("returns 0 in the dead zone away from either edge", () => {
    const speed = computeEdgeAutoScroll({
      local: VIEWPORT_W / 2,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(0);
  });

  it("returns 0 just inside the left edge zone boundary", () => {
    // Exactly at EDGE_ZONE the finger is on the dead-zone side of the boundary.
    const speed = computeEdgeAutoScroll({
      local: EDGE_ZONE,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(0);
  });

  it("returns 0 just inside the right edge zone boundary", () => {
    const speed = computeEdgeAutoScroll({
      local: VIEWPORT_W - EDGE_ZONE,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(0);
  });

  it("scrolls backward (negative) inside the left edge zone", () => {
    const speed = computeEdgeAutoScroll({
      local: EDGE_ZONE / 2,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBeLessThan(0);
    expect(speed).toBeGreaterThan(-MAX_AUTO_SCROLL);
  });

  it("scrolls forward (positive) inside the right edge zone", () => {
    const speed = computeEdgeAutoScroll({
      local: VIEWPORT_W - EDGE_ZONE / 2,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThan(MAX_AUTO_SCROLL);
  });

  it("ramps faster the deeper the finger sits in the left edge zone", () => {
    const shallow = computeEdgeAutoScroll({
      local: EDGE_ZONE - 10,
      viewportW: VIEWPORT_W,
    });
    const deep = computeEdgeAutoScroll({
      local: 10,
      viewportW: VIEWPORT_W,
    });
    // Both negative; the deeper finger must scroll harder (more negative).
    expect(deep).toBeLessThan(shallow);
  });

  it("ramps faster the deeper the finger sits in the right edge zone", () => {
    const shallow = computeEdgeAutoScroll({
      local: VIEWPORT_W - EDGE_ZONE + 10,
      viewportW: VIEWPORT_W,
    });
    const deep = computeEdgeAutoScroll({
      local: VIEWPORT_W - 10,
      viewportW: VIEWPORT_W,
    });
    expect(deep).toBeGreaterThan(shallow);
  });

  it("hits exactly half speed at the midpoint of the left edge zone", () => {
    const speed = computeEdgeAutoScroll({
      local: EDGE_ZONE / 2,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBeCloseTo(-MAX_AUTO_SCROLL / 2);
  });

  it("hits peak negative speed exactly at the left edge", () => {
    const speed = computeEdgeAutoScroll({ local: 0, viewportW: VIEWPORT_W });
    expect(speed).toBe(-MAX_AUTO_SCROLL);
  });

  it("hits peak positive speed exactly at the right edge", () => {
    const speed = computeEdgeAutoScroll({
      local: VIEWPORT_W,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(MAX_AUTO_SCROLL);
  });

  it("clamps to peak speed when the finger is dragged past the left edge", () => {
    const speed = computeEdgeAutoScroll({
      local: -200,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(-MAX_AUTO_SCROLL);
  });

  it("clamps to peak speed when the finger is dragged past the right edge", () => {
    const speed = computeEdgeAutoScroll({
      local: VIEWPORT_W + 200,
      viewportW: VIEWPORT_W,
    });
    expect(speed).toBe(MAX_AUTO_SCROLL);
  });
});
