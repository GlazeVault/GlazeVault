import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareSheet } from "@/components/ShareSheet";
import type { ShareContent } from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";

/**
 * A single artwork page and the quiet context shown alongside it. The viewer is
 * an extension of the piece detail, not a bare photo gallery, so each item
 * carries the metadata painted in the bottom overlay and a public-safe share
 * payload for the top-overlay share action.
 */
export type ViewerItem = {
  uri: string;
  title?: string;
  /** Middle meta line, e.g. "Stoneware · Cone 10 · 2024". */
  materials?: string;
  /** Collection name shown beneath the meta line, when the piece has one. */
  collection?: string;
  /** Public-safe share content (already projected) for this piece. */
  share?: ShareContent;
};

type Props = {
  visible: boolean;
  items: ViewerItem[];
  initialIndex: number;
  onClose: () => void;
  /**
   * Optional gate run before the viewer's share action opens its sheet. Owner
   * surfaces pass this to confirm the piece is live on the server first (so a
   * cache-only piece never yields a dead public link); resolving `false` aborts
   * the share. When omitted (public-visitor view, where content is already
   * remote) the share opens directly.
   */
  onRequestShare?: () => Promise<boolean>;
};

/** Warm near-black backdrop — calm, not a harsh pure black. */
const BACKDROP = "#13100D";
const PAPER = "#F5F0E8";

/**
 * A single zoomable page. Pinch + double-tap zoom, one-finger pan while zoomed,
 * single tap toggles the surrounding UI. Pan is only enabled while zoomed so the
 * parent FlatList keeps owning horizontal swipes at rest.
 */
function ZoomablePage({
  item,
  width,
  height,
  zoomed,
  active,
  resetSignal,
  onToggleUi,
  onZoomChange,
}: {
  item: ViewerItem;
  width: number;
  height: number;
  zoomed: boolean;
  active: boolean;
  resetSignal: number;
  onToggleUi: () => void;
  onZoomChange: (z: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    sx.value = 0;
    sy.value = 0;
    runOnJS(onZoomChange)(false);
  };

  // Snap transforms back to identity without animation. FlatList cells and the
  // Modal can stay mounted between sessions, so we must clear any leftover
  // zoom/pan explicitly — otherwise a page can reopen still zoomed while the
  // parent thinks it isn't, breaking the swipe-vs-pan contract.
  const snapToIdentity = () => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    sx.value = 0;
    sy.value = 0;
  };

  // Reset every page whenever the viewer (re)opens or jumps to a new start index.
  useEffect(() => {
    snapToIdentity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // When a page scrolls out of view, drop its zoom so paging stays clean.
  useEffect(() => {
    if (!active) snapToIdentity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        reset();
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomChange)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = sx.value + e.translationX;
        ty.value = sy.value + e.translationY;
      }
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(onZoomChange)(true);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onToggleUi)();
    });

  const composed = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.page, { width, height }]}>
        <Animated.View style={[{ width, height }, imageStyle]}>
          <Image
            source={resolveImageSource(item.uri)}
            style={{ width, height }}
            contentFit="contain"
            transition={150}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Web counterpart of {@link ZoomablePage}. On react-native-web,
 * gesture-handler's GestureDetector applies `touch-action: none` to its view,
 * which sits directly on the horizontal swipe path and stops the parent
 * FlatList's native scroll from ever starting (most visibly on iOS Safari). So
 * on web we drop the gesture wrapper entirely and use a plain Pressable: native
 * horizontal scroll keeps paging between pieces, and a tap still toggles the
 * chrome. Pinch/double-tap zoom is left to the browser's own gestures.
 */
function WebPage({
  item,
  width,
  height,
  onToggleUi,
}: {
  item: ViewerItem;
  width: number;
  height: number;
  onToggleUi: () => void;
}) {
  return (
    <Pressable style={[styles.page, { width, height }]} onPress={onToggleUi}>
      <Image
        source={resolveImageSource(item.uri)}
        style={{ width, height }}
        contentFit="contain"
        transition={150}
      />
    </Pressable>
  );
}

/**
 * Fullscreen artwork viewer. Swipe between pieces, pinch/double-tap to zoom,
 * single tap to hide the chrome. Opens and closes with a soft fade.
 */
