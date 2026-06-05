import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * "Save to Inspiration" — a deliberately quiet, private bookmark. No hearts, no
 * counts, no metrics: saving an artwork / collection / artist simply tucks it
 * onto the viewer's own Inspiration shelf to revisit later. Feedback is
 * opacity-only to keep the gesture calm and tactile.
 */
export function SaveButton({
  saved,
  onPress,
  variant = "pill",
  label,
  accessibilityLabel,
}: {
  saved: boolean;
  onPress: () => void;
  /** "float" = round translucent overlay button; "pill" = bordered text button. */
  variant?: "float" | "pill";
  /** Override the pill label. Defaults to "Save" / "Saved". */
  label?: string;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const text = label ?? (saved ? "Saved" : "Save");
  const tint = saved ? colors.cobalt : colors.mutedForeground;

  if (variant === "float") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? text}
        accessibilityState={{ selected: saved }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.float,
          { backgroundColor: "rgba(253,250,245,0.9)", opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <Feather name="bookmark" size={18} color={saved ? colors.cobalt : "#8A7B6C"} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: saved ? colors.cobalt : colors.border,
          backgroundColor: saved ? "rgba(107,127,163,0.08)" : "transparent",
          opacity: pressed ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.pillInner}>
        <Feather name="bookmark" size={15} color={tint} />
        <Text style={[styles.pillLabel, { color: tint }]}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  float: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
