import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { confirm } from "@/lib/confirm";
import { notice } from "@/lib/notice";

/**
 * Account / Settings — a small dedicated screen so an artist can see who they
 * are signed in as and end their session without deleting the app or clearing
 * browser data. It only reads auth state and signs out; it never touches the
 * archive, collections, portfolio, or upload flows.
 */
export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isConfigured, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loggingOut, setLoggingOut] = useState(false);

  const email = user?.email ?? "";

  const handleLogout = async () => {
    if (loggingOut) return;
    const ok = await confirm({
      title: "Log out?",
      message: "Your archive stays safe in the cloud. You can log back in anytime.",
      confirmText: "Log out",
      cancelText: "Stay",
    });
    if (!ok) return;
    setLoggingOut(true);
    console.log("[settings] logout requested");
    try {
      await signOut();
      // The auth gate clears the session and redirects to the sign-in flow.
      console.log("[settings] signed out; auth gate will redirect");
    } catch (e) {
      console.warn("[settings] logout failed", e);
      setLoggingOut(false);
      notice({ title: "Couldn’t log out", message: "Please try again.", variant: "error" });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Account</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Signed in as</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatarDot, { backgroundColor: colors.secondary }]}>
            <Feather name="user" size={18} color={colors.cobalt} />
          </View>
          <View style={styles.cardText}>
            {isConfigured && email ? (
              <Text style={[styles.email, { color: colors.foreground }]} numberOfLines={1}>
                {email}
              </Text>
            ) : (
              <Text style={[styles.email, { color: colors.foreground }]}>
                Offline account
              </Text>
            )}
            <Text style={[styles.emailHint, { color: colors.mutedForeground }]}>
              {isConfigured
                ? "This is the email tied to your studio archive."
                : "Sign-in isn’t configured on this device."}
            </Text>
          </View>
        </View>

        {isConfigured ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 28 }]}>
              Session
            </Text>
            <Pressable
              style={[
                styles.logoutBtn,
                { borderColor: colors.border, opacity: loggingOut ? 0.6 : 1 },
              ]}
              onPress={handleLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather name="log-out" size={15} color={colors.destructive} />
              )}
              <Text style={[styles.logoutText, { color: colors.foreground }]}>
                {loggingOut ? "Logging out…" : "Log out"}
              </Text>
            </Pressable>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              Logging out clears your session and returns you to the sign-in screen.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  email: { fontSize: 15, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  emailHint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    lineHeight: 17,
    marginTop: 3,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  helper: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
});
