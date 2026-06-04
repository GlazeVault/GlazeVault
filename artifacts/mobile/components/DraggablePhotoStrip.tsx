import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";

const ITEM_W = 72;
const GAP = 12;
const STRIDE = ITEM_W + GAP;
const ITEM_H = (ITEM_W * 5) / 4;
const TOP_PAD = 8;

type Colors = ReturnType<typeof useColors>;

interface DraggablePhotoStripProps {
  images: string[];
  coverIndex: number;
  /** Move the photo at `from` to `to`, preserving which photo is the cover. */
  onReorder: (from: number, to: number) => void;
  onSetCover: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
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

  const contentWidth = count * STRIDE + ITEM_W + 8;

  return (
    <ScrollView
      horizontal
      scrollEnabled={scrollEnabled}
      showsHorizontalScrollIndicator={false}
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
            onReorder={onReorder}
            onSetCover={onSetCover}
            onRemove={onRemove}
            setScrollEnabled={setScrollEnabled}
          />
        ))}

        <Pressable
          style={({ pressed }) => [
            styles.addTile,
            { left: count * STRIDE, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onAdd}
        >
          <Feather name="plus" size={20} color={colors.mutedForeground} />
          <Text style={[styles.addTileText, { color: colors.mutedForeground }]}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  onReorder: (from: number, to: number) => void;
  onSetCover: (index: number) => void;
  onRemove: (index: number) => void;
  setScrollEnabled: (enabled: boolean) => void;
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragX.value = 0;
      runOnJS(setScrollEnabled)(false);
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      const target = Math.round((index * STRIDE + dragX.value) / STRIDE);
      hoverIndex.value = Math.min(Math.max(target, 0), count - 1);
    })
    .onEnd(() => {
      const from = index;
      const to = hoverIndex.value;
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragX.value = 0;
      if (to >= 0 && from !== to) {
        runOnJS(onReorder)(from, to);
      }
    })
    .onFinalize(() => {
      runOnJS(setScrollEnabled)(true);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    if (isActive) {
      return {
        transform: [{ translateX: dragX.value }, { scale: 1.08 }],
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
      transform: [{ translateX: withTiming(shift, { duration: 160 }) }, { scale: 1 }],
      zIndex: 1,
      opacity: 1,
    };
  });

  return (
    <Animated.View style={[styles.item, { left: index * STRIDE }, animatedStyle]}>
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
            <View style={[styles.coverDot, { backgroundColor: colors.emerald }]}>
              <Feather name="star" size={9} color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      </GestureDetector>
      <Pressable
        style={[styles.removeBtn, { backgroundColor: colors.foreground }]}
        onPress={() => onRemove(index)}
        hitSlop={6}
      >
        <Feather name="x" size={12} color={colors.background} />
      </Pressable>
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
  addTileText: { fontSize: 11, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
});
