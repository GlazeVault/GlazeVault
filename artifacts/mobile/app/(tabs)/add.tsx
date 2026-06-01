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

const TECHNIQUES = [
  "Wheel-thrown",
  "Hand-built",
  "Slab",
  "Coil",
  "Pinch",
  "Cast",
  "Mixed",
];

const MATERIALS = [
  "Stoneware",
  "Porcelain",
  "Earthenware",
  "Terracotta",
  "Raku",
  "Bone China",
  "Other",
];

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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.secondary,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: 20,
                },
              ]}
              onPress={() => onChange(opt)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.primaryForeground : colors.foreground },
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
  const [description, setDescription] = useState("");
  const [technique, setTechnique] = useState("");
  const [materials, setMaterials] = useState("");
  const [glaze, setGlaze] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow access to your photo library to upload pottery images.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      await pickImage();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to photograph your pottery.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    if (!imageUri) {
      Alert.alert("Add a photo", "Please add a photo of your pottery piece.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your piece a name.");
      return;
    }
    setSaving(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addPiece({
      title: title.trim(),
      description: description.trim(),
      technique,
      materials,
      glaze: glaze.trim(),
      dimensions: dimensions.trim(),
      imageUri,
    });
    setImageUri(null);
    setTitle("");
    setDescription("");
    setTechnique("");
    setMaterials("");
    setGlaze("");
    setDimensions("");
    setSaving(false);
    router.replace("/");
  };

  const label = (text: string) => (
    <Text style={[styles.label, { color: colors.foreground }]}>{text}</Text>
  );

  const field = (
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    multiline = false
  ) => (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMulti,
        {
          color: colors.foreground,
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 12, paddingBottom: insets.bottom + 100 },
      ]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>New Piece</Text>

      {/* Image picker */}
      <Pressable
        style={({ pressed }) => [
          styles.imagePicker,
          {
            backgroundColor: colors.secondary,
            borderColor: imageUri ? "transparent" : colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => {
          if (Platform.OS === "web") {
            pickImage();
          } else {
            Alert.alert("Add Photo", "Choose how to add your pottery photo", [
              { text: "Camera", onPress: takePhoto },
              { text: "Photo Library", onPress: pickImage },
              { text: "Cancel", style: "cancel" },
            ]);
          }
        }}
      >
        {imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              style={[styles.previewImage, { borderRadius: colors.radius }]}
              contentFit="cover"
            />
            <View style={styles.changePhotoOverlay}>
              <Feather name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.changePhotoText}>Change photo</Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholderContent}>
            <View
              style={[
                styles.cameraIconBg,
                { backgroundColor: colors.accent, borderRadius: 40 },
              ]}
            >
              <Feather name="camera" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.addPhotoText, { color: colors.foreground }]}>
              Add Photo
            </Text>
            <Text style={[styles.addPhotoSub, { color: colors.mutedForeground }]}>
              Tap to take a photo or choose from library
            </Text>
          </View>
        )}
      </Pressable>

      <View style={styles.form}>
        {label("Title *")}
        {field(title, setTitle, "e.g. Yunomi Tea Bowl")}

        {label("Description")}
        {field(description, setDescription, "Tell the story of this piece...", true)}

        {label("Technique")}
        <ChipSelector options={TECHNIQUES} value={technique} onChange={setTechnique} />

        {label("Materials")}
        <ChipSelector options={MATERIALS} value={materials} onChange={setMaterials} />

        {label("Glaze")}
        {field(glaze, setGlaze, "e.g. Celadon, Ash, Matte black")}

        {label("Dimensions")}
        {field(dimensions, setDimensions, "e.g. 8cm H × 10cm W")}

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: saving ? colors.accent : colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {saving ? "Saving..." : "Save Piece"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  heading: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    marginBottom: 20,
  },
  imagePicker: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: 24,
  },
  previewImage: { width: "100%", height: "100%" },
  changePhotoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  changePhotoText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  placeholderContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  cameraIconBg: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
  },
  addPhotoSub: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  form: { gap: 10 },
  label: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    marginTop: 4,
    marginBottom: 2,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    borderWidth: 1,
  },
  inputMulti: {
    height: 90,
    paddingTop: 12,
  },
  chipScroll: { marginBottom: 4 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
  },
  saveBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
});
