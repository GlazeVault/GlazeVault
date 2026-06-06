import { computeHeroLayout } from "@/components/HeroImage";

describe("computeHeroLayout", () => {
  it("shows the whole image (no crop) when it fits within maxHeight", () => {
    // Landscape image: 400 wide / ratio 2 → 200 tall, under the 300 cap.
    const layout = computeHeroLayout(400, 2, 300, 0.5);
    expect(layout.frameHeight).toBe(200);
    expect(layout.imageHeight).toBe(200);
    expect(layout.translateY).toBe(0);
    expect(layout.cropped).toBe(false);
  });

  it("caps the frame and centers a tall image at focal 0.5", () => {
    // Portrait: 400 wide / ratio 0.5 → 800 tall, capped to 300 → overflow 500.
    const layout = computeHeroLayout(400, 0.5, 300, 0.5);
    expect(layout.frameHeight).toBe(300);
    expect(layout.imageHeight).toBe(800);
    expect(layout.translateY).toBeCloseTo(-250); // -0.5 * 500
    expect(layout.cropped).toBe(true);
  });

  it("aligns the top at focal 0 and the bottom at focal 1", () => {
    const top = computeHeroLayout(400, 0.5, 300, 0);
    expect(top.translateY).toBe(0);
    const bottom = computeHeroLayout(400, 0.5, 300, 1);
    expect(bottom.translateY).toBeCloseTo(-500); // full overflow
  });

  it("clamps out-of-range focal points", () => {
    const below = computeHeroLayout(400, 0.5, 300, -2);
    expect(below.translateY).toBe(0);
    const above = computeHeroLayout(400, 0.5, 300, 5);
    expect(above.translateY).toBeCloseTo(-500);
  });

  it("returns an empty layout before the width is measured", () => {
    const layout = computeHeroLayout(0, 0.5, 300, 0.5);
    expect(layout.frameHeight).toBe(0);
    expect(layout.cropped).toBe(false);
  });
});
