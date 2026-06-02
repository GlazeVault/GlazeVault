import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
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

import { SelectField } from "@/components/SelectField";
import { CLAY_OPTIONS, FIRING_ENVIRONMENT_OPTIONS } from "@/constants/pottery";
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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [clay, setClay] = useState("");
  const [glaze, setGlaze] = useState("");
  const [cone, setCone] = useState("");
  const [firingEnvironment, setFiringEnvironment] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow access to your photo library.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to photograph your pottery.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = () => {
    if (Platform.OS === "web") {
      pickImage();
      return;
    }
    Alert.alert("Add Photo", undefined, [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!imageUri) {
      Alert.alert("Image required", "Please add a photograph of your piece.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Title required", "Give this piece a name.");
      return;
    }
    setSaving(true);
    await addPiece({ title: title.trim(), notes: notes.trim(), clay, glaze: glaze.trim(), firing: firingEnvironment, cone: cone.trim(), firingEnvironment, dimensions: dimensions.trim(), imageUri, collectionId });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImageUri(null); setTitle(""); setNotes(""); setClay(""); setGlaze(""); setCone(""); setFiringEnvironment(""); setDimensions(""); setCollectionId(undefined);
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

      {/* Photo card */}
      <View
        style={[
          styles.photoCard,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            borderStyle: imageUri ? "solid" : "dashed",
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.imageWrapper,
            { opacity: pressed && !imageUri ? 0.88 : 1 },
          ]}
          onPress={!imageUri ? handlePickPhoto : undefined}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={styles.placeholderInner}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <Feather name="camera" size={24} color={colors.cobalt} />
              </View>
              <Text style={[styles.addPhotoTitle, { color: colors.foreground }]}>Add Photograph</Text>
              <Text style={[styles.addPhotoSub, { color: colors.mutedForeground }]}>
                Tap to photograph or choose from library
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      {imageUri && (
        <Pressable style={styles.changePhotoRow} onPress={handlePickPhoto}>
          <Feather name="camera" size={13} color={colors.mutedForeground} />
          <Text style={[styles.changePhotoText, { color: colors.mutedForeground }]}>Change photo</Text>
        </Pressable>
      )}

      <View style={styles.form}>
        <Label text="Title" />
        <Field value={title} onChange={setTitle} placeholder="e.g. Wabi Yunomi" />

        <Label text="Notes" />
        <Field value={notes} onChange={setNotes} placeholder="Glaze recipe, firing notes, story…" multiline />

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

        <Label text="Dimensions" />
        <Field value={dimensions} onChange={setDimensions} placeholder="e.g. 9 cm H × 11 cm W" />

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
  photoCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 8,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 4 / 5,
  },
  changePhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 16,
    opacity: 0.65,
  },
  changePhotoText: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  placeholderInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  addPhotoTitle: { fontSize: 16, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.2 },
  addPhotoSub: { fontSize: 12, fontFamily: "Poppins_300Light", textAlign: "center", lineHeight: 19 },
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
