import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCropper } from "@/components/ImageCropper";
import { SelectField } from "@/components/SelectField";
import { persistPieceImage } from "@/constants/imageStorage";
import { CLAY_OPTIONS, FIRING_ENVIRONMENT_OPTIONS } from "@/constants/pottery";
import { resolveImageSource } from "@/constants/seedImages";
import {
  DEFAULT_PUBLIC_DATA_SETTINGS,
  PUBLIC_DATA_FIELDS,
  PublicDataSettings,
  Visibility,
} from "@/constants/privacy";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

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
  const [cone, setCone] = useState(piece?.cone ?? "");
  const [firingEnvironment, setFiringEnvironment] = useState(
    piece?.firingEnvironment || piece?.firing || ""
  );
  const [dimensions, setDimensions] = useState(piece?.dimensions ?? "");
  const [year, setYear] = useState(piece?.year ?? "");
  const [visibility, setVisibility] = useState<Visibility>(piece?.visibility ?? "private");
  const [publicData, setPublicData] = useState<PublicDataSettings>(
    piece?.publicDataSettings ?? { ...DEFAULT_PUBLIC_DATA_SETTINGS }
  );
  const isPublic = visibility === "public";
  const [collectionId, setCollectionId] = useState<string | undefined>(piece?.collectionId);
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false);
  const [cropSource, setCropSource] = useState<
    { uri: string; width?: number; height?: number } | null
  >(null);
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
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this piece a name.");
      return;
    }
    setSaving(true);
    let storedImageUri: string;
    try {
      storedImageUri = await persistPieceImage(imageUri);
    } catch {
      setSaving(false);
      Alert.alert("Couldn’t save photo", "We couldn’t store that photo. Please try again.");
      return;
    }
    await updatePiece(id, {
      title: title.trim(),
      notes: notes.trim(),
      clay,
      glaze: glaze.trim(),
      firing: firingEnvironment,
      cone: cone.trim(),
      firingEnvironment,
      dimensions: dimensions.trim(),
      year: year.trim(),
      imageUri: storedImageUri,
      visibility,
      publicDataSettings: publicData,
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
            source={resolveImageSource(imageUri)}
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

          <Label text="Year" />
          <Field value={year} onChange={setYear} placeholder="e.g. 2026" />

          <Label text="Dimensions" />
          <Field value={dimensions} onChange={setDimensions} placeholder="e.g. 12 × 12 × 14 in (W × D × H)" />

          <Label text="Clay Body" />
          <ChipSelector options={CLAY_OPTIONS} value={clay} onChange={setClay} />

          <Label text="Glaze" />
          <Field value={glaze} onChange={setGlaze} placeholder="e.g. Celadon, Shino, Tenmoku" />

          <Label text="Cone" />
          <Field value={cone} onChange={setCone} placeholder="e.g. Cone 04, Cone 6, Cone 10" />

          <Label text="Firing Environment" />
          <SelectField
            value={firingEnvironment}
            options={FIRING_ENVIRONMENT_OPTIONS}
            placeholder="Select firing environment"
            title="Firing Environment"
            onChange={setFiringEnvironment}
          />

          <Label text="Notes" />
          <Field value={notes} onChange={setNotes} placeholder="Glaze recipe, firing notes, story…" multiline />

          {/* Collection */}
          <Label text="Collection" />
          <Pressable
            style={({ pressed }) => [
              styles.collectionRow,
              {
                backgroundColor: pressed ? colors.secondary : "transparent",
                borderColor: "rgba(120,110,100,0.18)",
                borderRadius: 10,
              },
            ]}
            onPress={() => setCollectionPickerVisible(true)}
          >
            <Feather
              name="layers"
              size={14}
              color={collectionId ? colors.cobalt : colors.mutedForeground}
              style={{ opacity: collectionId ? 1 : 0.6 }}
            />
            <Text
              style={[
                styles.collectionRowText,
                {
                  flex: 1,
                  color: collectionId ? colors.cobalt : colors.mutedForeground,
                  fontFamily: collectionId ? "Poppins_400Regular" : "Poppins_300Light",
                },
              ]}
            >
              {collectionId
                ? (collections.find((c) => c.id === collectionId)?.title ?? "Unknown collection")
                : "Add to Collection"}
            </Text>
            <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          </Pressable>

          {/* Visibility toggle */}
          <View style={styles.toggleSection}>
            <View style={[styles.toggleDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />
            <Pressable
              style={styles.toggleRow}
              onPress={() => setVisibility((v) => (v === "public" ? "private" : "public"))}
              accessibilityRole="switch"
              accessibilityState={{ checked: isPublic }}
              accessibilityLabel="Piece visibility"
            >
              <View style={styles.toggleLabels}>
                <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
                  {isPublic ? "Public" : "Private"}
                </Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                  {isPublic
                    ? "Visible on your public profile and in public collections"
                    : "Only visible to you, everywhere"}
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

            {/* Field-level public data controls */}
            {isPublic && (
              <View style={styles.publicData}>
                <Text style={[styles.publicDataLabel, { color: colors.mutedForeground }]}>
                  Public Details
                </Text>
                <Text style={[styles.publicDataHint, { color: colors.mutedForeground }]}>
                  Choose what shows on the public view of this piece.
                </Text>
                {PUBLIC_DATA_FIELDS.map((field, i) => {
                  const on = publicData[field.key];
                  return (
                    <Pressable
                      key={field.key}
                      style={[
                        styles.fieldToggleRow,
                        i > 0 && { borderTopWidth: 0.75, borderTopColor: "rgba(120,110,100,0.1)" },
                      ]}
                      onPress={() =>
                        setPublicData((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                      }
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={field.label}
                    >
                      <Text style={[styles.fieldToggleLabel, { color: colors.foreground }]}>
                        {field.label}
                      </Text>
                      <View
                        style={[
                          styles.toggleSm,
                          {
                            backgroundColor: on ? colors.emerald : colors.secondary,
                            borderColor: on ? colors.emerald : "rgba(120,110,100,0.2)",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.toggleSmThumb,
                            {
                              backgroundColor: on ? "#FFFFFF" : colors.mutedForeground,
                              transform: [{ translateX: on ? 15 : 2 }],
                            },
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <ImageCropper
        visible={!!cropSource}
        uri={cropSource?.uri ?? null}
        sourceWidth={cropSource?.width}
        sourceHeight={cropSource?.height}
        onCancel={() => setCropSource(null)}
        onConfirm={(uri) => {
          setImageUri(uri);
          setCropSource(null);
        }}
      />

      {/* Collection picker modal */}
      <Modal
        visible={collectionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectionPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCollectionPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalSheet,
                  {
                    backgroundColor: colors.background,
                    paddingBottom: Math.max(insets.bottom, 24),
                  },
                ]}
              >
                <View style={[styles.handle, { backgroundColor: "rgba(120,110,100,0.2)" }]} />

                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  Collection
                </Text>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  {collections.length === 0
                    ? "Create a collection first from the Collections tab."
                    : "Choose a collection for this piece."}
                </Text>

                <View style={[styles.sheetDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }} bounces={false}>
                  {/* None / remove option */}
                  {collectionId && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.collectionOption,
                        {
                          backgroundColor: pressed ? colors.secondary : "transparent",
                          borderColor: "rgba(120,110,100,0.1)",
                        },
                      ]}
                      onPress={() => { setCollectionId(undefined); setCollectionPickerVisible(false); }}
                    >
                      <View style={[styles.optionIconCircle, { backgroundColor: colors.secondary }]}>
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </View>
                      <Text style={[styles.optionTitle, { color: colors.mutedForeground }]}>
                        Remove from collection
                      </Text>
                    </Pressable>
                  )}

                  {collections.map((col) => {
                    const selected = collectionId === col.id;
                    return (
                      <Pressable
                        key={col.id}
                        style={({ pressed }) => [
                          styles.collectionOption,
                          {
                            backgroundColor: selected
                              ? "rgba(107,127,163,0.08)"
                              : pressed ? colors.secondary : "transparent",
                            borderColor: selected
                              ? "rgba(107,127,163,0.18)"
                              : "rgba(120,110,100,0.1)",
                          },
                        ]}
                        onPress={() => { setCollectionId(col.id); setCollectionPickerVisible(false); }}
                        disabled={selected}
                      >
                        <View
                          style={[
                            styles.optionIconCircle,
                            { backgroundColor: selected ? "rgba(107,127,163,0.12)" : colors.secondary },
                          ]}
                        >
                          <Feather name="layers" size={14} color={selected ? colors.cobalt : colors.mutedForeground} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionTitle, { color: selected ? colors.cobalt : colors.foreground }]}>
                            {col.title}
                          </Text>
                          {col.intro ? (
                            <Text style={[styles.optionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {col.intro}
                            </Text>
                          ) : null}
                        </View>
                        {selected && <Feather name="check" size={15} color={colors.cobalt} />}
                      </Pressable>
                    );
                  })}

                  {collections.length === 0 && (
                    <View style={styles.emptyCollections}>
                      <Feather name="layers" size={20} color={colors.mutedForeground} style={{ opacity: 0.35 }} />
                      <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>No collections yet</Text>
                    </View>
                  )}
                </ScrollView>

                <Pressable
                  style={({ pressed }) => [styles.sheetCancel, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => setCollectionPickerVisible(false)}
                >
                  <Text style={[styles.sheetCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.75,
    marginBottom: 4,
  },
  collectionRowText: { fontSize: 14, letterSpacing: 0.2 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,45,42,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.3, marginBottom: 6 },
  sheetSub: { fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 18, marginBottom: 16 },
  sheetDivider: { height: 1, marginBottom: 12 },
  collectionOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0.75,
    marginBottom: 8,
  },
  optionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { fontSize: 14, fontFamily: "Poppins_400Regular", letterSpacing: 0.1 },
  optionSub: { fontSize: 11, fontFamily: "Poppins_300Light", marginTop: 2 },
  emptyCollections: { alignItems: "center", paddingVertical: 28, gap: 10 },
  sheetCancel: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  sheetCancelText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
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
  publicData: { marginTop: 24 },
  publicDataLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  publicDataHint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    lineHeight: 18,
    marginBottom: 8,
  },
  fieldToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  fieldToggleLabel: { fontSize: 14, fontFamily: "Poppins_300Light" },
  toggleSm: {
    width: 36,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
  },
  toggleSmThumb: {
    width: 15,
    height: 15,
    borderRadius: 8,
    opacity: 0.85,
  },
});
