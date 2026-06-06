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
  /** Rendered image width inside the frame (>= frame width when zoomed in). */
  imageWidth: number;
  /** Rendered image height inside the frame. */
  imageHeight: number;
  /** Horizontal offset applied to the image inside the frame. */
  translateX: number;
  /** Vertical offset applied to the image inside the frame. */
  translateY: number;
  /** True when the image overflows the frame on either axis (focal matters). */
  cropped: boolean;
}

/** A saved hero crop: 2D focal point (0..1 each) plus a zoom factor (>= 1). */
export interface HeroFocus {
  focalX?: number;
  focalY?: number;
  zoom?: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Lays out a full-width hero image calmly, honoring an artist-chosen crop:
 *  - at zoom 1 with a centered focal point, the WHOLE image is shown when it
 *    fits within `maxHeight`, and only the tall overflow is cropped otherwise —
 *    identical to the original calm behavior;
 *  - zooming in (zoom > 1) scales the image up, creating overflow on both axes
 *    so the focal point can pan it horizontally AND vertically.
 * Proportions are never distorted. `ratio` is width / height; focal points are
 * 0 (left/top) .. 1 (right/bottom); `zoom` is clamped to >= 1.
 */
export function computeHeroLayout(
  width: number,
  ratio: number,
  maxHeight: number,
  focus: HeroFocus = {},
): HeroLayout {
  if (!width || !ratio || !maxHeight) {
    return { frameHeight: 0, imageWidth: 0, imageHeight: 0, translateX: 0, translateY: 0, cropped: false };
  }
  const zoom = Math.max(1, focus.zoom ?? 1);
  const focalX = clamp01(focus.focalX ?? 0.5);
  const focalY = clamp01(focus.focalY ?? 0.5);
  const baseHeight = width / ratio;
  const frameHeight = Math.min(baseHeight, maxHeight);
  const imageWidth = width * zoom;
  const imageHeight = baseHeight * zoom;
  const overflowX = Math.max(0, imageWidth - width);
  const overflowY = Math.max(0, imageHeight - frameHeight);
  return {
    frameHeight,
    imageWidth,
    imageHeight,
    // `|| 0` normalizes the signed-zero (-0) produced at focal 0.
    translateX: -focalX * overflowX || 0,
    translateY: -focalY * overflowY || 0,
    cropped: overflowX > 0 || overflowY > 0,
  };
}

interface HeroImageProps {
  uri?: string;
  /** Vertical focal point 0..1 (top..bottom). */
  focalY?: number;
  /** Horizontal focal point 0..1 (left..right), meaningful when zoomed in. */
  focalX?: number;
  /** Zoom factor (>= 1). 1 shows the image at its natural frame size. */
  zoom?: number;
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
  focalX = 0.5,
  zoom = 1,
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
  const layout = computeHeroLayout(width, ratio, maxHeight, { focalX, focalY, zoom });

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
          style={{
            width: layout.imageWidth,
            height: layout.imageHeight,
            transform: [{ translateX: layout.translateX }, { translateY: layout.translateY }],
          }}
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
