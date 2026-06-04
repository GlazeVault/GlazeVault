import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

import { PhotoSetEditor } from "@/components/PhotoSetEditor";
import { SelectField } from "@/components/SelectField";
import { persistPieceImage } from "@/constants/imageStorage";
import { CLAY_OPTIONS, FIRING_ENVIRONMENT_OPTIONS } from "@/constants/pottery";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import { chooseAction, notice } from "@/lib/notice";

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
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? "#FFFFFF" : colors.mutedForeground },
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function AddScreen() {
  const colors = useColors();
  const { addPiece } = usePottery();
  const { collections } = useCollections();
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [clay, setClay] = useState("");
  const [glaze, setGlaze] = useState("");
  const [cone, setCone] = useState("");
  const [firingEnvironment, setFiringEnvironment] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = async () => {
    if (images.length === 0) {
      notice({ title: "Image required", message: "Please add a photograph of your piece.", variant: "error" });
      return;
    }
    if (!title.trim()) {
      notice({ title: "Title required", message: "Give this piece a name.", variant: "error" });
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
      notice({ title: "Couldn’t save photo", message: "We couldn’t store those photos. Please try again.", variant: "error" });
      return;
    }
    const storedCover = storedImages[coverIndex] ?? storedImages[0];
    const created = await addPiece({ title: title.trim(), notes: notes.trim(), clay, glaze: glaze.trim(), firing: firingEnvironment, cone: cone.trim(), firingEnvironment, dimensions: dimensions.trim(), year: year.trim(), imageUri: storedCover, images: storedImages, collectionIds: collectionId ? [collectionId] : [] });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const wasUncollected = !collectionId;
    setImages([]); setCoverIndex(0); setTitle(""); setNotes(""); setClay(""); setGlaze(""); setCone(""); setFiringEnvironment(""); setDimensions(""); setYear(String(new Date().getFullYear())); setCollectionId(undefined);
    setSaving(false);
    router.replace("/");
    // Collections are purely organizational now (a piece's portfolio/public state
    // is set on the piece itself). When the piece isn't in one yet, gently offer
    // to file it into a series — Later is always fine.
    if (wasUncollected) {
      chooseAction(
        "Add this piece to a Collection?",
        "Collections help you organize your work into series and projects. You can always do this later.",
        [
          {
            text: "Choose a Collection",
            onPress: () => router.push({ pathname: "/piece/[id]", params: { id: created.id } }),
          },
          {
            text: "Create New",
            onPress: () =>
              router.push({ pathname: "/collection/new", params: { attachPieceId: created.id } }),
          },
          { text: "Later", style: "cancel" },
        ]
      );
    }
  };

  const Field = ({ value, onChange, placeholder, multiline = false }: {
    value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean;
  }) => (
    <TextInput
      style={[styles.input, multiline && styles.inputMulti, {
        color: colors.foreground,
        backgroundColor: "transparent",
        borderBottomColor: colors.border,
      }]}
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

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 28, paddingBottom: insets.bottom + 120 }]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Record a Piece</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Photos */}
      <PhotoSetEditor
        images={images}
        coverIndex={coverIndex}
        onChange={(next, cover) => {
          setImages(next);
          setCoverIndex(cover);
        }}
      />

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
                  <Text style={[styles.chipText, { color: !collectionId ? "#FFFFFF" : colors.mutedForeground }]}>
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
                      <Text style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.mutedForeground }]}>
                        {col.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: saving ? colors.accent : colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {saving ? "Saving…" : "Save to Archive"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28 },
  eyebrow: { fontSize: 11, fontFamily: "Poppins_500Medium", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 },
  heading: { fontSize: 32, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.4, lineHeight: 40, marginBottom: 20 },
  divider: { height: 1, width: 40, marginBottom: 28 },
  form: { gap: 6 },
  label: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 16,
    fontFamily: "Poppins_300Light",
    borderBottomWidth: 1,
  },
  inputMulti: { height: 80, paddingTop: 10 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  saveBtn: { paddingVertical: 18, alignItems: "center", marginTop: 36 },
  saveBtnText: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 1.5, textTransform: "uppercase" },
});
