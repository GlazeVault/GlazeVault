import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PublicDataSettings,
  getPublicCollectionPieces,
  isCollectionFeatured,
} from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import {
  HomepageLayout,
  PUBLIC_SITE_DOMAIN,
  publicSiteSlug,
  useProfile,
} from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

interface PublicPiece {
  id: string;
  title: string;
  imageUri: string;
  publicDataSettings: PublicDataSettings;
}

export default function PublicSiteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { pieces } = usePottery();
  const { collections } = useCollections();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const site = profile.publicSite;
  const layout: HomepageLayout = site.homepageLayout;

  // Privacy: only public collections explicitly featured on the site, each
  // reduced to its public pieces. Featuring lives on the collection itself.
  const featured = collections
    .filter(isCollectionFeatured)
    .map((c) => {
      const cp = getPublicCollectionPieces(c, pieces) as PublicPiece[];
      // Prefer the artist-chosen cover. Otherwise fall back to a public piece
      // that itself allows photos, so a hidden image never leaks through.
      const fallback = cp.find((p) => p.publicDataSettings.showPhotos) ?? null;
      const coverUri = c.coverImageUri || fallback?.imageUri || null;
      const coverPieceId = c.coverImageUri ? null : (fallback?.id ?? null);
      return { collection: c, pieces: cp, coverUri, coverPieceId };
    })
    .filter((entry) => entry.pieces.length > 0);

  const links: { icon: keyof typeof Feather.glyphMap; label: string }[] = [];
  if (site.contactEmail.trim()) links.push({ icon: "mail", label: site.contactEmail.trim() });
  if (profile.instagram.trim()) links.push({ icon: "instagram", label: profile.instagram.trim() });
  if (profile.website.trim()) links.push({ icon: "globe", label: profile.website.trim() });
  if (site.etsy.trim()) links.push({ icon: "shopping-bag", label: site.etsy.trim() });
  if (site.shopify.trim()) links.push({ icon: "shopping-cart", label: site.shopify.trim() });

  const initial = profile.name.trim().charAt(0).toUpperCase();

  const renderTile = (piece: PublicPiece, tileStyle: object) => {
    return (
      <Pressable
        key={piece.id}
        style={({ pressed }) => [tileStyle, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push(`/piece/${piece.id}?public=1`)}
      >
        {piece.publicDataSettings.showPhotos ? (
          <Image
            source={resolveImageSource(piece.imageUri)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={piece.id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder, { backgroundColor: colors.secondary }]}>
            <Feather name="image" size={18} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
          </View>
        )}
      </Pressable>
    );
  };

  const renderPieces = (collectionPieces: PublicPiece[]) => {
    if (layout === "editorial") {
      return (
        <View style={styles.editorialWrap}>
          {collectionPieces.map((p) => renderTile(p, styles.editorialTile))}
        </View>
      );
    }
    if (layout === "masonry") {
      const colA = collectionPieces.filter((_, i) => i % 2 === 0);
      const colB = collectionPieces.filter((_, i) => i % 2 === 1);
      return (
        <View style={styles.masonryWrap}>
          <View style={styles.masonryCol}>
            {colA.map((p, i) => renderTile(p, [styles.masonryTile, i % 2 === 0 ? styles.masonryTall : styles.masonryShort]))}
          </View>
          <View style={styles.masonryCol}>
            {colB.map((p, i) => renderTile(p, [styles.masonryTile, i % 2 === 0 ? styles.masonryShort : styles.masonryTall]))}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.gridWrap}>
        {collectionPieces.map((p) => renderTile(p, styles.gridTile))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 64, paddingBottom: insets.bottom + 48 },
        ]}
      >
        {/* Masthead */}
        <Text style={[styles.eyebrow, { color: colors.emerald }]}>Public Site</Text>
        <View style={styles.masthead}>
          {profile.avatarUri ? (
            <Image source={resolveImageSource(profile.avatarUri)} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              {initial ? (
                <Text style={[styles.avatarInitial, { color: colors.foreground }]}>{initial}</Text>
              ) : (
                <Feather name="user" size={24} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              )}
            </View>
          )}
          <Text style={[styles.name, { color: colors.foreground }]}>
            {profile.name || "Your Studio"}
          </Text>
          <Text style={[styles.url, { color: colors.mutedForeground }]}>
            {PUBLIC_SITE_DOMAIN}/{publicSiteSlug(profile.name)}
          </Text>
        </View>

        {profile.bio.trim() ? (
          <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio.trim()}</Text>
        ) : null}

        {profile.statement.trim() ? (
          <View style={[styles.statementCard, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.12)" }]}>
            <Text style={[styles.statementText, { color: colors.foreground }]}>
              {profile.statement.trim()}
            </Text>
          </View>
        ) : null}

        {/* Contact & links */}
        {links.length > 0 ? (
          <View style={styles.links}>
            {links.map((l) => (
              <View key={l.label} style={styles.linkRow}>
                <Feather name={l.icon} size={13} color={colors.mutedForeground} />
                <Text style={[styles.linkText, { color: colors.cobalt }]} numberOfLines={1}>
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: "rgba(120,110,100,0.12)" }]} />

        {/* Featured collections */}
        {featured.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={20} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing featured yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Feature a public collection with public pieces to fill your site.
            </Text>
          </View>
        ) : (
          featured.map(({ collection, pieces: cp, coverUri, coverPieceId }, index) => (
            <View key={collection.id} style={styles.collectionSection}>
              {index > 0 ? (
                <View style={styles.chapterBreak}>
                  <View style={[styles.chapterRule, { backgroundColor: "rgba(120,110,100,0.18)" }]} />
                </View>
              ) : null}
              <View style={styles.collectionHeader}>
                <Text style={[styles.collectionIndex, { color: colors.emerald }]}>
                  {`${String(index + 1).padStart(2, "0")} · Collection`}
                </Text>
                <Text style={[styles.collectionTitle, { color: colors.foreground }]}>
                  {collection.title}
                </Text>
                <Text style={[styles.collectionMeta, { color: colors.mutedForeground }]}>
                  {`${cp.length} ${cp.length === 1 ? "piece" : "pieces"}`}
                </Text>
                {collection.intro.trim() ? (
                  <Text style={[styles.collectionIntro, { color: colors.mutedForeground }]}>
                    {collection.intro.trim()}
                  </Text>
                ) : null}
              </View>
              {coverUri ? (
                <Pressable
                  style={({ pressed }) => [styles.coverWrap, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={() =>
                    coverPieceId ? router.push(`/piece/${coverPieceId}?public=1`) : undefined
                  }
                  disabled={!coverPieceId}
                >
                  <Image
                    source={resolveImageSource(coverUri)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="memory-disk"
                    recyclingKey={coverUri}
                  />
                </Pressable>
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Feather name="layers" size={26} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                </View>
              )}
              {renderPieces(cp)}
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating back */}
      <View style={[styles.topBar, { top: topPad + 10 }]}>
        <Pressable
          style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color="#8A7B6C" />
        </Pressable>
        <View style={[styles.previewPill, { backgroundColor: "rgba(107,139,122,0.14)" }]}>
          <Feather name="eye" size={11} color={colors.emerald} />
          <Text style={[styles.previewPillText, { color: colors.emerald }]}>Preview</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 28 },
  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  previewPillText: { fontSize: 11, fontFamily: "Poppins_500Medium", letterSpacing: 0.4 },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 18,
    textAlign: "center",
  },
  masthead: { alignItems: "center", marginBottom: 22 },
  avatar: { width: 76, height: 76, borderRadius: 38, marginBottom: 14 },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarInitial: { fontSize: 30, fontFamily: "PlayfairDisplay_400Regular" },
  name: {
    fontSize: 30,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.4,
    lineHeight: 38,
    textAlign: "center",
  },
  url: { fontSize: 12, fontFamily: "Poppins_300Light", letterSpacing: 0.3, marginTop: 6 },
  bio: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 22,
  },
  statementCard: {
    padding: 22,
    borderRadius: 14,
    borderWidth: 0.75,
    marginBottom: 22,
  },
  statementText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    lineHeight: 27,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  links: { gap: 10, alignItems: "center", marginBottom: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 9, maxWidth: "100%" },
  linkText: { fontSize: 13, fontFamily: "Poppins_300Light", flexShrink: 1 },
  divider: { height: 1, marginVertical: 32 },
  collectionSection: { marginBottom: 8 },
  chapterBreak: {
    alignItems: "center",
    marginTop: 52,
    marginBottom: 52,
  },
  chapterRule: {
    width: 36,
    height: 1,
  },
  collectionHeader: {
    marginBottom: 22,
  },
  collectionIndex: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 2.2,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 6,
  },
  coverPlaceholder: {
    width: "100%",
    aspectRatio: 2.2,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionTitle: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 34,
  },
  collectionMeta: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 10,
  },
  collectionIntro: {
    fontSize: 13.5,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
    marginTop: 12,
  },
  // Grid layout
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 },
  gridTile: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  // Editorial layout
  editorialWrap: { gap: 12, marginTop: 14 },
  editorialTile: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  // Masonry layout
  masonryWrap: { flexDirection: "row", gap: 6, marginTop: 14 },
  masonryCol: { flex: 1, gap: 6 },
  masonryTile: { width: "100%", borderRadius: 10, overflow: "hidden" },
  masonryTall: { aspectRatio: 0.78 },
  masonryShort: { aspectRatio: 1.1 },
  tilePlaceholder: { alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 12, gap: 10 },
  emptyCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 250,
  },
});
