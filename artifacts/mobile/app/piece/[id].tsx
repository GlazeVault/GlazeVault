import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareSheet } from "@/components/ShareSheet";
import { resolveImageSource } from "@/constants/seedImages";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.infoAccent, { backgroundColor: accent }]} />
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
  const [shareVisible, setShareVisible] = useState(false);

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

  const handleDelete = () => {
    Alert.alert("Remove Piece", `Remove "${piece.title}" from your archive?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deletePiece(piece.id);
          router.back();
        },
      },
    ]);
  };

  const formattedDate = new Date(piece.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating controls */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <Pressable
          style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.topRight}>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={handleFavorite}
          >
            <Feather
              name="heart"
              size={18}
              color={piece.isFavorite ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => setShareVisible(true)}
          >
            <Feather name="share-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* Hero image */}
        <Image
          source={resolveImageSource(piece.imageUri)}
          style={styles.heroImage}
          contentFit="cover"
          transition={200}
        />

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{piece.title}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            Recorded {formattedDate}
          </Text>

          {/* Info rows */}
          <View style={[styles.infoCard, { borderColor: colors.border }]}>
            <InfoRow label="Clay" value={piece.clay} accent={colors.cobalt} />
            <InfoRow label="Glaze" value={piece.glaze} accent={colors.emerald} />
            <InfoRow label="Firing" value={piece.firing} accent={colors.primary} />
            {piece.dimensions ? (
              <InfoRow
                label="Dimensions"
                value={piece.dimensions}
                accent={colors.mutedForeground}
              />
            ) : null}
          </View>

          {/* Notes */}
          {piece.notes ? (
            <View style={styles.notesSection}>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>
                Studio Notes
              </Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {piece.notes}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => router.push(`/piece/edit/${piece.id}`)}
              >
                <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
                  Edit Piece
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.shareBtn,
                  {
                    backgroundColor: pressed ? colors.secondary : colors.foreground,
                    borderColor: colors.foreground,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => setShareVisible(true)}
              >
                <Feather name="share-2" size={14} color={colors.background} />
                <Text style={[styles.actionBtnText, { color: colors.background }]}>
                  Share
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.deleteLink} onPress={handleDelete}>
              <Text style={[styles.deleteLinkText, { color: colors.mutedForeground }]}>
                Remove from archive
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        pieceTitle={piece.title}
      />
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
  topRight: { flexDirection: "row", gap: 8 },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  heroImage: { width: "100%", aspectRatio: 3 / 4 },
  content: { paddingHorizontal: 28, paddingTop: 28 },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 40,
    marginBottom: 6,
  },
  date: {
    fontSize: 11,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.4,
    marginBottom: 28,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 28,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  infoAccent: { width: 3, height: 18, borderRadius: 2, opacity: 0.7 },
  infoLabel: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    width: 88,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    flex: 1,
    textAlign: "right",
  },
  notesSection: { marginBottom: 36, gap: 10 },
  notesLabel: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    lineHeight: 27,
    letterSpacing: 0.2,
  },
  actions: { gap: 16, alignItems: "center", paddingBottom: 8 },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    paddingVertical: 14,
  },
  shareBtn: {
    backgroundColor: "transparent",
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  deleteLink: { paddingVertical: 4 },
  deleteLinkText: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
});
