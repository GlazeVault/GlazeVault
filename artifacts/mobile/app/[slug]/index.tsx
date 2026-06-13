import { router, useLocalSearchParams, type Href } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArtistHero } from "@/components/ArtistHero";
import { EntranceCard } from "@/components/EntranceCard";
import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import { publicSiteSlug } from "@/context/ProfileContext";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";
import { useColors } from "@/hooks/useColors";

/**
 * Live public foyer at `/{slug}` — the calm entrance a shared artist link lands
 * on. It mirrors the owner's own in-app foyer: one large hero at its true
 * proportions, the artist name and one optional line, then three quiet doorways
 * — Portfolio, Collections, Archive — so a visitor steps into the artist's
 * world and chooses where to wander, rather than being dropped straight into a
 * grid. Each doorway pushes to a public sub-route under the same slug, all of
 * which the auth guard treats as public (reachable by anon/other artists).
 */
function FoyerInner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, profile } = usePublicArtist();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (status === "loading") return <PublicLoading />;
  if (status === "missing" || !profile.publicSite.enabled) {
    return <PublicMissing />;
  }

  const slug = publicSiteSlug(profile.publicSite.handle || profile.name);
  const door = (sub: string): Href => `/${slug}/${sub}` as Href;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 15,
          paddingTop: topPad + 32,
          paddingBottom: insets.bottom + 48,
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
            onPress={() => router.push(door("portfolio"))}
          />
          <EntranceCard
            index={2}
            title="Collections"
            subtitle="Bodies of work and exhibitions"
            onPress={() => router.push(door("collections"))}
          />
          <EntranceCard
            index={3}
            title="Archive"
            subtitle="Every piece on public view"
            onPress={() => router.push(door("archive"))}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function PublicFoyerRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <FoyerInner />
    </PublicArtistProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cards: {
    paddingHorizontal: 4,
    marginTop: 4,
  },
});
