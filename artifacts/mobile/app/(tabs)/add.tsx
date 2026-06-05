import { Feather } from "@expo/vector-icons";
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

import { AdvancedPublicVisibility } from "@/components/AdvancedPublicVisibility";
import { PhotoSetEditor } from "@/components/PhotoSetEditor";
import { SelectField } from "@/components/SelectField";
import { persistPieceImage } from "@/constants/imageStorage";
import { CLAY_OPTIONS, FIRING_ENVIRONMENT_OPTIONS } from "@/constants/pottery";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import { notice } from "@/lib/notice";

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
  const [isPublic, setIsPublic] = useState(false);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  // Per-piece public field exposure, both OFF by default. Only meaningful when
  // the piece is Public; reset whenever the piece goes back to Private.
  const [showGlazeDetails, setShowGlazeDetails] = useState(false);
  const [showStudioNotes, setShowStudioNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Progressive disclosure: a piece is Private by default; only a Public piece
  // can be filed into collections, and only a collected public piece can be
  // featured. Backing out of a step clears the steps it gates.
  const togglePublic = () => {
    setIsPublic((v) => {
      const next = !v;
      if (!next) {
        setCollectionIds([]);
        setFeatured(false);
        setShowGlazeDetails(false);
        setShowStudioNotes(false);
      }
      return next;
    });
  };
  const toggleCollection = (collectionId: string) => {
    setCollectionIds((prev) => {
      const next = prev.includes(collectionId)
        ? prev.filter((c) => c !== collectionId)
        : [...prev, collectionId];
      if (next.length === 0) setFeatured(false);
      return next;
    });
  };
  // "None" is the calm default: a public piece needs no collection. Choosing it
  // clears any grouping and folds the (collection-gated) Feature step back away.
  const selectNone = () => {
    setCollectionIds([]);
    setFeatured(false);
  };

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
    // The piece carries the choices made through the stepped flow. The portfolio
    // gate is re-applied here so featuredInPortfolio can never be saved true for a
    // piece that isn't both public and collected.
    const canFeature = isPublic && collectionIds.length > 0;
    await addPiece({
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
      isPublic,
      collectionIds: isPublic ? collectionIds : [],
      featuredInPortfolio: canFeature && featured,
      // Field-exposure flags only apply to a public piece; force off otherwise
      // so a private piece can never carry an opted-in flag.
      showGlazeDetails: isPublic ? showGlazeDetails : false,
      showStudioNotes: isPublic ? showStudioNotes : false,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImages([]); setCoverIndex(0); setTitle(""); setNotes(""); setClay(""); setGlaze(""); setCone(""); setFiringEnvironment(""); setDimensions(""); setYear(String(new Date().getFullYear()));
    setIsPublic(false); setCollectionIds([]); setFeatured(false);
    setShowGlazeDetails(false); setShowStudioNotes(false);
    setSaving(false);
    router.replace("/");
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

        {/* Stepped disclosure: Private by default → Public unlocks Collections →
            a collected public piece can be Featured in the Portfolio. */}
        <Label text="Visibility" />
        <Pressable
          style={[
            styles.toggleRow,
            {
              backgroundColor: isPublic ? "rgba(107,127,163,0.1)" : colors.secondary,
              borderColor: isPublic ? "rgba(107,127,163,0.3)" : "rgba(120,110,100,0.16)",
            },
          ]}
          onPress={togglePublic}
          accessibilityRole="switch"
          accessibilityState={{ checked: isPublic }}
          accessibilityLabel="Public"
        >
          <Feather name={isPublic ? "globe" : "lock"} size={14} color={isPublic ? colors.cobalt : colors.mutedForeground} />
          <View style={styles.toggleLabels}>
            <Text style={[styles.toggleTitle, { color: isPublic ? colors.cobalt : colors.foreground }]}>
              {isPublic ? "Public" : "Private"}
            </Text>
            <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
              {isPublic ? "Viewable in your public collections and archive" : "Only you can see this piece"}
            </Text>
          </View>
          <View style={[styles.visToggle, { backgroundColor: isPublic ? colors.cobalt : "rgba(120,110,100,0.18)" }]}>
            <View style={[styles.visToggleThumb, { transform: [{ translateX: isPublic ? 18 : 2 }] }]} />
          </View>
        </Pressable>

        {isPublic && (
          <AdvancedPublicVisibility
            showGlazeDetails={showGlazeDetails}
            showStudioNotes={showStudioNotes}
            onToggleGlaze={() => setShowGlazeDetails((v) => !v)}
            onToggleNotes={() => setShowStudioNotes((v) => !v)}
          />
        )}

        {isPublic && (
          <>
            <Label text="Collection" />
            {collections.length === 0 ? (
              <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>
                This piece will be saved as a standalone public piece. Create a collection from the Collections tab to group and feature it.
              </Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {/* "None" is the default — a public piece never requires a
                        collection. It stands first and selected until the artist
                        chooses to file the piece somewhere. */}
                    <Pressable
                      key="none"
                      style={[
                        styles.chip,
                        {
                          backgroundColor: collectionIds.length === 0 ? colors.cobalt : "transparent",
                          borderColor: collectionIds.length === 0 ? colors.cobalt : colors.border,
                          borderRadius: 24,
                        },
                      ]}
                      onPress={selectNone}
                    >
                      <Text style={[styles.chipText, { color: collectionIds.length === 0 ? "#FFFFFF" : colors.mutedForeground }]}>
                        None
                      </Text>
                    </Pressable>
                    {collections.map((col) => {
                      const selected = collectionIds.includes(col.id);
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
                          onPress={() => toggleCollection(col.id)}
                        >
                          <Text style={[styles.chipText, { color: selected ? "#FFFFFF" : colors.mutedForeground }]}>
                            {col.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>
                  {collectionIds.length === 0
                    ? "Optional — saved as a standalone public piece."
                    : "Filed into your selected collection."}
                </Text>
              </>
            )}
          </>
        )}

        {isPublic && collectionIds.length > 0 && (
          <>
            <Label text="Portfolio" />
            <Pressable
              style={[
                styles.toggleRow,
                {
                  backgroundColor: featured ? "rgba(107,139,122,0.1)" : colors.secondary,
                  borderColor: featured ? "rgba(107,139,122,0.3)" : "rgba(120,110,100,0.16)",
                },
              ]}
              onPress={() => setFeatured((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: featured }}
              accessibilityLabel="Feature in Portfolio"
            >
              <Feather name="star" size={14} color={featured ? colors.emerald : colors.mutedForeground} />
              <View style={styles.toggleLabels}>
                <Text style={[styles.toggleTitle, { color: featured ? colors.emerald : colors.foreground }]}>
                  Feature in Portfolio
                </Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                  {featured ? "Hand-picked for your curated portfolio" : "Show this piece among your selected works"}
                </Text>
              </View>
              <View style={[styles.visToggle, { backgroundColor: featured ? colors.emerald : "rgba(120,110,100,0.18)" }]}>
                <View style={[styles.visToggleThumb, { transform: [{ translateX: featured ? 18 : 2 }] }]} />
              </View>
            </Pressable>
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
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 0.75, marginBottom: 4 },
  toggleLabels: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  toggleSub: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  visToggle: { width: 42, height: 24, borderRadius: 12, justifyContent: "center" },
  visToggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
  stepHint: { fontSize: 12, fontFamily: "Poppins_300Light", lineHeight: 18, paddingVertical: 4 },
});
