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
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [clay, setClay] = useState("");
  const [glaze, setGlaze] = useState("");
  const [firing, setFiring] = useState("");
  const [dimensions, setDimensions] = useState("");
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
    await addPiece({ title: title.trim(), notes: notes.trim(), clay, glaze: glaze.trim(), firing, dimensions: dimensions.trim(), imageUri });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImageUri(null); setTitle(""); setNotes(""); setClay(""); setGlaze(""); setFiring(""); setDimensions("");
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

      {/* Image picker */}
      <Pressable
        style={({ pressed }) => [
          styles.imagePicker,
          {
            backgroundColor: colors.secondary,
            borderRadius: colors.radius,
            borderColor: colors.border,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        onPress={handlePickPhoto}
      >
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={[styles.previewImage, { borderRadius: colors.radius }]} contentFit="cover" />
            <View style={styles.changeOverlay}>
              <Feather name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.changeText}>Change</Text>
            </View>
          </>
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
  imagePicker: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: 32,
  },
  previewImage: { width: "100%", height: "100%" },
  changeOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(45,45,42,0.5)",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, gap: 8,
  },
  changeText: { color: "#FFFFFF", fontFamily: "Poppins_400Regular", fontSize: 13 },
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
