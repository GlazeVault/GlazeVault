/**
 * Pure reorder + cover-remap math for a piece's photo set, extracted from
 * PhotoSetEditor so it can be unit-tested without the gesture/worklet layer.
 *
 * The drag strip reports a move as "the photo at `from` moved to slot `to`".
 * Reordering the array is the easy part; the subtle part is keeping `coverIndex`
 * pointed at the SAME photo it referenced before the move, since splicing shifts
 * every index in between. These helpers are the single source of truth for that
 * index arithmetic.
 */

export interface PhotoSet {
  images: string[];
  coverIndex: number;
}

/**
 * Move the photo at `from` to slot `to`, returning the new ordering and the
 * cover index re-pointed at the same photo it referenced before the move.
 *
 * `from`/`to` are assumed to be valid indices into `images`. A no-op move
 * (`from === to`) returns the inputs unchanged.
 */
export function reorderPhotos(
  images: string[],
  coverIndex: number,
  from: number,
  to: number,
): PhotoSet {
  if (from === to) return { images, coverIndex };

  const next = [...images];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  // Keep the cover pointed at the same photo it referenced before the move.
  let nextCover = coverIndex;
  if (coverIndex === from) {
    // The cover itself was dragged — follow it to its new slot.
    nextCover = to;
  } else if (from < coverIndex && to >= coverIndex) {
    // A photo from the cover's left was dragged to/past it → cover shifts left.
    nextCover = coverIndex - 1;
  } else if (from > coverIndex && to <= coverIndex) {
    // A photo from the cover's right was dragged to/past it → cover shifts right.
    nextCover = coverIndex + 1;
  }

  return { images: next, coverIndex: nextCover };
}

/**
 * Remove the photo at `index`, returning the new ordering and a cover index that
 * always references a real, in-range photo:
 *   - removing the cover falls back to the first remaining photo,
 *   - removing a photo before the cover shifts the cover left to track it,
 *   - removing the last photo collapses the cover to 0.
 */
export function removePhoto(
  images: string[],
  coverIndex: number,
  index: number,
): PhotoSet {
  const next = images.filter((_, i) => i !== index);
  let nextCover = coverIndex;
  if (index === coverIndex) {
    nextCover = 0;
  } else if (index < coverIndex) {
    nextCover = coverIndex - 1;
  }
  return {
    images: next,
    coverIndex: next.length === 0 ? 0 : Math.min(nextCover, next.length - 1),
  };
}
