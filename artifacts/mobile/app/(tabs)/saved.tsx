import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getPortfolioCollectionPieces,
  isCollectionPublic,
  isPubliclyVisiblePiece,
  resolveGatedCover,
  toPublicPiece,
} from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { publicSiteSlug, useProfile } from "@/context/ProfileContext";
import { useSaved } from "@/context/SavedContext";
import { useColors } from "@/hooks/useColors";

/**
 * "Saved" — the viewer's private Inspiration shelf and the quiet list of
 * artists they follow. Everything here is personal curation: artworks,
 * collections and artists kept to revisit. There are deliberately no counts,
 * no rankings, no engagement stats — only what the person chose to keep close.
 */
export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { saved } = useSaved();
  const { pieces } = usePottery();
  const { collections } = useCollections();
  const { profile } = useProfile();

  // Resolve saved ids against the live archive so a piece/collection that no
  // longer exists simply drops off the shelf rather than rendering broken.
  // Re-gate on every render: a piece/collection saved while public but later
  // made private/archived must silently fall off this shelf — saved status
  // never overrides the owner's current privacy choice.
  const savedPieces = saved.pieces
    .map((id) => pieces.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && isPubliclyVisiblePiece(p))
    .map(toPublicPiece);
  const savedCollections = saved.collections
    .map((id) => collections.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && isCollectionPublic(c));

  const artistSlug = publicSiteSlug(profile.publicSite.handle || profile.name);
  const hasInspiration =
    savedPieces.length > 0 || savedCollections.length > 0 || saved.artists.length > 0;
  const isEmpty = !hasInspiration && saved.following.length === 0;

  const SectionTitle = ({ label }: { label: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{label}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 32, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>Saved</Text>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            A private shelf for the work, collections and artists you want to revisit.
          </Text>
        </View>

        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
              <Feather name="bookmark" size={22} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing saved yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              As you wander artist worlds, tap Save to keep a piece, an exhibition or an
              artist here — and Follow an artist to quietly revisit their archive.
            </Text>
          </View>
        ) : null}

        {/* Followed artists — quietly revisit their archives. */}
        {saved.following.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle label="Following" />
            {saved.following.map((artist) => (
              <Pressable
                key={`follow-${artist.slug}`}
                onPress={() => router.push(`/${artist.slug}`)}
                style={({ pressed }) => [
                  styles.artistRow,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.artistAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.artistInitial, { color: colors.mutedForeground }]}>
                    {artist.name.trim().charAt(0).toUpperCase() || "·"}
                  </Text>
                </View>
                <View style={styles.artistMeta}>
                  <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>
                    {artist.name}
                  </Text>
                  <Text style={[styles.artistSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    Following archive
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Saved artists. */}
        {saved.artists.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle label="Artists" />
            {saved.artists.map((artist) => (
              <Pressable
                key={`artist-${artist.slug}`}
                onPress={() => router.push(`/${artist.slug}`)}
                style={({ pressed }) => [
                  styles.artistRow,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.artistAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.artistInitial, { color: colors.mutedForeground }]}>
                    {artist.name.trim().charAt(0).toUpperCase() || "·"}
                  </Text>
                </View>
                <View style={styles.artistMeta}>
                  <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>
                    {artist.name}
                  </Text>
                  <Text style={[styles.artistSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    Saved to inspiration
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Saved collections — mini-exhibitions kept for inspiration. */}
        {savedCollections.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle label="Collections" />
            {savedCollections.map((c) => {
              // Saved-exhibition thumbnail: gate the cover on the SAME featured
              // Portfolio rule as the public site and profile preview. A cover
              // pointing at a non-featured (or private/archived) piece is dropped
              // to a featured piece, so an uncurated piece can never be pulled in
              // as a public collection's cover here — only a featured piece or a
              // dedicated uploaded cover represents the exhibition.
              const cover = resolveGatedCover(
                c,
                getPortfolioCollectionPieces(c, pieces),
                pieces,
              ).coverUri;
              return (
                <Pressable
                  key={`collection-${c.id}`}
                  onPress={() => router.push(`/${artistSlug}/collection/${c.id}`)}
                  style={({ pressed }) => [
                    styles.collectionRow,
                    { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <View style={[styles.collectionCover, { backgroundColor: colors.secondary }]}>
                    {cover ? (
                      <Image
                        source={resolveImageSource(cover)}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Feather name="layers" size={18} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                    )}
                  </View>
                  <View style={styles.artistMeta}>
                    <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>
                      {c.title || "Untitled exhibition"}
                    </Text>
                    <Text style={[styles.artistSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      Exhibition
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Saved artworks. */}
        {savedPieces.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle label="Artworks" />
            <View style={styles.grid}>
              {savedPieces.map((p) => (
                <Pressable
                  key={`piece-${p.id}`}
                  onPress={() => router.push(`/piece/${p.id}?public=1`)}
                  style={({ pressed }) => [styles.gridItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.gridImage, { backgroundColor: colors.secondary }]}>
                    {p.imageUri ? (
                      <Image
                        source={resolveImageSource(p.imageUri)}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                        recyclingKey={p.id}
                      />
                    ) : (
                      <Feather name="image" size={18} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                    )}
                  </View>
                  {p.title ? (
                    <Text style={[styles.gridTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {p.title}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { marginBottom: 28 },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heading: {
    fontSize: 34,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
  },
  subhead: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 21,
    marginTop: 10,
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  artistInitial: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_500Medium",
  },
  artistMeta: { flex: 1 },
  artistName: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
  },
  artistSub: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.4,
    marginTop: 3,
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collectionCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  gridItem: { width: "47%" },
  gridImage: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  gridTitle: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay_400Regular",
    marginTop: 8,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    lineHeight: 22,
    textAlign: "center",
  },
});
