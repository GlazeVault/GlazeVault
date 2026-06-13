import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import {
  getPortfolioCollectionPieces,
  isCollectionPublic,
  resolveGatedCover,
  toPublicPiece,
} from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { publicSiteSlug } from "@/context/ProfileContext";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";
import { useColors } from "@/hooks/useColors";

/**
 * Live public collections index at `/{slug}/collections` — the Collections
 * doorway from the foyer. A calm, editorial list of the artist's public
 * collections (each a mini-exhibition), every card opening the existing single
 * collection page. Only public collections that actually have featured work
 * show, mirroring the portfolio's curation so an empty exhibition never appears.
 */
function CollectionsInner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, profile, pieces, collections } = usePublicArtist();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (status === "loading") return <PublicLoading />;
  if (status === "missing" || !profile.publicSite.enabled) {
    return <PublicMissing />;
  }

  const slug = publicSiteSlug(profile.publicSite.handle || profile.name);
  const foyerHref = `/${slug}` as Href;

  const publicCollections = collections
    .filter(isCollectionPublic)
    .map((c) => {
      const cp = getPortfolioCollectionPieces(c, pieces).map(toPublicPiece);
      const { coverUri } = resolveGatedCover(c, cp, pieces);
      return { collection: c, count: cp.length, coverUri };
    })
    .filter((e) => e.count > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: topPad + 20,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <Pressable
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Back to foyer"
          hitSlop={10}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(foyerHref)
          }
        >
          <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
          <Text style={[styles.backLabel, { color: colors.mutedForeground }]}>
            Foyer
          </Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.cobalt }]}>
            {profile.name || "Studio"}
          </Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Collections
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {publicCollections.length === 0
              ? "No collections on view"
              : `${publicCollections.length} ${
                  publicCollections.length === 1 ? "exhibition" : "exhibitions"
                }`}
          </Text>
        </View>

        {publicCollections.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
              <Feather
                name="layers"
                size={20}
                color={colors.mutedForeground}
                style={{ opacity: 0.4 }}
              />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              This studio has no public collections on view yet.
            </Text>
          </View>
        ) : (
          publicCollections.map(({ collection, count, coverUri }, index) => (
            <Pressable
              key={collection.id}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${collection.title}`}
              onPress={() =>
                router.push(`/${slug}/collection/${collection.id}` as Href)
              }
            >
              {coverUri ? (
                <Image
                  source={resolveImageSource(coverUri)}
                  style={[styles.cover, { backgroundColor: colors.secondary }]}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  recyclingKey={coverUri}
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Feather
                    name="layers"
                    size={24}
                    color={colors.mutedForeground}
                    style={{ opacity: 0.4 }}
                  />
                </View>
              )}
              <Text style={[styles.cardIndex, { color: colors.emerald }]}>
                {`${String(index + 1).padStart(2, "0")} · Collection`}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {collection.title}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                {`${count} ${count === 1 ? "piece" : "pieces"}`}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default function PublicCollectionsRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <CollectionsInner />
    </PublicArtistProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginLeft: -4,
  },
  backLabel: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
    marginLeft: 2,
  },
  header: {
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  heading: {
    fontSize: 38,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.5,
    lineHeight: 46,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    width: 40,
    marginBottom: 12,
  },
  count: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
  },
  card: {
    marginBottom: 36,
  },
  cover: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    marginBottom: 16,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardIndex: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 30,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
  },
  empty: {
    alignItems: "center",
    paddingTop: 32,
    gap: 16,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
});
