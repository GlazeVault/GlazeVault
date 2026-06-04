/**
 * Drag-to-reorder photo strip: the array move is trivial, but keeping the cover
 * pointed at the SAME photo after a splice is the part that silently breaks.
 *
 * `reorderPhotos` (extracted from PhotoSetEditor.handleReorder) owns that index
 * arithmetic. The gesture/worklet layer that produces `from`/`to` is hard to
 * unit test, but this pure remap is not — so these tests pin every
 * representative move: the cover itself dragged, a photo dragged across the
 * cover from the left, from the right, a move that doesn't straddle the cover,
 * and the no-op. Each case asserts BOTH the new ordering AND that the cover
 * still resolves to the exact same photo it referenced before the move.
 *
 * `removePhoto` (handleRemove's cover remap) is covered alongside it since it
 * shares the same "cover must keep pointing at a real photo" invariant.
 */
import { removePhoto, reorderPhotos } from "@/constants/photoReorder";

const PHOTOS = ["a", "b", "c", "d", "e"];

describe("reorderPhotos keeps order + cover correct", () => {
  it("no-op move returns the inputs unchanged", () => {
    const result = reorderPhotos(PHOTOS, 2, 3, 3);
    expect(result.images).toEqual(PHOTOS);
    expect(result.coverIndex).toBe(2);
    // Cover still points at the same photo.
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("dragging the cover forward follows it to its new slot", () => {
    // Cover is "b" (index 1); drag it to index 3.
    const result = reorderPhotos(PHOTOS, 1, 1, 3);
    expect(result.images).toEqual(["a", "c", "d", "b", "e"]);
    expect(result.coverIndex).toBe(3);
    expect(result.images[result.coverIndex]).toBe("b");
  });

  it("dragging the cover backward follows it to its new slot", () => {
    // Cover is "d" (index 3); drag it to index 0.
    const result = reorderPhotos(PHOTOS, 3, 3, 0);
    expect(result.images).toEqual(["d", "a", "b", "c", "e"]);
    expect(result.coverIndex).toBe(0);
    expect(result.images[result.coverIndex]).toBe("d");
  });

  it("dragging a photo from the LEFT across the cover shifts the cover left", () => {
    // Cover is "c" (index 2); drag "a" (index 0) to index 4, past the cover.
    const result = reorderPhotos(PHOTOS, 2, 0, 4);
    expect(result.images).toEqual(["b", "c", "d", "e", "a"]);
    // Cover index moved 2 → 1, but still resolves to "c".
    expect(result.coverIndex).toBe(1);
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("dragging a photo from the RIGHT across the cover shifts the cover right", () => {
    // Cover is "c" (index 2); drag "e" (index 4) to index 0, past the cover.
    const result = reorderPhotos(PHOTOS, 2, 4, 0);
    expect(result.images).toEqual(["e", "a", "b", "c", "d"]);
    // Cover index moved 2 → 3, but still resolves to "c".
    expect(result.coverIndex).toBe(3);
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("dragging a photo that lands exactly ON the cover slot (from left) preserves cover", () => {
    // Cover is "c" (index 2); drag "a" (index 0) to index 2 (the cover's slot).
    const result = reorderPhotos(PHOTOS, 2, 0, 2);
    expect(result.images).toEqual(["b", "c", "a", "d", "e"]);
    expect(result.coverIndex).toBe(1);
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("dragging a photo that lands exactly ON the cover slot (from right) preserves cover", () => {
    // Cover is "c" (index 2); drag "e" (index 4) to index 2 (the cover's slot).
    const result = reorderPhotos(PHOTOS, 2, 4, 2);
    expect(result.images).toEqual(["a", "b", "e", "c", "d"]);
    expect(result.coverIndex).toBe(3);
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("a move entirely on the cover's left leaves the cover untouched", () => {
    // Cover is "e" (index 4); shuffle "a"→"b" slot, all left of the cover.
    const result = reorderPhotos(PHOTOS, 4, 0, 1);
    expect(result.images).toEqual(["b", "a", "c", "d", "e"]);
    expect(result.coverIndex).toBe(4);
    expect(result.images[result.coverIndex]).toBe("e");
  });

  it("a move entirely on the cover's right leaves the cover untouched", () => {
    // Cover is "a" (index 0); shuffle "d"→"e" slot, all right of the cover.
    const result = reorderPhotos(PHOTOS, 0, 3, 4);
    expect(result.images).toEqual(["a", "b", "c", "e", "d"]);
    expect(result.coverIndex).toBe(0);
    expect(result.images[result.coverIndex]).toBe("a");
  });

  it("preserves the cover photo across an exhaustive sweep of from/to pairs", () => {
    // For every cover position and every from→to move, the cover must keep
    // resolving to the exact same photo it referenced before the move.
    for (let cover = 0; cover < PHOTOS.length; cover++) {
      const coverPhoto = PHOTOS[cover];
      for (let from = 0; from < PHOTOS.length; from++) {
        for (let to = 0; to < PHOTOS.length; to++) {
          const result = reorderPhotos(PHOTOS, cover, from, to);
          expect(result.images.slice().sort()).toEqual(PHOTOS.slice().sort());
          expect(result.images[result.coverIndex]).toBe(coverPhoto);
        }
      }
    }
  });
});

describe("removePhoto keeps the cover on a real photo", () => {
  it("removing a photo before the cover shifts the cover left to track it", () => {
    // Cover is "c" (index 2); remove "a" (index 0).
    const result = removePhoto(PHOTOS, 2, 0);
    expect(result.images).toEqual(["b", "c", "d", "e"]);
    expect(result.coverIndex).toBe(1);
    expect(result.images[result.coverIndex]).toBe("c");
  });

  it("removing a photo after the cover leaves the cover index untouched", () => {
    // Cover is "b" (index 1); remove "d" (index 3).
    const result = removePhoto(PHOTOS, 1, 3);
    expect(result.images).toEqual(["a", "b", "c", "e"]);
    expect(result.coverIndex).toBe(1);
    expect(result.images[result.coverIndex]).toBe("b");
  });

  it("removing the cover falls back to the first remaining photo", () => {
    // Cover is "c" (index 2); remove it.
    const result = removePhoto(PHOTOS, 2, 2);
    expect(result.images).toEqual(["a", "b", "d", "e"]);
    expect(result.coverIndex).toBe(0);
    expect(result.images[result.coverIndex]).toBe("a");
  });

  it("removing the last remaining photo collapses to an empty set", () => {
    const result = removePhoto(["only"], 0, 0);
    expect(result.images).toEqual([]);
    expect(result.coverIndex).toBe(0);
  });

  it("clamps the cover into range when the removed cover was the last photo", () => {
    // Cover is the last photo "e" (index 4); remove it → fall back to first.
    const result = removePhoto(PHOTOS, 4, 4);
    expect(result.images).toEqual(["a", "b", "c", "d"]);
    expect(result.coverIndex).toBe(0);
    expect(result.images[result.coverIndex]).toBe("a");
  });
});
