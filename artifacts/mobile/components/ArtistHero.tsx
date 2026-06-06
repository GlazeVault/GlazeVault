import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { HeroImage } from "@/components/HeroImage";
import { useColors } from "@/hooks/useColors";

interface ArtistHeroProps {
  /** The dedicated hero image (separate from the round profile avatar). */
  imageUri?: string;
  /** Vertical focal point 0..1 used when the hero is taller than its frame. */
  focalY?: number;
  name: string;
  /** One optional line below the name (studio / motto / nickname / statement). */
  secondLine?: string;
  /** Negative top margin so the hero bleeds up to the top edge. */
  pullUp?: number;
  /** Negative horizontal margin so the hero spans full-bleed past parent padding. */
  bleed?: number;
  /** Cap the hero height (e.g. for the small editor preview). */
  maxHeight?: number;
}

/**
 * The calm first impression shared by the owner's app entry and the public
 * portfolio: one large hero image shown at its TRUE proportions (no overlay,
 * only a gentle, artist-positioned crop when the image is very tall), then the
 * artist name and one optional line. Nothing is rendered for the second line
 * when there is nothing to say.
 */
export function ArtistHero({
  imageUri,
  focalY = 0.5,
  name,
  secondLine,
  pullUp = 0,
  bleed = 0,
  maxHeight,
}: ArtistHeroProps) {
  const colors = useColors();
  const { height: winHeight } = useWindowDimensions();

  const heroMaxHeight = maxHeight ?? Math.min(winHeight * 0.78, 720);

  const displayName = name.trim() || "Your Studio";
  const initial = name.trim().charAt(0).toUpperCase();
  const line = (secondLine ?? "").trim();

  return (
    <View>
      <View style={[styles.heroWrap, { marginTop: -pullUp, marginHorizontal: -bleed }]}>
        <HeroImage uri={imageUri} focalY={focalY} maxHeight={heroMaxHeight} initial={initial} />
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
