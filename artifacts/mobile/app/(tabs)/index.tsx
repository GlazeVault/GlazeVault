import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArtistHero } from "@/components/ArtistHero";
import { EntranceCard } from "@/components/EntranceCard";
import { useProfile } from "@/context/ProfileContext";
import { useColors } from "@/hooks/useColors";

/**
 * The foyer: the calm first impression of the artist's space. A large hero shown
 * at its true proportions, the artist name and one optional line, then three
 * quiet "doorways" — Portfolio, Collections, Archive — so opening the app feels
 * like stepping into a gallery and choosing where to wander, not landing on a
 * dashboard. The full studio record (the archive grid) lives one step in, behind
 * the Archive doorway, so the grid is never the first thing seen.
 */
export default function FoyerScreen() {
  const colors = useColors();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 15,
          paddingTop: topPad + 32,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <ArtistHero
          imageUri={profile.heroImageUri}
          focalY={profile.heroFocalY}
          focalX={profile.heroFocalX}
          zoom={profile.heroZoom}
          name={profile.name}
          secondLine={profile.tagline}
          pullUp={topPad + 32}
          bleed={15}
        />

        <View style={styles.cards}>
          <EntranceCard
            index={1}
            title="Portfolio"
            subtitle="Curated featured works"
            onPress={() => router.push("/public-site")}
          />
          <EntranceCard
            index={2}
            title="Collections"
            subtitle="Bodies of work and exhibitions"
            onPress={() => router.navigate("/(tabs)/collections")}
          />
          <EntranceCard
            index={3}
            title="Archive"
            subtitle="Complete studio record"
            onPress={() => router.push("/archive")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cards: {
    paddingHorizontal: 4,
    marginTop: 4,
  },
});
