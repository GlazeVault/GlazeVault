import { useEffect, useState } from "react";
import { Image as RNImage } from "react-native";

import { resolveImageSource } from "@/constants/seedImages";

/**
 * Aspect ratio (width / height) above which an image counts as landscape and is
 * given a full-width "catalog plate" row. Square (1.0) and portrait stay in the
 * one-column grid, so the threshold sits just above square to avoid promoting
 * near-square photos.
 */
export const LANDSCAPE_THRESHOLD = 1.05;

/** Assumed ratio before an image has been measured (portrait card placeholder). */
const DEFAULT_RATIO = 0.8;

// Natural ratios persist for the whole session so navigating between the
// Archive, a collection and the portfolio never re-measures the same photo and
// the orientation-aware layout is stable on revisit.
const ratioCache = new Map<string, number>();

function measurableUri(uri: string): string | undefined {
  const source = resolveImageSource(uri);
  if (source && typeof source === "object" && "uri" in source) {
    return source.uri ?? undefined;
  }
  return undefined;
}

/**
 * Measures the natural aspect ratio of each image so callers can lay artwork out
 * by orientation (landscape spans full width; portrait/square stay one column).
 * Returns a map keyed by the original stored uri. Unmeasured images report the
 * portrait default until their dimensions resolve, then the map updates.
 */
export function useImageOrientations(
  uris: (string | undefined | null)[],
): Record<string, number> {
  // Stable signature so the effect only re-runs when the set of uris changes.
  const key = uris.filter(Boolean).join("|");

  const [ratios, setRatios] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const u of uris) {
      if (u && ratioCache.has(u)) init[u] = ratioCache.get(u)!;
    }
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    // De-duplicate within the batch so a uri that appears more than once (e.g. a
    // cover repeated across grids) is only measured a single time.
    const pending = [
      ...new Set(
        uris.filter(
          (u): u is string => !!u && ratioCache.get(u) === undefined,
        ),
      ),
    ];

    // Surface any ratios that another screen already cached this session.
    const cached: Record<string, number> = {};
    for (const u of uris) {
      if (u && ratioCache.has(u)) cached[u] = ratioCache.get(u)!;
    }
    if (Object.keys(cached).length) {
      setRatios((prev) => ({ ...cached, ...prev }));
    }

    pending.forEach((u) => {
      const src = measurableUri(u);
      if (!src) return;
      RNImage.getSize(
        src,
        (w, h) => {
          if (cancelled || !w || !h) return;
          const ratio = w / h;
          ratioCache.set(u, ratio);
          setRatios((prev) => ({ ...prev, [u]: ratio }));
        },
        () => {
          // Leave unmeasured images at the portrait default rather than guessing.
        },
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ratios;
}

/** True when a stored image's measured (or assumed) ratio reads as landscape. */
export function isLandscapeRatio(ratio: number | undefined): boolean {
  return (ratio ?? DEFAULT_RATIO) > LANDSCAPE_THRESHOLD;
}

export type OrientationRow<T> =
  | { key: string; kind: "full"; item: T }
  | { key: string; kind: "pair"; left: T; right: T | null };

/**
 * Packs items into an art-book grid: portrait/square items fill two columns per
 * row, while landscape items break out into their own full-width row. Order is
 * preserved, so a lone portrait left before a landscape simply renders as a
 * half-width tile with empty space beside it.
 */
export function buildOrientationRows<T>(
  items: T[],
  getKey: (item: T) => string,
  isLandscape: (item: T) => boolean,
): OrientationRow<T>[] {
  const rows: OrientationRow<T>[] = [];
  let buffer: T | null = null;

  const flush = () => {
    if (buffer) {
      rows.push({ key: getKey(buffer), kind: "pair", left: buffer, right: null });
      buffer = null;
    }
  };

  for (const item of items) {
    if (isLandscape(item)) {
      flush();
      rows.push({ key: getKey(item), kind: "full", item });
    } else if (buffer) {
      rows.push({ key: getKey(buffer), kind: "pair", left: buffer, right: item });
      buffer = null;
    } else {
      buffer = item;
    }
  }
  flush();

  return rows;
}
