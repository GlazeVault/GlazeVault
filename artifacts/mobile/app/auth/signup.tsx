import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { notice } from "@/lib/notice";

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && !submitting;

  const handleSignUp = async () => {
    if (!canSubmit) {
      if (password.length > 0 && password.length < 6) {
        notice({
          title: "Password too short",
          message: "Use at least 6 characters.",
          variant: "error",
        });
      }
      return;
    }
    setSubmitting(true);
    try {
      // Email + password only — the artist adds their name and any public
      // details later from the Profile tab. A fresh, empty archive initializes
      // automatically once the session is established.
      const { needsConfirmation } = await signUp({
        email: email.trim(),
        password,
      });
      if (needsConfirmation) {
        notice({
          title: "Confirm your email",
          message:
            "We sent a confirmation link to your email. Open it, then log in to begin your archive.",
          variant: "info",
        });
        router.replace("/auth/login");
      }
      // Otherwise the auth gate redirects to the (empty) archive automatically.
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Please try again in a moment.";
      notice({ title: "Couldn’t create account", message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.back, { color: colors.mutedForeground }]}>← Back</Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.foreground }]}>Create your archive</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            A private studio archive for your ceramic work. Your archive,
            collections, and portfolio are saved privately to your account.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@studio.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            textContentType="newPassword"
            style={inputStyle}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleSignUp}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: !canSubmit ? 0.5 : pressed ? 0.9 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Begin my archive
            </Text>
          )}
        </Pressable>

        <Text style={[styles.reassure, { color: colors.mutedForeground }]}>
          You can add your name and studio details anytime from your profile.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/auth/login")}
          style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
            Already have an archive?{" "}
            <Text style={{ color: colors.primary, fontFamily: "Poppins_500Medium" }}>Log in</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 4 },
  back: { fontSize: 15, fontFamily: "Poppins_400Regular" },
  scroll: { paddingHorizontal: 28, paddingTop: 16, gap: 18 },
  intro: { gap: 8, marginBottom: 4 },
  title: { fontSize: 28, fontFamily: "PlayfairDisplay_400Regular" },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: "Poppins_300Light" },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Poppins_500Medium", letterSpacing: 0.5 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
  },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  reassure: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  linkRow: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});
