import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PieceStatusBadge } from "@/components/StatusBadge";
import { resolveImageSource } from "@/constants/seedImages";
import { PotteryPiece } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

interface PotteryCardProps {
  piece: PotteryPiece;
  fromCollectionId?: string;
  showVisibility?: boolean;
  /**
   * When true the tile renders at the image's exact natural ratio with no
   * cropping — used by the Archive masonry where full silhouettes matter. When
   * false (default) the ratio is clamped to the editorial range, preserving the
   * existing look of single-column surfaces like Favorites.
   */
  preserveAspectRatio?: boolean;
  /**
   * Seeds the wrapper at a known natural ratio (from `useImageOrientations`) so a
   * full-width landscape tile doesn't flash the 4:5 portrait placeholder before
   * the image measures itself on load.
   */
  initialAspectRatio?: number;
}

export function PotteryCard({
  piece,
  fromCollectionId,
  showVisibility = true,
  preserveAspectRatio = false,
  initialAspectRatio,
}: PotteryCardProps) {
  const colors = useColors();

  // Preserve each pot's natural silhouette. Start at the editorial 4:5 ratio as a
  // graceful placeholder while the image measures, then relax to the image's true
  // ratio once it loads so tall vases and wide bowls aren't cropped. In the
  // Archive masonry (preserveAspectRatio) we keep the *exact* ratio with no
  // clamp; elsewhere we clamp to a calm editorial range.
  const [aspectRatio, setAspectRatio] = useState(
    preserveAspectRatio && initialAspectRatio ? initialAspectRatio : 4 / 5,
  );

  // Owner archive metadata is drawn from the piece's own data and is shown only
  // on private owner surfaces. Order: clay body · glaze name · cone · firing
  // environment; only fields with values render.
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
      <View
        style={[
          styles.imageWrapper,
          { aspectRatio, backgroundColor: colors.secondary },
        ]}
      >
        <Image
          source={resolveImageSource(piece.imageUri)}
          style={StyleSheet.absoluteFill}
          // While the natural ratio is still being measured the wrapper sits at
          // the 4:5 placeholder, so masonry tiles use `contain` to avoid any
          // transient crop; once measured the wrapper matches the image exactly
          // and `contain` fills it edge to edge. Clamped surfaces keep `cover`.
          contentFit={preserveAspectRatio ? "contain" : "cover"}
          transition={250}
          cachePolicy="memory-disk"
          recyclingKey={piece.id}
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) {
              const natural = width / height;
              // Archive masonry keeps the exact ratio (no crop); other surfaces
              // clamp to a calm editorial range.
              setAspectRatio(
                preserveAspectRatio
                  ? natural
                  : Math.min(Math.max(natural, 0.62), 1.4),
              );
            }
          }}
        />
      </View>

      {showVisibility ? <PieceStatusBadge piece={piece} /> : null}

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
