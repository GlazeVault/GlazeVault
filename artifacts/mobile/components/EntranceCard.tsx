import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EntranceCardProps {
  /** 1-based position, shown as a quiet "01" eyebrow. */
  index: number;
  title: string;
  subtitle: string;
  onPress: () => void;
}

/**
 * A single calm "doorway" into one wing of the artist's space. Designed to feel
 * like an entrance in a gallery — spacious, editorial, tactile — rather than a
 * dashboard tile: a hairline-bordered field of quiet space, a numbered eyebrow,
 * a serif title, one soft line of subtitle, and a small directional mark. Cards
 * rise-and-fade in on mount, staggered, so entering the foyer feels unhurried.
 */
export function EntranceCard({ index, title, subtitle, onPress }: EntranceCardProps) {
  const colors = useColors();
  const pressed = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    const delay = (index - 1) * 90 + 120;
    opacity.value = withDelay(delay, withTiming(1, { duration: 560 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: 1 - pressed.value * 0.015 },
    ],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 120 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 220 });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: colors.cobalt }]}>
          {String(index).padStart(2, "0")}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      </View>
      <Feather name="arrow-up-right" size={20} color={colors.mutedForeground} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  body: {
    flex: 1,
    paddingRight: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 27,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    lineHeight: 20,
  },
});
