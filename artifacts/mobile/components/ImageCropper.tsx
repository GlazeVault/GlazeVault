import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ImageManipulator,
  SaveFormat,
} from "expo-image-manipulator";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Warm near-black backdrop — the same calm gallery tone as the fullscreen viewer. */
const BACKDROP = "#13100D";
const PAPER = "#F5F0E8";

/** Largest amount the artwork may be zoomed in past its cover-fit baseline. */
const MAX_ZOOM = 4;
/** Cap the longest exported edge so saved photos stay light without visible loss. */
const MAX_OUTPUT_WIDTH = 1080;

type Natural = { width: number; height: number };

type Props = {
  visible: boolean;
  /** Raw picker/camera URI to crop. Never a stored relative path. */
  uri: string | null;
  /** Natural pixel size from the picker asset, when known (avoids a getSize round-trip). */
  sourceWidth?: number;
  sourceHeight?: number;
  /** Frame aspect ratio as width / height. Defaults to the 4:5 artwork card. */
  aspectRatio?: number;
  /** Corner radius of the crop frame — matches the artwork card (24). */
  cornerRadius?: number;
  onCancel: () => void;
  onConfirm: (uri: string) => void;
};

/**
 * In-app crop preview. The frame uses the exact aspect ratio and corner radius of
 * the final artwork card, so what the maker frames here is pixel-for-pixel what the
 * card, hero, and fullscreen viewer will show. The image is cover-fitted to the
 * frame at rest; pinch zooms in and one finger repositions, both clamped so the
 * frame is always fully covered. On confirm the visible rectangle is cropped out in
 * source pixels with expo-image-manipulator, so the saved file IS the preview —
 * nothing is re-cropped afterwards.
 */
