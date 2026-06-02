import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { persistPieceImage } from "@/constants/imageStorage";
import { Visibility } from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { useColors } from "@/hooks/useColors";

export default function NewCollectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCollection, getCollection, updateCollection } = useCollections();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const existing = editId ? getCollection(editId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [intro, setIntro] = useState(existing?.intro ?? "");
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "private");
  const [featuredOnSite, setFeaturedOnSite] = useState<boolean>(
    existing?.featuredOnSite ?? false
  );
  const [coverImageUri, setCoverImageUri] = useState(existing?.coverImageUri ?? "");
  const [saving, setSaving] = useState(false);
  // Prevents overlapping picker runs (and duplicate native file copies).
  const pickingCover = useRef(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setIntro(existing.intro);
      setVisibility(existing.visibility);
      setFeaturedOnSite(existing.featuredOnSite);
      setCoverImageUri(existing.coverImageUri ?? "");
    }
  }, [existing?.id]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const pickCover = async () => {
    if (pickingCover.current) return;
    pickingCover.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const stored = await persistPieceImage(result.assets[0].uri);
        setCoverImageUri(stored);
      }
    } catch (e) {
      console.warn("Failed to pick collection cover", e);
      Alert.alert("Couldn't add image", "Something went wrong choosing that image.");
    } finally {
      pickingCover.current = false;
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this collection a name.");
      return;
    }
    setSaving(true);
    const featured = visibility === "public" ? featuredOnSite : false;
    if (existing && editId) {
      await updateCollection(editId, {
        title: title.trim(),
        intro: intro.trim(),
        visibility,
        featuredOnSite: featured,
        coverImageUri: coverImageUri || undefined,
      });
    } else {
      await addCollection({
        title: title.trim(),
        intro: intro.trim(),
        visibility,
        featuredOnSite: featured,
        coverImageUri: coverImageUri || undefined,
      });
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: "rgba(120,110,100,0.14)", backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {existing ? "Edit Collection" : "New Collection"}
        </Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.headerBtn}>
          <Text style={[styles.saveText, { color: saving ? colors.mutedForeground : colors.cobalt }]}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Group your works into a curated series, theme, or firing session.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Collection Name</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Passage Series, White Slip Works…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Introduction</Text>
          <TextInput
            style={[styles.inputMulti, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
            value={intro}
            onChangeText={setIntro}
            placeholder="A short description of this series or grouping…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Cover Image</Text>
          {coverImageUri ? (
            <View style={styles.coverWrap}>
              <Image
                source={resolveImageSource(coverImageUri)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.coverActions}>
                <Pressable
                  style={[styles.coverBtn, { backgroundColor: "rgba(253,250,245,0.92)" }]}
                  onPress={pickCover}
                >
                  <Feather name="refresh-cw" size={13} color="#8A7B6C" />
                  <Text style={[styles.coverBtnText, { color: "#8A7B6C" }]}>Replace</Text>
                </Pressable>
                <Pressable
                  style={[styles.coverBtn, { backgroundColor: "rgba(253,250,245,0.92)" }]}
                  onPress={() => setCoverImageUri("")}
                >
                  <Feather name="trash-2" size={13} color={colors.destructive} />
                  <Text style={[styles.coverBtnText, { color: colors.destructive }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.coverPicker, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.2)" }]}
              onPress={pickCover}
            >
              <Feather name="image" size={20} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
              <Text style={[styles.coverPickerText, { color: colors.mutedForeground }]}>
                Choose a cover image
              </Text>
              <Text style={[styles.coverPickerHint, { color: colors.mutedForeground }]}>
                Falls back to a public piece if left empty
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Visibility</Text>
          <Pressable
            style={[
              styles.visibilityRow,
              {
                backgroundColor:
                  visibility === "public" ? "rgba(107,139,122,0.1)" : colors.secondary,
                borderColor:
                  visibility === "public"
                    ? "rgba(107,139,122,0.3)"
                    : "rgba(120,110,100,0.16)",
              },
            ]}
            onPress={() =>
              setVisibility((v) => {
                const next = v === "public" ? "private" : "public";
                if (next === "private") setFeaturedOnSite(false);
                return next;
              })
            }
            accessibilityRole="switch"
            accessibilityState={{ checked: visibility === "public" }}
            accessibilityLabel="Collection visibility"
          >
            <Feather
              name={visibility === "public" ? "globe" : "lock"}
              size={14}
              color={visibility === "public" ? colors.emerald : colors.mutedForeground}
            />
            <View style={styles.visibilityLabels}>
              <Text
                style={[
                  styles.visibilityTitle,
                  { color: visibility === "public" ? colors.emerald : colors.foreground },
                ]}
              >
                {visibility === "public" ? "Public" : "Private"}
              </Text>
              <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                {visibility === "public"
                  ? "Public pieces in here are visible to others"
                  : "Hidden from everyone but you"}
              </Text>
            </View>
            <View
              style={[
                styles.visToggle,
                {
                  backgroundColor:
                    visibility === "public" ? colors.emerald : "rgba(120,110,100,0.18)",
                },
              ]}
            >
              <View
                style={[
                  styles.visToggleThumb,
                  { transform: [{ translateX: visibility === "public" ? 18 : 2 }] },
                ]}
              />
            </View>
          </Pressable>
        </View>

        {visibility === "public" ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Public Site</Text>
            <Pressable
              style={[
                styles.visibilityRow,
                {
                  backgroundColor: featuredOnSite ? "rgba(107,127,163,0.1)" : colors.secondary,
                  borderColor: featuredOnSite
                    ? "rgba(107,127,163,0.3)"
                    : "rgba(120,110,100,0.16)",
                },
              ]}
              onPress={() => setFeaturedOnSite((f) => !f)}
              accessibilityRole="switch"
              accessibilityState={{ checked: featuredOnSite }}
              accessibilityLabel="Feature on public site"
            >
              <Feather
                name="star"
                size={14}
                color={featuredOnSite ? colors.cobalt : colors.mutedForeground}
              />
              <View style={styles.visibilityLabels}>
                <Text
                  style={[
                    styles.visibilityTitle,
                    { color: featuredOnSite ? colors.cobalt : colors.foreground },
                  ]}
                >
                  Feature on Public Site
                </Text>
                <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                  {featuredOnSite
                    ? "Highlighted on your public site"
                    : "Not shown on your public site"}
                </Text>
              </View>
              <View
                style={[
                  styles.visToggle,
                  {
                    backgroundColor: featuredOnSite ? colors.cobalt : "rgba(120,110,100,0.18)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.visToggleThumb,
                    { transform: [{ translateX: featuredOnSite ? 18 : 2 }] },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.hint, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.12)" }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Add pieces to this collection from each piece's edit screen.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.75,
  },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 48 },
  headerTitle: { fontSize: 16, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.3 },
  saveText: { fontSize: 14, fontFamily: "Poppins_500Medium", textAlign: "right" },
  form: { paddingHorizontal: 28, paddingTop: 32 },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  intro: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
    marginBottom: 36,
  },
  fieldGroup: { marginBottom: 28 },
  label: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  input: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_400Regular",
    paddingVertical: 8,
    borderBottomWidth: 0.75,
    letterSpacing: 0.3,
  },
  inputMulti: {
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    paddingVertical: 8,
    borderBottomWidth: 0.75,
    minHeight: 80,
    lineHeight: 24,
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  coverActions: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    gap: 8,
  },
  coverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  coverBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  coverPicker: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    aspectRatio: 16 / 10,
    borderRadius: 14,
    borderWidth: 0.75,
    borderStyle: "dashed",
  },
  coverPickerText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  coverPickerHint: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  hint: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.75,
    marginTop: 12,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 18 },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  visibilityLabels: { flex: 1, gap: 2 },
  visibilityTitle: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  visibilitySub: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  visToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  visToggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
});
