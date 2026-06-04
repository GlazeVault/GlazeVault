import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  computeDropTarget,
  computeEdgeAutoScroll,
  STRIDE,
} from "@/constants/photoDropTarget";
import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";

const ITEM_W = 72;
const ITEM_H = (ITEM_W * 5) / 4;
const TOP_PAD = 8;

type Colors = ReturnType<typeof useColors>;

interface DraggablePhotoStripProps {
  images: string[];
  coverIndex: number;
  /** Move the photo at `from` to `to`, preserving which photo is the cover. */
  onReorder: (from: number, to: number) => void;
  onSetCover: (index: number) => void;
  /** Optional. When omitted, thumbnails render without a remove (×) button. */
  onRemove?: (index: number) => void;
  /** Optional. When omitted, the trailing "Add" tile is not rendered. */
  onAdd?: () => void;
}

/**
 * Horizontal thumbnail strip that supports drag-to-reorder. A quick horizontal
 * swipe scrolls the strip; a long-press lifts a thumbnail so it can be dragged
 * to a new slot. Tap promotes a thumbnail to cover; the × removes it.
 *
 * Reorder math lives here only as gesture/layout concerns — the actual array
 * mutation and cover remap are delegated to the parent via `onReorder`, so the
 * single source of truth for ordering stays `images[]`.
 */
