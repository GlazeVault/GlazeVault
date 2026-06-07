import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

/**
 * A small, always-visible floating button in the top-right corner of every main
 * screen. It is the single discoverable entry point to the Account / Settings
 * screen, where an artist can see who they are signed in as and log out — so a
 * user stuck inside an old session never has to know a hidden route to exit.
 *
 * It only navigates; it never touches the archive, collections, portfolio,
 * upload, or hero-image flows.
 */
export function AccountButton() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top + 6;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
        hitSlop={8}
        onPress={() => router.push("/settings")}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: "rgba(245, 241, 232, 0.92)",
            borderColor: "rgba(120, 110, 100, 0.16)",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Feather name="user" size={18} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    zIndex: 50,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#2D2D2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
});
