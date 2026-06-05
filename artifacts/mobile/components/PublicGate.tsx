import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Shown while a live public page resolves the artist's archive from Supabase.
 * The status itself now lives in `PublicArtistContext`; these are just the two
 * verdict screens the slug routes render.
 */
export function PublicLoading() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.emerald} />
    </View>
  );
}

/**
 * Shown when a public link points at something that is private, unpublished, or
 * no longer on view. Deliberately quiet and non-committal — it never reveals
 * whether the content exists, only that it isn't publicly on view.
 */
export function PublicMissing() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <View style={[styles.circle, { backgroundColor: colors.secondary }]}>
        <Feather
          name="eye-off"
          size={22}
          color={colors.mutedForeground}
          style={{ opacity: 0.5 }}
        />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Not on view
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        This page is private or no longer part of a public exhibition.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_500Medium",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
    fontFamily: "Poppins_400Regular",
  },
});
