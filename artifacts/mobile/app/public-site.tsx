import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildPublicMetaLine,
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
import {
  buildOrientationRows,
  isLandscapeRatio,
  useImageOrientations,
} from "@/hooks/useImageOrientations";

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

  // The portfolio is now collection-driven: public collections ARE the
  // storytelling structure of the site. Each is reduced to its publicly visible
  // pieces and presented like a mini exhibition (hero, title, intro, works).
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

  const hasContent = publicCollections.length > 0;

  // Measure natural ratios for every piece shown in the grids (flattened across
  // all public collections) so landscape work can break out full-width with no
  // crop, just like the Archive and collection views.
  const orientations = useImageOrientations(
    publicCollections.flatMap((e) => e.gridPieces.map((p) => p.imageUri)),
  );

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

  // A single piece tile: shown at its true natural ratio with `contain` so the
  // pottery silhouette is never cropped. `span` only affects the unmeasured
  // default (full rows lean landscape, half rows lean portrait).
  const renderTile = (piece: PublicPieceView, span: "full" | "half") => {
    const ratio = orientations[piece.imageUri] ?? (span === "full" ? 1.4 : 0.8);
    return (
      <Pressable
        key={piece.id}
        style={({ pressed }) => [styles.tileCol, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push(`/piece/${piece.id}?public=1`)}
      >
        <View style={[styles.tileImage, { aspectRatio: ratio }]}>
          {piece.imageUri ? (
            <Image
              source={resolveImageSource(piece.imageUri)}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
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

  // Orientation-aware grid shared by every layout. Editorial stacks each piece
  // full-width; otherwise portrait/square pieces pair two-up while landscape
  // work breaks out into its own full-width catalog plate. Either way, nothing
  // is cropped.
  const renderPieces = (collectionPieces: PublicPieceView[]) => {
    if (layout === "editorial") {
      return (
        <View style={styles.editorialWrap}>
          {collectionPieces.map((p) => renderTile(p, "full"))}
        </View>
      );
    }
    const rows = buildOrientationRows(
      collectionPieces,
      (p) => p.id,
      (p) => isLandscapeRatio(orientations[p.imageUri]),
    );
    return (
      <View style={styles.gridWrap}>
        {rows.map((row) =>
          row.kind === "full" ? (
            <View key={row.key}>{renderTile(row.item, "full")}</View>
          ) : (
            <View key={row.key} style={styles.gridPairRow}>
              <View style={styles.gridPairCol}>{renderTile(row.left, "half")}</View>
              <View style={styles.gridPairCol}>
                {row.right ? renderTile(row.right, "half") : null}
              </View>
            </View>
          ),
        )}
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
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No collections published yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Make a collection public to share a body of work as its own quiet exhibition.
            </Text>
          </View>
        ) : null}

        {/* Public collections — the portfolio is now collection-driven, each a
            mini exhibition flowing straight from the artist header. */}
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
              {gridPieces.length > 0 ? renderPieces(gridPieces) : null}
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
  avatar: { width: 92, height: 92, borderRadius: 46, marginBottom: 16 },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarInitial: { fontSize: 36, fontFamily: "PlayfairDisplay_400Regular" },
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
  tileImage: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(120,110,100,0.06)",
  },
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
  // Orientation grid: portrait/square paired two-up, landscape full-width.
  gridWrap: { gap: 28, marginTop: 18 },
  gridPairRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  gridPairCol: { flex: 1 },
  // Editorial layout: every piece stacked full-width.
  editorialWrap: { gap: 20, marginTop: 14 },
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
