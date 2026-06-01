import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PotteryPiece, usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

interface PotteryCardProps {
  piece: PotteryPiece;
  compact?: boolean;
}

export function PotteryCard({ piece, compact = false }: PotteryCardProps) {
  const colors = useColors();
  const { toggleFavorite } = usePottery();

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  const handlePress = () => {
    router.push(`/piece/${piece.id}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      onPress={handlePress}
    >
      <Image
        source={{ uri: piece.imageUri }}
        style={[styles.image, { borderRadius: colors.radius }]}
        contentFit="cover"
        transition={200}
      />
      <Pressable
        style={[styles.favoriteBtn, { backgroundColor: "rgba(0,0,0,0.35)" }]}
        onPress={handleFavorite}
        hitSlop={8}
      >
        <Feather
          name="heart"
          size={15}
          color={piece.isFavorite ? "#FF6B6B" : "#FFFFFF"}
          style={piece.isFavorite ? styles.heartFilled : undefined}
        />
      </Pressable>
      <View style={styles.info}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {piece.title}
        </Text>
        {!compact && (
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {piece.technique}
            {piece.materials ? ` · ${piece.materials}` : ""}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
  },
  image: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  favoriteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  heartFilled: {
    // tint handled by color prop
  },
  info: {
    padding: 10,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
});
