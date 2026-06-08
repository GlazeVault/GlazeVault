import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { persistPieceImage } from "@/constants/imageStorage";
import { resolveImageSource } from "@/constants/seedImages";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { notice } from "@/lib/notice";

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    !submitting;

  const pickAvatar = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        notice({ title: "Permission needed", message: "Allow access to your photo library." });
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: Platform.OS === "web",
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    try {
      let stored: string;
      if (Platform.OS === "web") {
        if (!asset.base64) throw new Error("Picker returned no base64 data on web");
        stored = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
      } else {
        stored = await persistPieceImage(asset.uri);
      }
      setAvatarUri(stored);
    } catch {
      notice({
        title: "Couldn’t save photo",
        message: "We couldn’t store that photo. Please try again.",
        variant: "error",
      });
    }
  };

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
      const { needsConfirmation } = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        website: website.trim() || undefined,
        instagram: instagram.trim().replace(/^@/, "") || undefined,
        avatarUri,
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
            A few details about you as an artist. You can refine everything later.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={pickAvatar}
          style={styles.avatarRow}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            {avatarUri ? (
              <Image source={resolveImageSource(avatarUri)} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarPlus, { color: colors.mutedForeground }]}>+</Text>
            )}
          </View>
          <Text style={[styles.avatarLabel, { color: colors.mutedForeground }]}>
            {avatarUri ? "Change photo" : "Add a profile photo (optional)"}
          </Text>
        </Pressable>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name or studio"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
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

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.optionalNote, { color: colors.mutedForeground }]}>
          Optional — for your public portfolio
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Website</Text>
          <TextInput
            value={website}
            onChangeText={setWebsite}
            placeholder="studio.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={inputStyle}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Instagram</Text>
          <TextInput
            value={instagram}
            onChangeText={setInstagram}
            placeholder="@handle"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
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
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPlus: { fontSize: 28, fontFamily: "Poppins_300Light" },
  avatarLabel: { fontSize: 14, fontFamily: "Poppins_400Regular", flexShrink: 1 },
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
  divider: { height: 1, marginTop: 6 },
  optionalNote: { fontSize: 13, fontFamily: "Poppins_400Regular", fontStyle: "italic" },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  linkRow: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});
