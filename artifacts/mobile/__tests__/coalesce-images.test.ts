/**
 * coalesceImages is the SINGLE normalizer that keeps a piece's cover
 * (`imageUri`) and its ordered photo set (`images`) consistent everywhere a
 * piece is read in (cache load, remote row, addPiece). Every multi-photo
 * surface — the hero, the thumbnail strip, the fullscreen viewer — trusts its
 * two guarantees:
 *
 *   1. the returned `imageUri` is always the cover, and
 *   2. the cover is always a member of `images` (unless the piece genuinely has
 *      no photos, in which case BOTH are empty).
 *
 * These unit tests pin those guarantees against the four shapes real data
 * arrives in: legacy rows with only a cover, freshly-imported rows with only an
 * images list, a cover that isn't yet in the list, and a list carrying junk /
 * duplicates. A regression here would silently corrupt cover selection for
 * every piece in the app.
 */
import { coalesceImages } from "@/constants/imageStorage";

describe("coalesceImages keeps cover + images[] consistent", () => {
  it("seeds images[] from the cover when images is empty (legacy rows)", () => {
    // Older rows predate multi-photo support: they only carry `imageUri`.
    const result = coalesceImages("pieces/cover.jpg", []);
    expect(result).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg"],
    });
  });

  it("seeds images[] from the cover when images is null/undefined", () => {
    expect(coalesceImages("pieces/cover.jpg", null)).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg"],
    });
    expect(coalesceImages("pieces/cover.jpg", undefined)).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg"],
    });
  });

  it("adopts the first image as the cover when the cover is empty", () => {
    // Freshly-imported rows can arrive with an ordered list but no chosen cover.
    expect(coalesceImages("", ["pieces/a.jpg", "pieces/b.jpg"])).toEqual({
      imageUri: "pieces/a.jpg",
      images: ["pieces/a.jpg", "pieces/b.jpg"],
    });
    expect(coalesceImages(null, ["pieces/a.jpg", "pieces/b.jpg"])).toEqual({
      imageUri: "pieces/a.jpg",
      images: ["pieces/a.jpg", "pieces/b.jpg"],
    });
    expect(coalesceImages(undefined, ["pieces/a.jpg"])).toEqual({
      imageUri: "pieces/a.jpg",
      images: ["pieces/a.jpg"],
    });
  });

  it("prepends the cover when it is not already a member of images", () => {
    // The cover MUST be a member of images so the viewer can locate it.
    const result = coalesceImages("pieces/cover.jpg", ["pieces/a.jpg", "pieces/b.jpg"]);
    expect(result).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg", "pieces/a.jpg", "pieces/b.jpg"],
    });
  });

  it("leaves order untouched when the cover is already in images", () => {
    // Cover sits mid-list: no prepend, no reorder — its position is preserved.
    const result = coalesceImages("pieces/b.jpg", [
      "pieces/a.jpg",
      "pieces/b.jpg",
      "pieces/c.jpg",
    ]);
    expect(result).toEqual({
      imageUri: "pieces/b.jpg",
      images: ["pieces/a.jpg", "pieces/b.jpg", "pieces/c.jpg"],
    });
  });

  it("drops empty / non-string junk entries from images", () => {
    const result = coalesceImages("pieces/cover.jpg", [
      "pieces/cover.jpg",
      "",
      null,
      undefined,
      "pieces/b.jpg",
    ] as (string | null | undefined)[]);
    expect(result).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg", "pieces/b.jpg"],
    });
  });

  it("drops duplicate entries, keeping the first occurrence", () => {
    // A photo must never appear twice in a piece's set, and the cover must not
    // be double-counted. Order of first appearance is preserved.
    const result = coalesceImages("pieces/cover.jpg", [
      "pieces/cover.jpg",
      "pieces/a.jpg",
      "pieces/cover.jpg",
      "pieces/b.jpg",
      "pieces/a.jpg",
    ]);
    expect(result).toEqual({
      imageUri: "pieces/cover.jpg",
      images: ["pieces/cover.jpg", "pieces/a.jpg", "pieces/b.jpg"],
    });
  });

  it("dedupes even when the cover is empty (first unique image becomes cover)", () => {
    const result = coalesceImages("", [
      "pieces/a.jpg",
      "pieces/a.jpg",
      "pieces/b.jpg",
    ]);
    expect(result).toEqual({
      imageUri: "pieces/a.jpg",
      images: ["pieces/a.jpg", "pieces/b.jpg"],
    });
  });

  it("returns both empty when the piece genuinely has no photos", () => {
    expect(coalesceImages("", [])).toEqual({ imageUri: "", images: [] });
    expect(coalesceImages(null, null)).toEqual({ imageUri: "", images: [] });
    expect(coalesceImages(undefined, undefined)).toEqual({ imageUri: "", images: [] });
    // An images list of only junk collapses to empty too.
    expect(
      coalesceImages("", ["", null, undefined] as (string | null | undefined)[]),
    ).toEqual({ imageUri: "", images: [] });
  });

  it("always returns a cover that is present in images (the core invariant)", () => {
    const cases: Array<[string | null | undefined, (string | null | undefined)[] | null]> = [
      ["pieces/cover.jpg", []],
      ["", ["pieces/a.jpg", "pieces/b.jpg"]],
      ["pieces/cover.jpg", ["pieces/a.jpg"]],
      ["pieces/b.jpg", ["pieces/a.jpg", "pieces/b.jpg", "pieces/c.jpg"]],
    ];
    for (const [cover, list] of cases) {
      const result = coalesceImages(cover, list as (string | null | undefined)[]);
      expect(result.images).toContain(result.imageUri);
    }
  });
});
