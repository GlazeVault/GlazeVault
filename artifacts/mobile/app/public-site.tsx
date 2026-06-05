import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildPublicMetaLine,
  getPortfolioCollectionPieces,
  isCollectionPublic,
  toPublicPiece,
  type PublicPieceView,
} from "@/constants/privacy";
import { ExpandableText } from "@/components/ExpandableText";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import {
  PUBLIC_SITE_DOMAIN,
  publicSiteSlug,
  useProfile,
} from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import {
  isLandscapeRatio,
  useImageOrientations,
} from "@/hooks/useImageOrientations";

export default function PublicSiteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { pieces } = usePottery();
  const { collections } = useCollections();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const site = profile.publicSite;

  // The portfolio is a curated exhibition: public collections ARE the
  // storytelling structure (context), but inside each one ONLY the pieces the
  // artist has consciously featured appear (focus). A public collection with no
  // featured pieces is dropped entirely; with nothing featured the portfolio
  // reads intentionally empty.
  const publicCollections = collections
    .filter(isCollectionPublic)
    .map((c) => {
      const cp = getPortfolioCollectionPieces(c, pieces).map(toPublicPiece);
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

  // A single piece tile, always shown with `contain` so the pottery silhouette
  // is never cropped. Column tiles ("half") keep their natural ratio but are
  // gently clamped to a calm band so heights vary subtly rather than chaotically;
  // full-width plates ("full") preserve their true wide ratio for an exhibition
  // moment.
  const renderTile = (piece: PublicPieceView, span: "full" | "half") => {
    const natural = orientations[piece.imageUri] ?? (span === "full" ? 1.5 : 0.82);
    const ratio =
      span === "half" ? Math.min(Math.max(natural, 0.72), 1.05) : Math.max(natural, 1.2);
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

  // The single GlazeVault signature layout: a calm, curated monograph flow.
  // Portrait and square pieces flow in two columns, packed shortest-column-first
  // so their (gently clamped) natural heights stagger into a quiet, organic
  // rhythm — clarity of a catalog with the breath of an art book. Landscape work
  // lifts out into full-width exhibition plates that punctuate the column flow.
  // Nothing is cropped, spacing stays generous, and the asymmetry stays subtle.
  const renderPieces = (collectionPieces: PublicPieceView[]) => {
    type Block =
      | { kind: "plate"; key: string; piece: PublicPieceView }
      | { kind: "cols"; key: string; left: PublicPieceView[]; right: PublicPieceView[] };
    const blocks: Block[] = [];
    let bucket: PublicPieceView[] = [];
    const flush = () => {
      if (!bucket.length) return;
      // Estimated tile height is 1/ratio per unit of column width, so taller
      // pieces add more height and the next piece drops into whichever column is
      // currently shorter — the source of the gentle, staggered rhythm.
      let lh = 0;
      let rh = 0;
      const left: PublicPieceView[] = [];
      const right: PublicPieceView[] = [];
      for (const p of bucket) {
        // Estimate with the SAME clamped ratio the half tile renders at so the
        // shortest-column choice matches actual on-screen heights.
        const natural = orientations[p.imageUri] ?? 0.82;
        const clamped = Math.min(Math.max(natural, 0.72), 1.05);
        const h = 1 / clamped;
        if (lh <= rh) {
          left.push(p);
          lh += h;
        } else {
          right.push(p);
          rh += h;
        }
      }
      blocks.push({ kind: "cols", key: `cols-${bucket[0].id}`, left, right });
      bucket = [];
    };
    for (const p of collectionPieces) {
      if (isLandscapeRatio(orientations[p.imageUri])) {
        flush();
        blocks.push({ kind: "plate", key: `plate-${p.id}`, piece: p });
      } else {
        bucket.push(p);
      }
    }
    flush();
    return (
      <View style={styles.galleryWrap}>
        {blocks.map((b) =>
          b.kind === "plate" ? (
            <View key={b.key}>{renderTile(b.piece, "full")}</View>
          ) : (
            <View key={b.key} style={styles.galleryRow}>
              <View style={styles.galleryCol}>{b.left.map((p) => renderTile(p, "half"))}</View>
              <View style={styles.galleryCol}>{b.right.map((p) => renderTile(p, "half"))}</View>
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
          <ExpandableText
            text={profile.bio.trim()}
            color={colors.foreground}
            textStyle={styles.bio}
            collapsedLines={6}
            moreLabel="Read More"
            lessLabel="Show Less"
            containerStyle={styles.bioWrap}
          />
        ) : null}

        {profile.statement.trim() ? (
          <View style={[styles.statementCard, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.12)" }]}>
            <ExpandableText
              text={profile.statement.trim()}
              color={colors.foreground}
              textStyle={styles.statementText}
              collapsedLines={6}
              moreLabel="Read Full Statement"
              lessLabel="Show Less"
            />
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
              {cp.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.galleryEntry,
                    {
                      borderColor: "rgba(120,110,100,0.22)",
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                  onPress={() => router.push(`/piece/${cp[0].id}?public=1&immersive=1`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${collection.title} as an immersive exhibition`}
                >
                  <Feather name="maximize" size={14} color={colors.emerald} />
                  <Text style={[styles.galleryEntryText, { color: colors.emerald }]}>
                    View Exhibition
                  </Text>
                </Pressable>
              ) : null}
              {collection.intro.trim() ? (
                <ExpandableText
                  text={collection.intro.trim()}
                  color={colors.mutedForeground}
                  textStyle={styles.collectionIntro}
                  collapsedLines={4}
                  moreLabel="Read more"
                  lessLabel="Read less"
                  containerStyle={styles.introWrap}
                />
              ) : null}
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
  bioWrap: { marginBottom: 22 },
  bio: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 25,
    letterSpacing: 0.2,
    textAlign: "left",
  },
  statementCard: {
    padding: 22,
    borderRadius: 14,
    borderWidth: 0.75,
    marginBottom: 22,
  },
  statementText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 28,
    letterSpacing: 0.2,
    textAlign: "left",
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
  galleryEntry: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  galleryEntryText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  introWrap: { marginTop: 18, marginBottom: 4 },
  collectionIntro: {
    fontSize: 13.5,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
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
  // Signature gallery: two calm columns packed by height so tiles stagger gently;
  // landscape pieces lift out into full-width exhibition plates. Generous,
  // intentional spacing keeps the rhythm quiet rather than chaotic.
  galleryWrap: { gap: 34, marginTop: 20 },
  galleryRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  galleryCol: { flex: 1, gap: 34 },
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
