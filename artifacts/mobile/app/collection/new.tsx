import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setIntro(existing.intro);
    }
  }, [existing?.id]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this collection a name.");
      return;
    }
    setSaving(true);
    if (existing && editId) {
      await updateCollection(editId, { title: title.trim(), intro: intro.trim() });
    } else {
      await addCollection({ title: title.trim(), intro: intro.trim() });
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
  hint: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.75,
    marginTop: 12,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 18 },
});
