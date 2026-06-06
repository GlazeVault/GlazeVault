import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import {
  buildPublicMetaLine,
  isPubliclyVisiblePiece,
  toPublicPiece,
  type PublicPieceView,
} from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { publicSiteSlug } from "@/context/ProfileContext";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";
import { useColors } from "@/hooks/useColors";
import {
  buildOrientationRows,
  isLandscapeRatio,
  useImageOrientations,
} from "@/hooks/useImageOrientations";

/**
 * A single public archive tile: the piece projected through the privacy boundary
 * (`toPublicPiece`) and always shown `contain` at its natural ratio so the
 * pottery silhouette is never cropped. Tapping opens the public piece page under
 * the same slug.
 */
function PublicTile({
  piece,
  slug,
  ratio,
}: {
  piece: PublicPieceView;
  slug: string;
  ratio: number;
}) {
  const colors = useColors();
  const title = piece.title.trim();
  const meta = buildPublicMetaLine(piece);
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={title || "View piece"}
      onPress={() => router.push(`/${slug}/piece/${piece.id}` as Href)}
    >
      <View
        style={[
          styles.tileImage,
          { aspectRatio: ratio, backgroundColor: colors.secondary },
        ]}
      >
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
          <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]}>
            <Feather
              name="image"
              size={18}
              color={colors.mutedForeground}
              style={{ opacity: 0.3 }}
            />
          </View>
        )}
      </View>
      {title || meta ? (
        <View style={styles.caption}>
          {title ? (
            <Text
              style={[styles.captionTitle, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {title}
            </Text>
          ) : null}
          {meta ? (
            <Text
              style={[styles.captionMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Live public archive at `/{slug}/archive` — the Archive doorway from the foyer.
 * Shows every piece the artist has marked public (the provider already filters
 * to publicly-visible pieces), in the same orientation-aware no-crop grid as the
 * owner's archive: portrait/square pieces pair two-up, landscape pieces break
 * out into a full-width catalog plate. Public projection only — never owner
 * metadata or the private piece route.
 */
function ArchiveInner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, profile, pieces } = usePublicArtist();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const publicPieces = pieces.filter(isPubliclyVisiblePiece).map(toPublicPiece);
  const orientations = useImageOrientations(publicPieces.map((p) => p.imageUri));
  const rows = buildOrientationRows(
    publicPieces,
    (p) => p.id,
    (p) => isLandscapeRatio(orientations[p.imageUri]),
  );

  if (status === "loading") return <PublicLoading />;
  if (status === "missing" || !profile.publicSite.enabled) {
    return <PublicMissing />;
  }

  const slug = publicSiteSlug(profile.name);
  const foyerHref = `/${slug}` as Href;
  const halfRatio = (p: PublicPieceView) =>
    Math.min(Math.max(orientations[p.imageUri] ?? 0.82, 0.72), 1.05);
  const fullRatio = (p: PublicPieceView) =>
    Math.max(orientations[p.imageUri] ?? 1.5, 1.2);

  const header = (
    <View style={styles.headerInset}>
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
          Archive
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {publicPieces.length === 0
            ? "No pieces on view"
            : `${publicPieces.length} ${publicPieces.length === 1 ? "piece" : "pieces"}`}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={rows}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 15,
          paddingTop: topPad + 20,
          paddingBottom: insets.bottom + 48,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
              <Feather
                name="image"
                size={20}
                color={colors.mutedForeground}
                style={{ opacity: 0.4 }}
              />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              This studio has no public pieces on view yet.
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "full" ? (
            <View style={styles.cell}>
              <PublicTile
                piece={item.item}
                slug={slug}
                ratio={fullRatio(item.item)}
              />
            </View>
          ) : (
            <View style={styles.pairRow}>
              <View style={styles.pairCell}>
                <PublicTile
                  piece={item.left}
                  slug={slug}
                  ratio={halfRatio(item.left)}
                />
              </View>
              <View style={styles.pairCell}>
                {item.right ? (
                  <PublicTile
                    piece={item.right}
                    slug={slug}
                    ratio={halfRatio(item.right)}
                  />
                ) : null}
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

export default function PublicArchiveRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <ArchiveInner />
    </PublicArtistProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cell: {
    paddingHorizontal: 9,
  },
  pairRow: {
    flexDirection: "row",
  },
  pairCell: {
    flex: 1,
    paddingHorizontal: 9,
  },
  tile: {
    marginBottom: 26,
  },
  tileImage: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  tilePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  captionTitle: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  captionMeta: {
    fontSize: 11.5,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    marginTop: 3,
  },
  headerInset: {
    paddingHorizontal: 9,
  },
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
