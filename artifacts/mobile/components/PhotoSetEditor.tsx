import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ImageCropper } from "@/components/ImageCropper";
import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";

interface PhotoSetEditorProps {
  images: string[];
  coverIndex: number;
  onChange: (images: string[], coverIndex: number) => void;
}

/**
 * Manages a piece's ordered photo set and which photo is the cover. Every newly
 * picked / captured photo is run through the 4:5 ImageCropper before being added.
 * Used by both the add and edit screens so the multi-photo flow stays identical.
 *
 * Cover handling: `coverIndex` points into `images`. Tapping a non-cover
 * thumbnail promotes it to cover. Removing a photo re-points the cover so it
 * always references a real, in-range photo.
 */
export function PhotoSetEditor({ images, coverIndex, onChange }: PhotoSetEditorProps) {
  const colors = useColors();
  const [cropSource, setCropSource] = useState<
    { uri: string; width?: number; height?: number } | null
  >(null);

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
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to photograph your pottery.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
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

  const handleCropConfirm = (uri: string) => {
    const next = [...images, uri];
    // First photo becomes the cover automatically.
    onChange(next, images.length === 0 ? next.length - 1 : coverIndex);
    setCropSource(null);
  };

  const handleSetCover = (index: number) => {
    if (index === coverIndex) return;
    onChange(images, index);
  };

  const handleRemove = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    let nextCover = coverIndex;
    if (index === coverIndex) {
      nextCover = 0; // cover removed → fall back to the first remaining photo
    } else if (index < coverIndex) {
      nextCover = coverIndex - 1; // shift to track the same photo
    }
    onChange(next, next.length === 0 ? 0 : Math.min(nextCover, next.length - 1));
  };

  const coverUri = images[coverIndex] ?? images[0];

  if (images.length === 0) {
    return (
      <>
        <View
          style={[
            styles.photoCard,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderStyle: "dashed",
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.imageWrapper, { opacity: pressed ? 0.88 : 1 }]}
            onPress={handlePickPhoto}
          >
            <View style={styles.placeholderInner}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <Feather name="camera" size={24} color={colors.cobalt} />
              </View>
              <Text style={[styles.addPhotoTitle, { color: colors.foreground }]}>Add Photograph</Text>
              <Text style={[styles.addPhotoSub, { color: colors.mutedForeground }]}>
                Tap to photograph or choose from library
              </Text>
            </View>
          </Pressable>
        </View>
        <ImageCropper
          visible={!!cropSource}
          uri={cropSource?.uri ?? null}
          sourceWidth={cropSource?.width}
          sourceHeight={cropSource?.height}
          onCancel={() => setCropSource(null)}
          onConfirm={handleCropConfirm}
        />
      </>
    );
  }

  return (
    <>
      {/* Cover preview */}
      <View
        style={[
          styles.photoCard,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={resolveImageSource(coverUri)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <View style={[styles.coverBadge, { backgroundColor: colors.emerald }]}>
            <Feather name="star" size={11} color="#FFFFFF" />
            <Text style={styles.coverBadgeText}>Cover</Text>
          </View>
        </View>
      </View>

      {/* Thumbnail strip + add tile */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {images.map((uri, index) => {
          const isCover = index === coverIndex;
          return (
            <View key={`${uri}-${index}`} style={styles.thumbWrap}>
              <Pressable
                style={[
                  styles.thumb,
                  {
                    borderColor: isCover ? colors.emerald : colors.border,
                    borderWidth: isCover ? 2 : 1,
                  },
                ]}
                onPress={() => handleSetCover(index)}
              >
                <Image
                  source={resolveImageSource(uri)}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Pressable>
              <Pressable
                style={[styles.removeBtn, { backgroundColor: colors.foreground }]}
                onPress={() => handleRemove(index)}
                hitSlop={6}
              >
                <Feather name="x" size={12} color={colors.background} />
              </Pressable>
            </View>
          );
        })}

        <Pressable
          style={({ pressed }) => [
            styles.addTile,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handlePickPhoto}
        >
          <Feather name="plus" size={20} color={colors.mutedForeground} />
          <Text style={[styles.addTileText, { color: colors.mutedForeground }]}>Add</Text>
        </Pressable>
      </ScrollView>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {images.length > 1 ? "Tap a photo to make it the cover" : "Add more photos of this piece"}
      </Text>

      <ImageCropper
        visible={!!cropSource}
        uri={cropSource?.uri ?? null}
        sourceWidth={cropSource?.width}
        sourceHeight={cropSource?.height}
        onCancel={() => setCropSource(null)}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },
  imageWrapper: { width: "100%", aspectRatio: 4 / 5 },
  coverBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 13,
  },
  coverBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.4,
    color: "#FFFFFF",
  },
  placeholderInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  addPhotoTitle: { fontSize: 16, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.2 },
  addPhotoSub: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 19,
  },
  strip: { flexDirection: "row", gap: 12, paddingVertical: 2, paddingRight: 8 },
  thumbWrap: { width: 72 },
  thumb: {
    width: 72,
    aspectRatio: 4 / 5,
    borderRadius: 12,
    overflow: "hidden",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: 72,
    aspectRatio: 4 / 5,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addTileText: { fontSize: 11, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  hint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    marginTop: 10,
    marginBottom: 4,
  },
});
