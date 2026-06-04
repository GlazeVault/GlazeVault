import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DraggablePhotoStrip } from "@/components/DraggablePhotoStrip";
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

  const handleReorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // Keep the cover pointed at the same photo it referenced before the move.
    let nextCover = coverIndex;
    if (coverIndex === from) {
      nextCover = to;
    } else if (from < coverIndex && to >= coverIndex) {
      nextCover = coverIndex - 1;
    } else if (from > coverIndex && to <= coverIndex) {
      nextCover = coverIndex + 1;
    }
    onChange(next, nextCover);
  };

  const coverUri = images[coverIndex] ?? images[0];

  // Frame the cropper to the photo's own natural ratio so adding a landscape
  // shot keeps it landscape — the maker can still pinch to reframe, but nothing
  // is force-cropped to 4:5. Falls back to the cropper's 4:5 default if the
  // picker didn't report dimensions.
  const cropAspect =
    cropSource?.width && cropSource?.height
      ? cropSource.width / cropSource.height
      : undefined;

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
          aspectRatio={cropAspect}
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
            contentFit="contain"
          />
          <View style={[styles.coverBadge, { backgroundColor: colors.emerald }]}>
            <Feather name="star" size={11} color="#FFFFFF" />
            <Text style={styles.coverBadgeText}>Cover</Text>
          </View>
        </View>
      </View>

      {/* Thumbnail strip + add tile */}
      <DraggablePhotoStrip
        images={images}
        coverIndex={coverIndex}
        onReorder={handleReorder}
        onSetCover={handleSetCover}
        onRemove={handleRemove}
        onAdd={handlePickPhoto}
      />

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {images.length > 1
          ? "Tap a photo to make it the cover · hold and drag to reorder"
          : "Add more photos of this piece"}
      </Text>

      <ImageCropper
        visible={!!cropSource}
        uri={cropSource?.uri ?? null}
        sourceWidth={cropSource?.width}
        sourceHeight={cropSource?.height}
        aspectRatio={cropAspect}
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
  hint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    marginTop: 10,
    marginBottom: 4,
  },
});
