import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * "Follow Artist" — a quiet way to keep an artist's archive close so you can
 * revisit new public collections and returning work later. This is NOT
 * influencer following: there are no follower counts, no rankings, no stats.
 * Feedback is opacity-only to keep the interaction calm.
 */
export function FollowButton({
  following,
  onPress,
}: {
  following: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const label = following ? "Following" : "Follow Artist";
  const tint = following ? colors.foreground : colors.cobalt;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: following }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: following ? colors.border : colors.cobalt,
          backgroundColor: following ? colors.secondary : "transparent",
          opacity: pressed ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.inner}>
        <Feather name={following ? "check" : "plus"} size={15} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
