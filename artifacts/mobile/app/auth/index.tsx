import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function AuthStartScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.hero}>
        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>GLAZEVAULT</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          A lifelong archive{"\n"}for your ceramic work
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Quietly record each piece — its glazes, firings, and notes — and share
          collections as private exhibitions when you’re ready.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/auth/signup")}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Create your archive
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/auth/login")}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", gap: 18 },
  kicker: { fontSize: 12, fontFamily: "Poppins_500Medium", letterSpacing: 3 },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: "PlayfairDisplay_400Regular",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Poppins_300Light",
    maxWidth: 360,
  },
  actions: { gap: 12, paddingBottom: 24 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  secondaryBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 16, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
});
