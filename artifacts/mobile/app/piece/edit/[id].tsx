import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import { PhotoSetEditor } from "@/components/PhotoSetEditor";
import { SelectField } from "@/components/SelectField";
import { persistPieceImage } from "@/constants/imageStorage";
import { CLAY_OPTIONS, FIRING_ENVIRONMENT_OPTIONS } from "@/constants/pottery";
import { useCollections } from "@/context/CollectionsContext";
import { PotteryPiece, usePottery } from "@/context/PotteryContext";
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
  const { pieces } = usePottery();
  const colors = useColors();
  // Read the piece from the reactive pieces list so a cold load / reload of this
  // route re-renders once the archive finishes hydrating. The form lives in a
  // child that mounts only when the piece exists, so its useState initializers
  // always receive real values (avoids a blank screen on the load race).
  const piece = pieces.find((p) => p.id === id);

  if (!piece) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.cobalt} />
      </View>
    );
  }

  return <EditPieceForm piece={piece} />;
}

function EditPieceForm({ piece }: { piece: PotteryPiece }) {
  const { updatePiece } = usePottery();
  const { collections } = useCollections();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const id = piece.id;

  const initialImages =
    piece.images && piece.images.length > 0
      ? piece.images
      : piece.imageUri
        ? [piece.imageUri]
        : [];
  const [images, setImages] = useState<string[]>(initialImages);
  const [coverIndex, setCoverIndex] = useState(() => {
    const idx = piece.imageUri ? initialImages.indexOf(piece.imageUri) : 0;
    return idx >= 0 ? idx : 0;
  });
  const [title, setTitle] = useState(piece.title ?? "");
  const [notes, setNotes] = useState(piece.notes ?? "");
  const [clay, setClay] = useState(piece.clay ?? "");
  const [glaze, setGlaze] = useState(piece.glaze ?? "");
  const [cone, setCone] = useState(piece.cone ?? "");
  const [firingEnvironment, setFiringEnvironment] = useState(
    piece.firingEnvironment || piece.firing || ""
  );
  const [dimensions, setDimensions] = useState(piece.dimensions ?? "");
  const [year, setYear] = useState(piece.year ?? "");
  const [collectionIds, setCollectionIds] = useState<string[]>(piece.collectionIds ?? []);
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (images.length === 0) {
      Alert.alert("Image required", "Please add a photograph of your piece.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Title required", "Give this piece a name.");
      return;
    }
    setSaving(true);
    let storedImages: string[];
    try {
      // Fail-closed: persist every photo before saving so no temp picker URI is
      // ever stored. The chosen cover keeps its position in the array.
      storedImages = await Promise.all(images.map((uri) => persistPieceImage(uri)));
    } catch {
      setSaving(false);
      Alert.alert("Couldn’t save photo", "We couldn’t store those photos. Please try again.");
      return;
    }
    const storedCover = storedImages[coverIndex] ?? storedImages[0];
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
      imageUri: storedCover,
      images: storedImages,
      collectionIds,
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
        {/* Photos */}
        <View style={styles.photosBlock}>
          <PhotoSetEditor
            images={images}
            coverIndex={coverIndex}
            onChange={(next, cover) => {
              setImages(next);
              setCoverIndex(cover);
            }}
          />
        </View>

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
              color={collectionIds.length > 0 ? colors.cobalt : colors.mutedForeground}
              style={{ opacity: collectionIds.length > 0 ? 1 : 0.6 }}
            />
            <Text
              style={[
                styles.collectionRowText,
                {
                  flex: 1,
                  color: collectionIds.length > 0 ? colors.cobalt : colors.mutedForeground,
                  fontFamily: collectionIds.length > 0 ? "Poppins_400Regular" : "Poppins_300Light",
                },
              ]}
            >
              {collectionIds.length === 0
                ? "Add to Collections"
                : collectionIds.length === 1
                  ? (collections.find((c) => c.id === collectionIds[0])?.title ?? "1 collection")
                  : `${collectionIds.length} collections`}
            </Text>
            <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

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
                  Collections
                </Text>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  {collections.length === 0
                    ? "Create a collection first from the Collections tab."
                    : "A piece can belong to any number of collections."}
                </Text>

                <View style={[styles.sheetDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }} bounces={false}>
                  {collections.map((col) => {
                    const selected = collectionIds.includes(col.id);
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
                        onPress={() =>
                          setCollectionIds((prev) =>
                            prev.includes(col.id)
                              ? prev.filter((id) => id !== col.id)
                              : [...prev, col.id]
                          )
                        }
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 48 },
  headerTitle: { fontSize: 16, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.3 },
  saveText: { fontSize: 14, fontFamily: "Poppins_500Medium", textAlign: "right" },
  container: { paddingHorizontal: 28, paddingTop: 24 },
  photosBlock: { marginBottom: 20 },
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
});