export function ImageViewer({ visible, items, initialIndex, onClose, onRequestShare }: Props) {
  const isWeb = Platform.OS === "web";
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(initialIndex);
  const [uiVisible, setUiVisible] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  // Bumped on each open so every page snaps its zoom/pan back to identity.
  const [resetSignal, setResetSignal] = useState(0);

  // Vertical drag offset for swipe-to-dismiss. Driving the whole stage by this
  // value lets us slide the artwork with the finger and fade the backdrop as it
  // travels, so a flick up or down quietly closes the viewer.
  const dragY = useSharedValue(0);

  // Reset transient state each time the viewer is opened.
  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setUiVisible(true);
      setZoomed(false);
      setShareVisible(false);
      setResetSignal((n) => n + 1);
      dragY.value = 0;
    }
  }, [visible, initialIndex, dragY]);

  const uiOpacity = useSharedValue(1);
  useEffect(() => {
    uiOpacity.value = withTiming(uiVisible ? 1 : 0, { duration: 220 });
  }, [uiVisible, uiOpacity]);
  const uiStyle = useAnimatedStyle(() => ({ opacity: uiOpacity.value }));

  // Swipe up or down to dismiss. Only engaged when not zoomed (zoom owns the
  // pan), and biased to vertical movement (failOffsetX) so the horizontal
  // FlatList keeps owning left/right paging between pieces.
  const dismiss = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY([-14, 14])
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd((e) => {
      const shouldClose =
        Math.abs(e.translationY) > 130 || Math.abs(e.velocityY) > 900;
      if (shouldClose) {
        dragY.value = withTiming(
          e.translationY >= 0 ? height : -height,
          { duration: 220 },
          (finished) => {
            if (finished) runOnJS(onClose)();
          },
        );
      } else {
        dragY.value = withTiming(0, { duration: 200 });
      }
    });

  // Stage slides with the finger and eases back slightly for a calm, depth-y
  // feel; the backdrop fades toward transparent as the drag grows.
  const stageStyle = useAnimatedStyle(() => {
    const dist = Math.abs(dragY.value);
    return {
      transform: [
        { translateY: dragY.value },
        {
          scale: interpolate(
            dist,
            [0, height * 0.6],
            [1, 0.9],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(dragY.value),
      [0, height * 0.55],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const current = items[index];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        {/* Warm backdrop, fading out as the stage is dragged toward dismissal. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: BACKDROP },
            backdropStyle,
          ]}
        />
        {(() => {
          const list = (
            <FlatList
              data={items}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!zoomed}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({
                length: width,
                offset: width * i,
                index: i,
              })}
              keyExtractor={(_, i) => String(i)}
              extraData={`${index}-${resetSignal}`}
              scrollEventThrottle={16}
              // react-native-web's ScrollView does not reliably emit
              // onMomentumScrollEnd, so keep the counter in sync from onScroll
              // on web; native still uses onMomentumScrollEnd.
              onScroll={
                isWeb
                  ? (e) => {
                      // Clamp against Safari overscroll/bounce so the counter
                      // never reports an out-of-range page.
                      const i = Math.max(
                        0,
                        Math.min(
                          items.length - 1,
                          Math.round(e.nativeEvent.contentOffset.x / width),
                        ),
                      );
                      if (i !== index) setIndex(i);
                    }
                  : undefined
              }
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                if (i !== index) setIndex(i);
              }}
              renderItem={({ item, index: i }) =>
                isWeb ? (
                  <WebPage
                    item={item}
                    width={width}
                    height={height}
                    onToggleUi={() => setUiVisible((v) => !v)}
                  />
                ) : (
                  <ZoomablePage
                    item={item}
                    width={width}
                    height={height}
                    zoomed={zoomed}
                    active={i === index}
                    resetSignal={resetSignal}
                    onToggleUi={() => setUiVisible((v) => !v)}
                    onZoomChange={setZoomed}
                  />
                )
              }
            />
          );
          // On web the gesture-handler dismiss wrapper would block the
          // FlatList's native horizontal scroll (touch-action: none), so render
          // the stage bare and rely on the close control to dismiss.
          return isWeb ? (
            <Animated.View style={[styles.stage, stageStyle]}>
              {list}
            </Animated.View>
          ) : (
            <GestureDetector gesture={dismiss}>
              <Animated.View style={[styles.stage, stageStyle]}>
                {list}
              </Animated.View>
            </GestureDetector>
          );
        })()}

        {/* Top chrome: close button + counter */}
        <Animated.View
          pointerEvents={uiVisible ? "box-none" : "none"}
          style={[styles.topBar, { top: insets.top + 8 }, uiStyle]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <Feather name="x" size={22} color={PAPER} />
          </Pressable>
          {items.length > 1 && (
            <Text style={styles.counter}>
              {index + 1} / {items.length}
            </Text>
          )}
          {current?.share ? (
            <Pressable
              onPress={async () => {
                // Owner surfaces pass a gate to confirm the piece is live on the
                // server before sharing; resolving false aborts so a cache-only
                // piece never yields a dead public link. Public-visitor view has
                // no gate (content is already remote) and opens directly.
                if (onRequestShare && !(await onRequestShare())) return;
                setShareVisible(true);
              }}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Share this piece"
            >
              <Feather name="share-2" size={19} color={PAPER} />
            </Pressable>
          ) : (
            <View style={styles.closeBtn} />
          )}
        </Animated.View>

        {/* Bottom caption — title, the quiet meta line, and the collection name,
            so swiping through pieces keeps the artwork context (never image-only). */}
        {current && (current.title || current.materials || current.collection) ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.caption, uiStyle]}
          >
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              style={[styles.captionGradient, { paddingBottom: insets.bottom + 28 }]}
            >
              {current.title ? (
                <Text style={styles.captionTitle} numberOfLines={1}>
                  {current.title}
                </Text>
              ) : null}
              {current.materials ? (
                <Text style={styles.captionMaterials} numberOfLines={1}>
                  {current.materials}
                </Text>
              ) : null}
              {current.collection ? (
                <Text style={styles.captionCollection} numberOfLines={1}>
                  {current.collection}
                </Text>
              ) : null}
            </LinearGradient>
          </Animated.View>
        ) : null}
      </View>

      {/* Share — rendered inside the viewer's Modal so sharing stays immersive
          (no second top-level modal). Only mounts when the current piece has a
          public-safe share payload. */}
      {current?.share ? (
        <ShareSheet
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          content={current.share}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stage: {
    flex: 1,
  },
  page: {
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  counter: {
    color: "rgba(245,240,232,0.75)",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  captionGradient: {
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  captionTitle: {
    color: PAPER,
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 20,
  },
  captionMaterials: {
    color: "rgba(245,240,232,0.62)",
    fontFamily: "Poppins_300Light",
    fontSize: 13,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  captionCollection: {
    color: "rgba(245,240,232,0.5)",
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
  },
});
