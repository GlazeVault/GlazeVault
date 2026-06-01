import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function PieceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPiece, toggleFavorite, deletePiece } = usePottery();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const piece = getPiece(id);
  const [sharing, setSharing] = useState(false);

  if (!piece) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }}>
          Piece not found
        </Text>
      </View>
    );
  }

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  const handleShare = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Sharing", "Sharing is available on mobile devices.");
      return;
    }
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(piece.imageUri, {
          dialogTitle: piece.title,
          mimeType: "image/jpeg",
        });
      } else {
        Alert.alert("Sharing not available", "Your device doesn't support sharing.");
      }
    } catch {
      Alert.alert("Error", "Could not share this piece.");
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Piece",
      `Remove "${piece.title}" from your gallery?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deletePiece(piece.id);
            router.back();
          },
        },
      ]
    );
  };

  const formattedDate = new Date(piece.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating back button */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
            onPress={handleFavorite}
          >
            <Feather
              name="heart"
              size={20}
              color={piece.isFavorite ? "#FF6B6B" : "#FFFFFF"}
            />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
            onPress={handleShare}
            disabled={sharing}
          >
            <Feather name="share-2" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
            onPress={handleDelete}
          >
            <Feather name="trash-2" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <Image
          source={{ uri: piece.imageUri }}
          style={styles.heroImage}
          contentFit="cover"
        />

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]}>{piece.title}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            Added {formattedDate}
          </Text>

          {piece.description ? (
            <Text style={[styles.description, { color: colors.foreground }]}>
              {piece.description}
            </Text>
          ) : null}

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <InfoRow label="Technique" value={piece.technique} />
            <InfoRow label="Materials" value={piece.materials} />
            <InfoRow label="Glaze" value={piece.glaze} />
            <InfoRow label="Dimensions" value={piece.dimensions} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  content: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    lineHeight: 32,
  },
  date: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    lineHeight: 24,
    marginBottom: 8,
  },
  infoCard: {
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    flex: 1,
    textAlign: "right",
  },
});
