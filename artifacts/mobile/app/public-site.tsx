import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildPublicMetaLine,
  getPortfolioPieces,
  getPublicCollectionPieces,
  isCollectionPublic,
  toPublicPiece,
  type PublicPieceView,
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

function ExpandableIntro({ text, color }: { text: string; color: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [clampable, setClampable] = React.useState(false);

  return (
    <View style={styles.introWrap}>
      <Text
        style={[styles.collectionIntro, { color }]}
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          if (!clampable && e.nativeEvent.lines.length > 3) setClampable(true);
        }}
      >
        {text}
      </Text>
      {clampable ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.readMore, { color }]}>
            {expanded ? "Read less" : "Read more"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
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

  // The curated Portfolio is now driven at the piece level: every piece the
  // artist has hand-picked via "Feature in Portfolio" (which are, by invariant,
  // public and photographed). This is the headline of the public site.
  const portfolioPieces = getPortfolioPieces(pieces).map(toPublicPiece);

  // Beyond the curated portfolio, public collections form a broader public
  // archive. Each is reduced to its publicly visible pieces. Collection public/
  // private is independent of portfolio curation.
  const publicCollections = collections
    .filter(isCollectionPublic)
    .map((c) => {
      const cp = getPublicCollectionPieces(c, pieces).map(toPublicPiece);
      // Prefer the artist-chosen cover. Otherwise fall back to a piece that has
      // a photo.
      const fallback = cp.find((p) => p.imageUri) ?? null;
      const coverUri = c.coverImageUri || fallback?.imageUri || null;
      const coverPieceId = c.coverImageUri ? null : (fallback?.id ?? null);
      // Never repeat the cover artwork in the grid directly beneath it.
      const gridPieces = coverUri ? cp.filter((p) => p.imageUri !== coverUri) : cp;
      return { collection: c, pieces: cp, coverUri, coverPieceId, gridPieces };
    })
    .filter((entry) => entry.pieces.length > 0);

  const hasContent = portfolioPieces.length > 0 || publicCollections.length > 0;

  const links: { icon: keyof typeof Feather.glyphMap; label: string }[] = [];
  if (site.contactEmail.trim()) links.push({ icon: "mail", label: site.contactEmail.trim() });
  if (profile.instagram.trim()) links.push({ icon: "instagram", label: profile.instagram.trim() });
  if (profile.website.trim()) links.push({ icon: "globe", label: profile.website.trim() });
  if (site.etsy.trim()) links.push({ icon: "shopping-bag", label: site.etsy.trim() });
  if (site.shopify.trim()) links.push({ icon: "shopping-cart", label: site.shopify.trim() });

  const initial = profile.name.trim().charAt(0).toUpperCase();

  // A quiet, editorial caption beneath each piece: serif title + a single
  // whispered metadata line built via the shared buildPublicMetaLine helper, so
  // cards, collections and the detail page always render the exact same string.
  // Empty fields drop out.
  const renderCaption = (piece: PublicPieceView) => {
    const title = piece.title.trim();
    const meta = buildPublicMetaLine(piece);
    if (!title && !meta) return null;
    return (
      <View style={styles.caption}>
        {title ? (
          <Text style={[styles.captionTitle, { color: colors.foreground }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.captionMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderTile = (piece: PublicPieceView, imageStyle: object, wrapperStyle?: object) => {
    return (
      <Pressable
        key={piece.id}
        style={({ pressed }) => [styles.tileCol, wrapperStyle, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push(`/piece/${piece.id}?public=1`)}
      >
        <View style={[styles.tileImage, imageStyle]}>
          {piece.imageUri ? (
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
        </View>
        {renderCaption(piece)}
      </Pressable>
    );
  };

  // Asymmetric "art book" rhythm for the default layout: alternating large /
  // small pairs with staggered offsets and an occasional full-width cinematic
  // image, separated by generous negative space.
  const renderCatalog = (cp: PublicPieceView[], seed = 0) => {
    const rows: React.ReactNode[] = [];
    let i = 0;
    let rowIndex = 0;
    while (i < cp.length) {
      const remaining = cp.length - i;
      // Seed the rhythm with the collection index so alignment and offsets vary
      // across collections instead of every lone piece hugging the same side.
      const beat = rowIndex + seed;
      // An occasional full-bleed cinematic image breaks up the pair rhythm.
      const wideRow = rowIndex % 3 === 2 && remaining >= 2;
      if (wideRow) {
        rows.push(
          <View key={`row-${rowIndex}`}>{renderTile(cp[i], styles.catalogWideImg, styles.fullWidth)}</View>,
        );
        i += 1;
      } else if (remaining === 1) {
        // A lone piece sits offset with negative space beside it, alternating
        // side and drop so collections don't stack identically on the left.
        const alignEnd = beat % 2 === 1;
        rows.push(
          <View
            key={`row-${rowIndex}`}
            style={[styles.catalogSoloRow, alignEnd ? styles.soloEnd : styles.soloStart]}
          >
            {renderTile(cp[i], styles.catalogSoloImg, [styles.catalogSoloCol, alignEnd ? styles.catalogSoloDrop : null])}
          </View>,
        );
        i += 1;
      } else {
        const largeLeft = beat % 2 === 0;
        const a = cp[i];
        const b = cp[i + 1];
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.catalogPairRow}>
            {largeLeft ? (
              <>
                {renderTile(a, styles.catalogLargeImg, styles.catalogLargeCol)}
                {renderTile(b, styles.catalogSmallImg, [styles.catalogSmallCol, styles.catalogStagger])}
              </>
            ) : (
              <>
                {renderTile(a, styles.catalogSmallImg, [styles.catalogSmallCol, styles.catalogStaggerDeep])}
                {renderTile(b, styles.catalogLargeImg, styles.catalogLargeCol)}
              </>
            )}
          </View>,
        );
        i += 2;
      }
      rowIndex += 1;
    }
    return <View style={styles.catalogWrap}>{rows}</View>;
  };

  const renderPieces = (collectionPieces: PublicPieceView[], seed = 0) => {
    if (layout === "editorial") {
      return (
        <View style={styles.editorialWrap}>
          {collectionPieces.map((p) => renderTile(p, styles.editorialImg, styles.fullWidth))}
        </View>
      );
    }
    if (layout === "masonry") {
      const colA = collectionPieces.filter((_, i) => i % 2 === 0);
      const colB = collectionPieces.filter((_, i) => i % 2 === 1);
      return (
        <View style={styles.masonryWrap}>
          <View style={styles.masonryCol}>
            {colA.map((p, i) => renderTile(p, [styles.masonryImg, i % 2 === 0 ? styles.masonryTall : styles.masonryShort], styles.fullWidth))}
          </View>
          <View style={styles.masonryCol}>
            {colB.map((p, i) => renderTile(p, [styles.masonryImg, i % 2 === 0 ? styles.masonryShort : styles.masonryTall], styles.fullWidth))}
          </View>
        </View>
      );
    }
    return renderCatalog(collectionPieces, seed);
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
        <Text style={[styles.eyebrow, { color: colors.emerald }]}>Portfolio</Text>
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

        {!hasContent ? (
          <View style={styles.empty}>
            <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={20} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing in your portfolio yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Open a photographed piece and turn on “Feature in Portfolio” to fill your site.
            </Text>
          </View>
        ) : null}

        {/* Curated portfolio — hand-picked pieces */}
        {portfolioPieces.length > 0 ? (
          <View style={styles.collectionSection}>
            <View style={styles.collectionHeader}>
              <Text style={[styles.collectionIndex, { color: colors.emerald }]}>
                Curated
              </Text>
              <Text style={[styles.collectionTitle, { color: colors.foreground }]}>
                Selected Works
              </Text>
              <Text style={[styles.collectionMeta, { color: colors.mutedForeground }]}>
                {`${portfolioPieces.length} ${portfolioPieces.length === 1 ? "piece" : "pieces"}`}
              </Text>
            </View>
            {renderPieces(portfolioPieces, 0)}
          </View>
        ) : null}

        {/* Public collections — broader public archive */}
        {publicCollections.length > 0 ? (
          publicCollections.map(({ collection, pieces: cp, coverUri, coverPieceId, gridPieces }, index) => (
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
                  <ExpandableIntro
                    text={collection.intro.trim()}
                    color={colors.mutedForeground}
                  />
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
              {gridPieces.length > 0 ? renderPieces(gridPieces, index) : null}
            </View>
          ))
        ) : null}
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
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 6,
  },
  coverPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
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
  introWrap: { marginTop: 12 },
  collectionIntro: {
    fontSize: 13.5,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
  },
  readMore: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    opacity: 0.8,
  },
  // Shared tile structure: a column holding an image box + a quiet caption.
  tileCol: {},
  tileImage: { width: "100%", borderRadius: 12, overflow: "hidden" },
  fullWidth: { width: "100%" },
  caption: { marginTop: 14, gap: 5, paddingHorizontal: 2 },
  captionTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    letterSpacing: 0.3,
    lineHeight: 22,
  },
  captionMeta: {
    fontFamily: "Poppins_300Light",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    opacity: 0.65,
  },
  // Catalog layout (asymmetric art-book rhythm)
  catalogWrap: { gap: 40, marginTop: 18 },
  catalogPairRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  catalogLargeCol: { flex: 1.6 },
  catalogLargeImg: { aspectRatio: 0.82 },
  catalogSmallCol: { flex: 1 },
  catalogSmallImg: { aspectRatio: 0.92 },
  catalogStagger: { marginTop: 30 },
  catalogStaggerDeep: { marginTop: 48 },
  catalogWideImg: { aspectRatio: 16 / 9 },
  catalogSoloRow: { flexDirection: "row" },
  soloStart: { justifyContent: "flex-start" },
  soloEnd: { justifyContent: "flex-end" },
  catalogSoloCol: { width: "68%" },
  catalogSoloImg: { aspectRatio: 0.86 },
  catalogSoloDrop: { marginTop: 36 },
  // Editorial layout
  editorialWrap: { gap: 20, marginTop: 14 },
  editorialImg: { aspectRatio: 4 / 3 },
  // Masonry layout
  masonryWrap: { flexDirection: "row", gap: 10, marginTop: 14 },
  masonryCol: { flex: 1, gap: 18 },
  masonryImg: { borderRadius: 10 },
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
