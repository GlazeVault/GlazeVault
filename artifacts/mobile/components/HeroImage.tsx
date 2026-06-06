import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";
import { useImageOrientations } from "@/hooks/useImageOrientations";

/** Ratio (width / height) assumed before an image has been measured. */
const DEFAULT_RATIO = 4 / 5;

export interface HeroLayout {
  /** Visible frame height (clipped). */
  frameHeight: number;
  /** Rendered image height at the frame's width. */
  imageHeight: number;
  /** Vertical offset applied to the image inside the frame. */
  translateY: number;
  /** True when the image is taller than the frame (focal point is meaningful). */
  cropped: boolean;
}

/**
 * Lays out a full-width hero image calmly:
 *  - if it fits within `maxHeight`, the WHOLE image is shown (no crop);
 *  - if it is taller, the frame is capped at `maxHeight` and the image is shifted
 *    vertically by the focal point so the artist chooses which band shows, never
 *    distorting proportions and only ever cropping the tall overflow.
 * `ratio` is width / height. `focalY` is 0 (top) .. 1 (bottom).
 */
export function computeHeroLayout(
  width: number,
  ratio: number,
  maxHeight: number,
  focalY: number,
): HeroLayout {
  if (!width || !ratio || !maxHeight) {
    return { frameHeight: 0, imageHeight: 0, translateY: 0, cropped: false };
  }
  const fullHeight = width / ratio;
  const frameHeight = Math.min(fullHeight, maxHeight);
  const overflow = Math.max(0, fullHeight - frameHeight);
  const clampedFocal = Math.min(1, Math.max(0, focalY));
  return {
    frameHeight,
    imageHeight: fullHeight,
    // `|| 0` normalizes the signed-zero (-0) produced when the focal point is 0.
    translateY: -clampedFocal * overflow || 0,
    cropped: overflow > 0,
  };
}

interface HeroImageProps {
  uri?: string;
  /** Vertical focal point 0..1 (top..bottom). */
  focalY?: number;
  /** Tallest the frame may grow before the image is repositioned within it. */
  maxHeight: number;
  /** Explicit width (skips internal measurement) — used inside fixed-size modals. */
  width?: number;
  /** Placeholder fallback initial when there is no image. */
  initial?: string;
  borderRadius?: number;
  onCroppedChange?: (cropped: boolean) => void;
}

/**
 * The framed hero image shared by the public landing, the owner's app entry, the
 * profile editor preview, and the reposition tool — so all four agree on exactly
 * how a hero is shown.
 */
export function HeroImage({
  uri,
  focalY = 0.5,
  maxHeight,
  width: fixedWidth,
  initial,
  borderRadius = 0,
  onCroppedChange,
}: HeroImageProps) {
  const colors = useColors();
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;

  const ratios = useImageOrientations([uri]);
  const ratio = (uri ? ratios[uri] : undefined) ?? DEFAULT_RATIO;
  const layout = computeHeroLayout(width, ratio, maxHeight, focalY);

  React.useEffect(() => {
    onCroppedChange?.(layout.cropped);
  }, [layout.cropped, onCroppedChange]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (fixedWidth == null) setMeasured(e.nativeEvent.layout.width);
  };

  if (!uri) {
    return (
      <View
        onLayout={onLayout}
        style={[
          styles.placeholder,
          { backgroundColor: colors.secondary, height: Math.min(maxHeight, 360), borderRadius },
        ]}
      >
        {initial ? (
          <Text style={[styles.initial, { color: colors.mutedForeground }]}>{initial}</Text>
        ) : (
          <Feather name="image" size={40} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
        )}
      </View>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={{ width: "100%", height: layout.frameHeight || undefined, overflow: "hidden", borderRadius }}
    >
      {width > 0 ? (
        <Image
          source={resolveImageSource(uri)}
          style={{ width: "100%", height: layout.imageHeight, transform: [{ translateY: layout.translateY }] }}
          contentFit="cover"
          transition={260}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 80,
    fontFamily: "PlayfairDisplay_400Regular",
    opacity: 0.5,
  },
});
