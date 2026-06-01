import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

const CLAY_OPTIONS = ["Stoneware", "Porcelain", "Earthenware", "Terracotta", "Raku", "Bone China"];
const FIRING_OPTIONS = ["Wood-fired", "Gas Reduction", "Electric", "Soda / Salt", "Raku", "Anagama"];

function ChipSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.cobalt : "transparent",
                  borderColor: selected ? colors.cobalt : colors.border,
                  borderRadius: 24,
                },
              ]}
              onPress={() => onChange(selected ? "" : opt)}
            >
              <Text style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.mutedForeground }]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function EditPieceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPiece, updatePiece } = usePottery();
  const { collections } = useCollections();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const piece = getPiece(id);

  const [imageUri, setImageUri] = useState(piece?.imageUri ?? "");
  const [title, setTitle] = useState(piece?.title ?? "");
  const [notes, setNotes] = useState(piece?.notes ?? "");
  const [clay, setClay] = useState(piece?.clay ?? "");
  const [glaze, setGlaze] = useState(piece?.glaze ?? "");
  const [firing, setFiring] = useState(piece?.firing ?? "");
  const [dimensions, setDimensions] = useState(piece?.dimensions ?? "");
  const [isPublic, setIsPublic] = useState(piece?.isPublic ?? false);
  const [collectionId, setCollectionId] = useState<string | undefined>(piece?.collectionId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!piece) router.back();
  }, [piece]);

  if (!piece) return null;

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this piece a name.");
      return;
    }
    setSaving(true);
    await updatePiece(id, {
      title: title.trim(),
      notes: notes.trim(),
      clay,
      glaze: glaze.trim(),
      firing,
      dimensions: dimensions.trim(),
      imageUri,
      isPublic,
      collectionId,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  const Field = ({
    value,
    onChange,
    placeholder,
    multiline = false,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    multiline?: boolean;
  }) => (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMulti,
        { color: colors.foreground, backgroundColor: "transparent", borderBottomColor: colors.border },
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );

  const Label = ({ text }: { text: string }) => (
    <Text style={[styles.label, { color: colors.mutedForeground }]}>{text}</Text>
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            borderBottomColor: "rgba(120,110,100,0.14)",
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Piece</Text>
        <Pressable onPress={handleSave} disabled={saving} style={styles.headerBtn}>
          <Text style={[styles.saveText, { color: saving ? colors.mutedForeground : colors.cobalt }]}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        <Pressable
          style={[
            styles.imagePicker,
            { borderRadius: colors.radius, borderColor: colors.border, backgroundColor: colors.secondary },
          ]}
          onPress={pickImage}
        >
          <Image
            source={{ uri: imageUri }}
            style={[styles.previewImage, { borderRadius: colors.radius }]}
            contentFit="cover"
          />
          <View style={styles.changeOverlay}>
            <Feather name="camera" size={16} color="#FFFFFF" />
            <Text style={styles.changeText}>Change photo</Text>
          </View>
        </Pressable>

        <View style={styles.form}>
          <Label text="Title" />
          <Field value={title} onChange={setTitle} placeholder="e.g. Wabi Yunomi" />

          <Label text="Notes" />
          <Field value={notes} onChange={setNotes} placeholder="Glaze recipe, firing notes, story…" multiline />

          <Label text="Clay Body" />
          <ChipSelector options={CLAY_OPTIONS} value={clay} onChange={setClay} />

          <Label text="Glaze" />
          <Field value={glaze} onChange={setGlaze} placeholder="e.g. Celadon, Shino, Tenmoku" />

          <Label text="Firing" />
          <ChipSelector options={FIRING_OPTIONS} value={firing} onChange={setFiring} />

          <Label text="Dimensions" />
          <Field value={dimensions} onChange={setDimensions} placeholder="e.g. 9 cm H × 11 cm W" />

          {/* Collection */}
          {collections.length > 0 && (
            <>
              <Label text="Collection" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[
                      styles.chip,
                      {
                        backgroundColor: !collectionId ? colors.cobalt : "transparent",
                        borderColor: !collectionId ? colors.cobalt : colors.border,
                        borderRadius: 24,
                      },
                    ]}
                    onPress={() => setCollectionId(undefined)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: !collectionId ? "#FFFFFF" : colors.mutedForeground },
                      ]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {collections.map((col) => {
                    const selected = collectionId === col.id;
                    return (
                      <Pressable
                        key={col.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.cobalt : "transparent",
                            borderColor: selected ? colors.cobalt : colors.border,
                            borderRadius: 24,
                          },
                        ]}
                        onPress={() => setCollectionId(selected ? undefined : col.id)}
                      >
                        <Text
                          style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.mutedForeground }]}
                        >
                          {col.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}

          {/* Visibility toggle */}
          <View style={styles.toggleSection}>
            <View style={[styles.toggleDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />
            <Pressable
              style={styles.toggleRow}
              onPress={() => setIsPublic((v) => !v)}
            >
              <View style={styles.toggleLabels}>
                <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
                  Public Portfolio
                </Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                  {isPublic
                    ? "Visible on your public profile"
                    : "Only visible to you"}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  {
                    backgroundColor: isPublic
                      ? colors.emerald
                      : colors.secondary,
                    borderColor: isPublic ? colors.emerald : "rgba(120,110,100,0.2)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      backgroundColor: isPublic ? "#FFFFFF" : colors.mutedForeground,
                      transform: [{ translateX: isPublic ? 18 : 2 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
          </View>
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
  container: { paddingHorizontal: 28, paddingTop: 24 },
  imagePicker: {
    width: "100%",
    aspectRatio: 4 / 5,
    overflow: "hidden",
    marginBottom: 28,
  },
  previewImage: { width: "100%", height: "100%" },
  changeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(45,45,42,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  changeText: { color: "#FFFFFF", fontFamily: "Poppins_400Regular", fontSize: 12 },
  form: { gap: 4 },
  label: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    borderBottomWidth: 1,
  },
  inputMulti: { height: 80, paddingTop: 10 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  toggleSection: { marginTop: 24 },
  toggleDivider: { height: 1, marginBottom: 20 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleLabels: { flex: 1, gap: 3, paddingRight: 16 },
  toggleTitle: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  toggleSub: { fontSize: 12, fontFamily: "Poppins_300Light" },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.85,
  },
});
