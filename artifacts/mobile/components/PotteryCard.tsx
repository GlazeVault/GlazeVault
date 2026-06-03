import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { resolveImageSource } from "@/constants/seedImages";
import { PotteryPiece, usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

interface PotteryCardProps {
  piece: PotteryPiece;
  fromCollectionId?: string;
  showVisibility?: boolean;
}

export function PotteryCard({ piece, fromCollectionId, showVisibility = true }: PotteryCardProps) {
  const colors = useColors();
  const { toggleFavorite } = usePottery();
  const isPrivate = piece.visibility === "private";

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  // Owner archive metadata is drawn from the piece's own data (never gated by
  // publicDataSettings — those only affect public surfaces). Order: clay body ·
  // glaze name · cone · firing environment; only fields with values render.
  const meta = [
    piece.clay,
    piece.glaze,
    piece.cone,
    piece.firingEnvironment || piece.firing,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: 24,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      onPress={() =>
        router.push({
          pathname: "/piece/[id]",
          params: fromCollectionId
            ? { id: piece.id, from: fromCollectionId }
            : { id: piece.id },
        })
      }
    >
      <View style={styles.imageWrapper}>
        <Image
          source={resolveImageSource(piece.imageUri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          recyclingKey={piece.id}
        />
      </View>

      <Pressable
        style={[styles.favoriteBtn]}
        onPress={handleFavorite}
        hitSlop={10}
      >
        <Feather
          name="heart"
          size={16}
          color={piece.isFavorite ? colors.primary : colors.mutedForeground}
        />
      </Pressable>

      {showVisibility &&
        (isPrivate ? (
          <View style={styles.privateBadge}>
            <Feather name="lock" size={11} color="#8A7B6C" />
            <Text style={styles.privateBadgeText}>Private</Text>
          </View>
        ) : (
          <View style={styles.publicBadge}>
            <Feather name="globe" size={11} color={colors.emerald} />
            <Text style={[styles.publicBadgeText, { color: colors.emerald }]}>Public</Text>
          </View>
        ))}

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {piece.title}
        </Text>
        {meta ? (
          <View style={styles.metaWrap}>
            <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 44,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 24,
    overflow: "hidden",
  },
  favoriteBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(253,250,245,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  privateBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(253,250,245,0.6)",
    borderWidth: 0.5,
    borderColor: "rgba(120,110,100,0.12)",
  },
  privateBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.5,
    color: "#8A7B6C",
  },
  publicBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(253,250,245,0.6)",
    borderWidth: 0.5,
    borderColor: "rgba(120,110,100,0.12)",
  },
  publicBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.5,
  },
  info: {
    paddingTop: 14,
    paddingHorizontal: 4,
    gap: 5,
  },
  title: {
    fontSize: 19,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 25,
    letterSpacing: 0.2,
  },
  metaWrap: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  meta: {
    fontSize: 12,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 2,
    textTransform: "uppercase",
    includeFontPadding: true,
  },
});
