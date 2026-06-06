import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { computeHeroLayout } from "@/components/HeroImage";
import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";
import { useImageOrientations } from "@/hooks/useImageOrientations";

const AnimatedImage = Animated.createAnimatedComponent(Image);
const MAX_ZOOM = 4;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface HeroRepositionProps {
  visible: boolean;
  uri: string;
  focalX: number;
  focalY: number;
  zoom: number;
  /** Called with the chosen 2D focal point and zoom when the artist taps Done. */
  onDone: (focalX: number, focalY: number, zoom: number) => void;
  onCancel: () => void;
}

/**
 * A tactile hero crop tool: drag to pan and pinch (or use the +/− controls) to
 * zoom, choosing exactly which part of the image fills the hero frame. The live
 * preview uses the SAME geometry as `computeHeroLayout` (image laid out at the
 * frame width, scaled about its center), so the chosen crop renders identically
 * on the landing hero, the public page, and the editor previews.
 *
 * Conversion (tool transform → saved crop), with W0 = frame width, H0 = image
 * height at zoom 1, frameH = visible frame height, s = zoom:
 *   tx = W0·(s−1)·(0.5 − focalX)            focalX = 0.5 − tx / (W0·(s−1))
 *   ty = (s−1)·H0/2 − focalY·(H0·s − frameH)
 *   focalY = ((s−1)·H0/2 − ty) / (H0·s − frameH)
 * Both invert cleanly; when an axis has no overflow the focal defaults to 0.5.
 */
export function HeroReposition({
  visible,
  uri,
  focalX,
  focalY,
  zoom,
  onDone,
  onCancel,
}: HeroRepositionProps) {
  const colors = useColors();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const frameWidth = Math.min(winWidth - 48, 420);
  const maxHeight = Math.min(winHeight * 0.62, 560);

  const ratios = useImageOrientations([uri]);
  const ratio = (uri ? ratios[uri] : undefined) ?? 4 / 5;

  // Geometry shared with computeHeroLayout: image is laid out at the frame width
  // (W0) and its natural height (H0); the frame clips to frameH.
  const layout = computeHeroLayout(frameWidth, ratio, maxHeight);
  const W0 = frameWidth;
  const H0 = layout.imageHeight || frameWidth / ratio;
  const frameH = layout.frameHeight || Math.min(H0, maxHeight);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  // Re-seed the live transform from the saved crop each time the tool opens (and
  // whenever the geometry changes), inverting the conversion above.
  React.useEffect(() => {
    if (!visible || !H0) return;
    const s = Math.min(MAX_ZOOM, Math.max(1, zoom || 1));
    const overflowY = H0 * s - frameH;
    const initTx = W0 * (s - 1) * (0.5 - clamp01(focalX));
    const initTy = (s - 1) * (H0 / 2) - clamp01(focalY) * overflowY;
    const mx = ((s - 1) * W0) / 2;
    const tyMax = ((s - 1) * H0) / 2;
    const tyMin = frameH - (H0 * (1 + s)) / 2;
    scale.value = s;
    tx.value = Math.min(mx, Math.max(-mx, initTx));
    ty.value = Math.min(tyMax, Math.max(tyMin, initTy));
  }, [visible, focalX, focalY, zoom, W0, H0, frameH, scale, tx, ty]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const s = scale.value;
      const mx = ((s - 1) * W0) / 2;
      const tyMax = ((s - 1) * H0) / 2;
      const tyMin = frameH - (H0 * (1 + s)) / 2;
      tx.value = Math.min(mx, Math.max(-mx, startTx.value + e.translationX));
      ty.value = Math.min(tyMax, Math.max(tyMin, startTy.value + e.translationY));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_ZOOM, Math.max(1, startScale.value * e.scale));
      scale.value = s;
      const mx = ((s - 1) * W0) / 2;
      const tyMax = ((s - 1) * H0) / 2;
      const tyMin = frameH - (H0 * (1 + s)) / 2;
      tx.value = Math.min(mx, Math.max(-mx, tx.value));
      ty.value = Math.min(tyMax, Math.max(tyMin, ty.value));
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // Zoom controls (also the only zoom path with a mouse on web). Reads/writes
  // shared values from JS, which is allowed, then reclamps the pan to the new
  // bounds so the image keeps covering the frame.
  const applyZoom = (next: number) => {
    const s = Math.min(MAX_ZOOM, Math.max(1, next));
    scale.value = s;
    const mx = ((s - 1) * W0) / 2;
    const tyMax = ((s - 1) * H0) / 2;
    const tyMin = frameH - (H0 * (1 + s)) / 2;
    tx.value = Math.min(mx, Math.max(-mx, tx.value));
    ty.value = Math.min(tyMax, Math.max(tyMin, ty.value));
  };

  const handleReset = () => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
  };

  const handleDone = () => {
    const s = scale.value;
    const fx = s > 1 ? clamp01(0.5 - tx.value / (W0 * (s - 1))) : 0.5;
    const overflowY = H0 * s - frameH;
    const fy =
      overflowY > 0.5 ? clamp01(((s - 1) * (H0 / 2) - ty.value) / overflowY) : 0.5;
    onDone(fx, fy, s);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: "rgba(28,24,20,0.82)" }]}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Reposition hero</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Drag to move the image. Pinch or use −/+ to zoom.
            </Text>

            <View style={styles.frameWrap}>
              <GestureDetector gesture={gesture}>
                <Animated.View
                  style={[
                    styles.frame,
                    { width: W0, height: frameH, backgroundColor: colors.secondary },
                    Platform.OS === "web"
                      ? ({ cursor: "grab", touchAction: "none", userSelect: "none" } as object)
                      : null,
                  ]}
                >
                  <AnimatedImage
                    source={resolveImageSource(uri)}
                    style={[styles.image, { width: W0, height: H0 }, animStyle]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    // @ts-expect-error web-only attribute to stop native drag-ghosting
                    draggable={false}
                  />
                  <View style={styles.gridOverlay} pointerEvents="none">
                    <View style={[styles.gridLineV, { left: "33.33%" }]} />
                    <View style={[styles.gridLineV, { left: "66.66%" }]} />
                    <View style={[styles.gridLineH, { top: "33.33%" }]} />
                    <View style={[styles.gridLineH, { top: "66.66%" }]} />
                  </View>
                </Animated.View>
              </GestureDetector>

              <View style={styles.zoomBar}>
                <Pressable
                  onPress={() => applyZoom(scale.value - 0.25)}
                  style={[styles.zoomBtn, { borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Feather name="minus" size={16} color={colors.foreground} />
                </Pressable>
                <Pressable onPress={handleReset} style={styles.resetBtn} hitSlop={8}>
                  <Text style={[styles.resetText, { color: colors.mutedForeground }]}>Reset</Text>
                </Pressable>
                <Pressable
                  onPress={() => applyZoom(scale.value + 0.25)}
                  style={[styles.zoomBtn, { borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={onCancel} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDone}
                style={[styles.doneBtn, { backgroundColor: colors.cobalt }]}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    lineHeight: 19,
    marginBottom: 18,
  },
  frameWrap: {
    alignItems: "center",
  },
  frame: {
    overflow: "hidden",
    borderRadius: 4,
    alignSelf: "center",
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  zoomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 14,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resetText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  doneText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#fff",
  },
});
