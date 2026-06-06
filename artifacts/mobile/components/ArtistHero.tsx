import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";
import { useImageOrientations } from "@/hooks/useImageOrientations";

interface ArtistHeroProps {
  avatarUri?: string;
  name: string;
  /** One optional line below the name (studio / motto / nickname / statement). */
  secondLine?: string;
  /** Negative top margin so the hero bleeds up to the top edge. */
  pullUp?: number;
  /** Negative horizontal margin so the hero spans full-bleed past parent padding. */
  bleed?: number;
}

/**
 * The calm first impression shared by the owner's app entry and the public
 * portfolio: one large hero image shown at its TRUE proportions (no crop, no
 * overlay), then the artist name and one optional line. Nothing is rendered for
 * the second line when there is nothing to say.
 */
export function ArtistHero({
  avatarUri,
  name,
  secondLine,
  pullUp = 0,
  bleed = 0,
}: ArtistHeroProps) {
  const colors = useColors();
  const { height: winHeight } = useWindowDimensions();

  const ratios = useImageOrientations([avatarUri]);
  const heroRatio = (avatarUri ? ratios[avatarUri] : undefined) ?? 4 / 5;
  const heroMaxHeight = Math.min(winHeight * 0.78, 720);

  const displayName = name.trim() || "Your Studio";
  const initial = name.trim().charAt(0).toUpperCase();
  const line = (secondLine ?? "").trim();

  return (
    <View>
      <View
        style={[
          styles.heroWrap,
          { marginTop: -pullUp, marginHorizontal: -bleed },
        ]}
      >
        {avatarUri ? (
          <Image
            source={resolveImageSource(avatarUri)}
            style={[styles.heroImage, { aspectRatio: heroRatio, maxHeight: heroMaxHeight }]}
            contentFit="contain"
            transition={280}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: colors.secondary }]}>
            {initial ? (
              <Text style={[styles.portraitInitial, { color: colors.mutedForeground }]}>
                {initial}
              </Text>
            ) : (
              <Feather name="user" size={44} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
            )}
          </View>
        )}
      </View>

      <View style={styles.identity}>
        <Text style={[styles.heroName, { color: colors.foreground }]}>{displayName}</Text>
        {line ? (
          <Text style={[styles.heroSecondLine, { color: colors.mutedForeground }]}>{line}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    marginBottom: 26,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
  },
  heroPlaceholder: {
    width: "100%",
    height: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitInitial: {
    fontSize: 88,
    fontFamily: "PlayfairDisplay_400Regular",
    opacity: 0.5,
  },
  identity: {
    paddingHorizontal: 4,
    marginBottom: 28,
  },
  heroName: {
    fontSize: 38,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 44,
  },
  heroSecondLine: {
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.4,
    marginTop: 10,
    lineHeight: 22,
  },
});
