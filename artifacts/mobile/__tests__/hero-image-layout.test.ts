import { computeHeroLayout } from "@/components/HeroImage";

describe("computeHeroLayout", () => {
  it("shows the whole image (no crop) when it fits within maxHeight", () => {
    // Landscape image: 400 wide / ratio 2 → 200 tall, under the 300 cap.
    const layout = computeHeroLayout(400, 2, 300, { focalY: 0.5 });
    expect(layout.frameHeight).toBe(200);
    expect(layout.imageHeight).toBe(200);
    expect(layout.imageWidth).toBe(400);
    expect(layout.translateX).toBe(0);
    expect(layout.translateY).toBe(0);
    expect(layout.cropped).toBe(false);
  });

  it("caps the frame and centers a tall image at focal 0.5", () => {
    // Portrait: 400 wide / ratio 0.5 → 800 tall, capped to 300 → overflow 500.
    const layout = computeHeroLayout(400, 0.5, 300, { focalY: 0.5 });
    expect(layout.frameHeight).toBe(300);
    expect(layout.imageHeight).toBe(800);
    expect(layout.translateY).toBeCloseTo(-250); // -0.5 * 500
    expect(layout.cropped).toBe(true);
  });

  it("aligns the top at focal 0 and the bottom at focal 1", () => {
    const top = computeHeroLayout(400, 0.5, 300, { focalY: 0 });
    expect(top.translateY).toBe(0);
    const bottom = computeHeroLayout(400, 0.5, 300, { focalY: 1 });
    expect(bottom.translateY).toBeCloseTo(-500); // full overflow
  });

  it("clamps out-of-range focal points", () => {
    const below = computeHeroLayout(400, 0.5, 300, { focalY: -2 });
    expect(below.translateY).toBe(0);
    const above = computeHeroLayout(400, 0.5, 300, { focalY: 5 });
    expect(above.translateY).toBeCloseTo(-500);
  });

  it("returns an empty layout before the width is measured", () => {
    const layout = computeHeroLayout(0, 0.5, 300, { focalY: 0.5 });
    expect(layout.frameHeight).toBe(0);
    expect(layout.cropped).toBe(false);
  });

  it("is identical to the default at zoom 1 with a centered focal point", () => {
    const base = computeHeroLayout(400, 2, 300);
    expect(base.imageWidth).toBe(400);
    expect(base.translateX).toBe(0);
    expect(base.translateY).toBe(0);
    expect(base.cropped).toBe(false);
  });

  it("creates horizontal overflow when zoomed in so the image can pan on X", () => {
    // Landscape that fits at zoom 1; zoom 2 doubles both dimensions.
    const layout = computeHeroLayout(400, 2, 300, { focalX: 0.5, focalY: 0.5, zoom: 2 });
    expect(layout.imageWidth).toBe(800); // 400 * 2
    expect(layout.imageHeight).toBe(400); // 200 * 2
    // overflowX = 800 - 400 = 400 → centered focal shifts by -200.
    expect(layout.translateX).toBeCloseTo(-200);
    expect(layout.cropped).toBe(true);
  });

  it("aligns left/right edges at focalX 0 and 1 when zoomed", () => {
    const left = computeHeroLayout(400, 2, 300, { focalX: 0, zoom: 2 });
    expect(left.translateX).toBe(0);
    const right = computeHeroLayout(400, 2, 300, { focalX: 1, zoom: 2 });
    expect(right.translateX).toBeCloseTo(-400); // full horizontal overflow
  });

  it("never zooms below 1", () => {
    const layout = computeHeroLayout(400, 2, 300, { zoom: 0.3 });
    expect(layout.imageWidth).toBe(400);
    expect(layout.imageHeight).toBe(200);
  });
});
