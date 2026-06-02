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
}

export function PotteryCard({ piece }: PotteryCardProps) {
  const colors = useColors();
  const { toggleFavorite } = usePottery();

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  const meta = [piece.clay, piece.glaze, piece.firing].filter(Boolean).join("  ·  ");

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
      onPress={() => router.push(`/piece/${piece.id}`)}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={resolveImageSource(piece.imageUri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
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

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {piece.title}
        </Text>
        {meta ? (
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    marginBottom: 44,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 4 / 5,
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
  meta: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