export function ImageCropper({
  visible,
  uri,
  sourceWidth,
  sourceHeight,
  aspectRatio = 4 / 5,
  cornerRadius = 24,
  onCancel,
  onConfirm,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [natural, setNatural] = useState<Natural | null>(null);
  const [processing, setProcessing] = useState(false);

  // Cover-fit transform state. scale is relative to the cover baseline (1 = cover).
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  // Frame size: fit the card ratio inside the available space, leaving room for chrome.
  const frame = useMemo(() => {
    const hMargin = 28;
    const topChrome = insets.top + 64;
    const bottomChrome = insets.bottom + 96;
    let fw = screenW - hMargin * 2;
    let fh = fw / aspectRatio;
    const maxFh = screenH - topChrome - bottomChrome;
    if (fh > maxFh) {
      fh = maxFh;
      fw = fh * aspectRatio;
    }
    return { fw, fh };
  }, [screenW, screenH, insets.top, insets.bottom, aspectRatio]);

  // Cover geometry derived from the natural image size.
  const geom = useMemo(() => {
    if (!natural) return null;
    const { width: iw, height: ih } = natural;
    const coverScale = Math.max(frame.fw / iw, frame.fh / ih);
    return { iw, ih, coverScale, baseW: iw * coverScale, baseH: ih * coverScale };
  }, [natural, frame.fw, frame.fh]);

  // Resolve natural dimensions whenever a new image is opened.
  useEffect(() => {
    if (!visible || !uri) return;
    let cancelled = false;
    if (sourceWidth && sourceHeight) {
      setNatural({ width: sourceWidth, height: sourceHeight });
      return;
    }
    setNatural(null);
    RNImage.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setNatural({ width: w, height: h });
      },
      () => {
        // Without true pixel dimensions we cannot guarantee the saved crop
        // matches the preview, so bail rather than export a mismatched image.
        if (!cancelled) {
          console.log("ImageCropper could not read image size", uri);
          onCancel();
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [visible, uri, sourceWidth, sourceHeight]);

  // Reset the transform to a centered cover fit for each new image.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    sx.value = 0;
    sy.value = 0;
  }, [uri, geom, scale, savedScale, tx, ty, sx, sy]);

  const baseW = geom?.baseW ?? frame.fw;
  const baseH = geom?.baseH ?? frame.fh;
  const fw = frame.fw;
  const fh = frame.fh;

  const clampTranslation = (s: number) => {
    "worklet";
    const maxX = Math.max(0, (baseW * s - fw) / 2);
    const maxY = Math.max(0, (baseH * s - fh) / 2);
    tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
      clampTranslation(scale.value);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      clampTranslation(scale.value);
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = sx.value + e.translationX;
      ty.value = sy.value + e.translationY;
      clampTranslation(scale.value);
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    if (!uri || !geom || processing) return;
    setProcessing(true);
    try {
      const { iw, ih, coverScale } = geom;
      const effScale = coverScale * scale.value;
      let cropW = fw / effScale;
      let cropH = fh / effScale;
      let originX = iw / 2 - (fw / 2 + tx.value) / effScale;
      let originY = ih / 2 - (fh / 2 + ty.value) / effScale;

      originX = Math.max(0, Math.min(iw - cropW, originX));
      originY = Math.max(0, Math.min(ih - cropH, originY));

      const rect = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(cropW),
        height: Math.round(cropH),
      };
      rect.width = Math.min(rect.width, iw - rect.originX);
      rect.height = Math.min(rect.height, ih - rect.originY);

      const context = ImageManipulator.manipulate(uri);
      context.crop(rect);
      if (rect.width > MAX_OUTPUT_WIDTH) {
        context.resize({ width: MAX_OUTPUT_WIDTH });
      }
      const image = await context.renderAsync();
      // On web, request the bytes inline as base64 and hand back a self-contained
      // `data:` URI. The manipulator's web output is a `blob:` URL, and fetching a
      // blob: inside the sandboxed preview iframe fails — so persistPieceImage
      // would throw "Couldn't save photo". A data: URI side-steps the fetch
      // entirely (persistPieceImage returns it untouched).
      const result = await image.saveAsync({
        compress: 0.82,
        format: SaveFormat.JPEG,
        base64: Platform.OS === "web",
      });
      if (Platform.OS === "web" && !result.base64) {
        // Fall through to the catch: a blob: result.uri would fail downstream in
        // the preview iframe, so surface the error instead of saving a dead URI.
        throw new Error("ImageCropper: web crop returned no base64");
      }
      const outUri =
        Platform.OS === "web" && result.base64
          ? `data:image/jpeg;base64,${result.base64}`
          : result.uri;
      onConfirm(outUri);
    } catch (err) {
      console.log("ImageCropper crop failed", err);
      setProcessing(false);
    }
  };

  // Clear processing once the parent has accepted and hidden the cropper.
  useEffect(() => {
    if (!visible) setProcessing(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.root, { backgroundColor: BACKDROP }]}>
          {/* Top chrome */}
          <View style={[styles.topBar, { top: insets.top + 8 }]}>
            <Pressable
              onPress={onCancel}
              hitSlop={12}
              disabled={processing}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel cropping"
            >
              <Feather name="x" size={22} color={PAPER} />
            </Pressable>
            <Text style={styles.title}>Adjust Framing</Text>
            <Pressable
              onPress={handleConfirm}
              hitSlop={12}
              disabled={processing || !geom}
              style={styles.doneBtn}
              accessibilityRole="button"
              accessibilityLabel="Use this framing"
            >
              <Text style={[styles.doneText, { opacity: processing || !geom ? 0.4 : 1 }]}>
                Use Photo
              </Text>
            </Pressable>
          </View>

          {/* Crop stage */}
          <View style={styles.stage}>
            <View
              style={[
                styles.frame,
                { width: fw, height: fh, borderRadius: cornerRadius },
              ]}
            >
              {uri && geom ? (
                <GestureDetector gesture={composed}>
                  <View style={StyleSheet.absoluteFill}>
                    <Animated.View
                      style={[
                        { width: baseW, height: baseH, alignSelf: "center", marginTop: (fh - baseH) / 2 },
                        imageStyle,
                      ]}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: baseW, height: baseH }}
                        contentFit="cover"
                      />
                    </Animated.View>
                  </View>
                </GestureDetector>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator color={PAPER} />
                </View>
              )}
            </View>
          </View>

          {/* Bottom hint */}
          <View style={[styles.hintWrap, { bottom: insets.bottom + 28 }]}>
            <Text style={styles.hint}>Pinch to zoom · Drag to reposition</Text>
          </View>

          {processing && (
            <View style={styles.processing}>
              <ActivityIndicator color={PAPER} />
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  iconBtn: {
    width: 64,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    color: PAPER,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  doneBtn: {
    width: 64,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  doneText: {
    color: PAPER,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    color: "rgba(245,240,232,0.55)",
    fontFamily: "Poppins_300Light",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(19,16,13,0.55)",
    zIndex: 3,
  },
});