export function DraggablePhotoStrip({
  images,
  coverIndex,
  onReorder,
  onSetCover,
  onRemove,
  onAdd,
}: DraggablePhotoStripProps) {
  const colors = useColors();
  const count = images.length;

  // Shared drag state, owned by the strip and read by every thumbnail.
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Scroll bookkeeping so reorder math stays correct while the strip
  // auto-scrolls under the finger.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const containerRef = useRef<View>(null);
  const scrollOffset = useSharedValue(0); // live content offset
  const scrollStart = useSharedValue(0); // offset captured when a drag begins
  const autoScroll = useSharedValue(0); // px/frame to advance while edge-held
  const viewportW = useSharedValue(0); // visible strip width
  const stripPageX = useSharedValue(0); // strip's left edge in window coords
  const contentW = useSharedValue(0); // total scrollable content width

  const contentWidth = onAdd
    ? count * STRIDE + ITEM_W + 8
    : (count - 1) * STRIDE + ITEM_W + 8;

  useEffect(() => {
    contentW.value = contentWidth;
  }, [contentWidth, contentW]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollOffset.value = e.contentOffset.x;
  });

  const handleLayout = () => {
    containerRef.current?.measureInWindow((x, _y, w) => {
      stripPageX.value = x;
      viewportW.value = w;
    });
  };

  // Per-frame pump: while a drag holds near an edge, nudge the scroll offset and
  // re-derive the hover slot from the dragged item's content displacement
  // (original slot + finger travel + how far we've scrolled since lift-off).
  useFrameCallback(() => {
    "worklet";
    if (activeIndex.value === -1 || autoScroll.value === 0) return;
    const maxScroll = Math.max(0, contentW.value - viewportW.value);
    const next = Math.min(
      Math.max(scrollOffset.value + autoScroll.value, 0),
      maxScroll,
    );
    if (next === scrollOffset.value) return;
    scrollOffset.value = next;
    scrollTo(scrollRef, next, 0, false);
    hoverIndex.value = computeDropTarget({
      startIndex: activeIndex.value,
      translationX: dragX.value,
      scrollDelta: next - scrollStart.value,
      count,
    });
  });

  return (
    <View ref={containerRef} onLayout={handleLayout}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { width: contentWidth }]}
      >
        <View style={[styles.canvas, { width: contentWidth }]}>
          {images.map((uri, index) => (
            <Thumb
              key={`${uri}-${index}`}
              uri={uri}
              index={index}
              count={count}
              isCover={index === coverIndex}
              colors={colors}
              activeIndex={activeIndex}
              hoverIndex={hoverIndex}
              dragX={dragX}
              scrollOffset={scrollOffset}
              scrollStart={scrollStart}
              autoScroll={autoScroll}
              viewportW={viewportW}
              stripPageX={stripPageX}
              onReorder={onReorder}
              onSetCover={onSetCover}
              onRemove={onRemove}
              setScrollEnabled={setScrollEnabled}
            />
          ))}

          {onAdd ? (
            <Pressable
              style={({ pressed }) => [
                styles.addTile,
                {
                  left: count * STRIDE,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={onAdd}
            >
              <Feather name="plus" size={20} color={colors.mutedForeground} />
              <Text
                style={[styles.addTileText, { color: colors.mutedForeground }]}
              >
                Add
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Thumb({
  uri,
  index,
  count,
  isCover,
  colors,
  activeIndex,
  hoverIndex,
  dragX,
  scrollOffset,
  scrollStart,
  autoScroll,
  viewportW,
  stripPageX,
  onReorder,
  onSetCover,
  onRemove,
  setScrollEnabled,
}: {
  uri: string;
  index: number;
  count: number;
  isCover: boolean;
  colors: Colors;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragX: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  scrollStart: SharedValue<number>;
  autoScroll: SharedValue<number>;
  viewportW: SharedValue<number>;
  stripPageX: SharedValue<number>;
  onReorder: (from: number, to: number) => void;
  onSetCover: (index: number) => void;
  onRemove?: (index: number) => void;
  setScrollEnabled: (enabled: boolean) => void;
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragX.value = 0;
      scrollStart.value = scrollOffset.value;
      autoScroll.value = 0;
      runOnJS(setScrollEnabled)(false);
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      // Displacement of the dragged item in content space: original slot +
      // finger travel + scroll that happened since the drag started.
      hoverIndex.value = computeDropTarget({
        startIndex: index,
        translationX: dragX.value,
        scrollDelta: scrollOffset.value - scrollStart.value,
        count,
      });

      // Edge auto-scroll: ramp speed up the closer the finger is to an edge.
      autoScroll.value = computeEdgeAutoScroll({
        local: e.absoluteX - stripPageX.value,
        viewportW: viewportW.value,
      });
    })
    .onEnd(() => {
      const from = index;
      const to = hoverIndex.value;
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragX.value = 0;
      autoScroll.value = 0;
      if (to >= 0 && from !== to) {
        runOnJS(onReorder)(from, to);
      }
    })
    .onFinalize(() => {
      autoScroll.value = 0;
      runOnJS(setScrollEnabled)(true);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    if (isActive) {
      // Add the scroll delta so the lifted thumbnail tracks the finger even as
      // the strip scrolls beneath it.
      const translateX = dragX.value + (scrollOffset.value - scrollStart.value);
      return {
        transform: [{ translateX }, { scale: 1.08 }],
        zIndex: 20,
        opacity: 0.96,
      };
    }
    let shift = 0;
    if (activeIndex.value !== -1) {
      if (activeIndex.value < index && hoverIndex.value >= index) {
        shift = -STRIDE;
      } else if (activeIndex.value > index && hoverIndex.value <= index) {
        shift = STRIDE;
      }
    }
    return {
      transform: [
        { translateX: withTiming(shift, { duration: 160 }) },
        { scale: 1 },
      ],
      zIndex: 1,
      opacity: 1,
    };
  });

  return (
    <Animated.View
      style={[styles.item, { left: index * STRIDE }, animatedStyle]}
    >
      <GestureDetector gesture={pan}>
        <Pressable
          style={[
            styles.thumb,
            {
              borderColor: isCover ? colors.emerald : colors.border,
              borderWidth: isCover ? 2 : 1,
            },
          ]}
          onPress={() => onSetCover(index)}
        >
          <Image
            source={resolveImageSource(uri)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {isCover ? (
            <View
              style={[styles.coverDot, { backgroundColor: colors.emerald }]}
            >
              <Feather name="star" size={9} color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      </GestureDetector>
      {onRemove ? (
        <Pressable
          style={[styles.removeBtn, { backgroundColor: colors.foreground }]}
          onPress={() => onRemove(index)}
          hitSlop={6}
        >
          <Feather name="x" size={12} color={colors.background} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 2 },
  canvas: { height: ITEM_H + TOP_PAD + 8, paddingTop: TOP_PAD },
  item: {
    position: "absolute",
    top: TOP_PAD,
    width: ITEM_W,
    height: ITEM_H,
  },
  thumb: {
    width: ITEM_W,
    height: ITEM_H,
    borderRadius: 12,
    overflow: "hidden",
  },
  coverDot: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  addTile: {
    position: "absolute",
    top: TOP_PAD,
    width: ITEM_W,
    height: ITEM_H,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addTileText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
  },
});
