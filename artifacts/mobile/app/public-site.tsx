import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildLinkShareContent,
  buildPublicMetaLine,
  getPortfolioCollectionPieces,
  isCollectionPublic,
  isPortfolioPiece,
  resolveGatedCover,
  toPublicPiece,
  type PublicPieceView,
} from "@/constants/privacy";
import { ArtistHero } from "@/components/ArtistHero";
import { ExpandableText } from "@/components/ExpandableText";
import { FollowButton } from "@/components/FollowButton";
import { SaveButton } from "@/components/SaveButton";
import { ShareSheet } from "@/components/ShareSheet";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { useSaved } from "@/context/SavedContext";
import {
  collectionShareUrl,
  portfolioShareUrl,
  publicSiteSlug,
  useProfile,
} from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";
import { usePublicArtistOptional } from "@/context/PublicArtistContext";
import { useColors } from "@/hooks/useColors";
import {
  isLandscapeRatio,
  useImageOrientations,
} from "@/hooks/useImageOrientations";

/** A contact/social link with the icon, the label shown, and how to open it. */
type ProfileLink = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  /** Web URL the row resolves to (always has a scheme). */
  url: string;
  /** Optional app deep link tried first (e.g. the Instagram app). */
  appUrl?: string;
};

/** Strip a bare Instagram handle out of whatever the artist typed. */
function instagramHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.|m\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0];
}

/** Ensure a user-typed URL/email turns into something openable. */
function buildProfileLink(
  icon: keyof typeof Feather.glyphMap,
  label: string,
): ProfileLink {
  if (icon === "mail") {
    return { icon, label, url: `mailto:${label}` };
  }
  if (icon === "instagram") {
    const handle = instagramHandle(label);
    return {
      icon,
      label,
      url: `https://instagram.com/${handle}`,
      appUrl: `instagram://user?username=${handle}`,
    };
  }
  const url = /^https?:\/\//i.test(label) ? label : `https://${label}`;
  return { icon, label, url };
}

/** Open a profile link, preferring a native app deep link when available. */
async function openProfileLink(link: ProfileLink) {
  try {
    if (link.appUrl && Platform.OS !== "web") {
      const supported = await Linking.canOpenURL(link.appUrl);
      if (supported) {
        await Linking.openURL(link.appUrl);
        return;
      }
    }
    await Linking.openURL(link.url);
  } catch {
    // Best-effort: a malformed link should never crash the page.
  }
}

export default function PublicSiteScreen({
  live = false,
  onlyCollectionId,
  backHref,
}: { live?: boolean; onlyCollectionId?: string; backHref?: string } = {}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // On a live public page the data comes from the remote PublicArtistContext (a
  // visitor viewing ANOTHER artist by slug). The owner's own in-app preview has
  // no such provider, so it falls back to the local owner contexts.
  const pub = usePublicArtistOptional();
  const { profile: ownProfile } = useProfile();
  const { pieces: ownPieces } = usePottery();
  const { collections: ownCollections } = useCollections();
  const profile = pub ? pub.profile : ownProfile;
  const pieces = pub ? pub.pieces : ownPieces;
  const collections = pub ? pub.collections : ownCollections;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const site = profile.publicSite;
  const [shareVisible, setShareVisible] = useState(false);

  // Public navigation must stay under the artist `[slug]` routes, which the auth
  // guard treats as public (reachable by anon/other artists). The owner's own
  // in-app preview instead uses the private `/piece/...?public=1` route, which a
  // signed-in owner can reach directly.
  const slug = publicSiteSlug(profile.name);
  const pieceHref = (pid: string, extra = ""): Href =>
    (pub
      ? `/${slug}/piece/${pid}${extra ? `?${extra}` : ""}`
      : `/piece/${pid}?public=1${extra ? `&${extra}` : ""}`) as Href;

  // Quiet, private viewer-side curation. The artist this page belongs to is
  // identified by their public slug; saving/following is keyed off it.
  const {
    isFollowing,
    toggleFollowing,
    isArtistSaved,
    toggleArtistSaved,
    isCollectionSaved,
    toggleCollectionSaved,
  } = useSaved();
  const artistRef = { slug: publicSiteSlug(profile.name), name: profile.name || "Studio" };

  // The portfolio is a curated exhibition: public collections ARE the
  // storytelling structure (context), but inside each one ONLY the pieces the
  // artist has consciously featured appear (focus). A public collection with no
  // featured pieces is dropped entirely; with nothing featured the portfolio
  // reads intentionally empty.
  // This featured-only rule holds on EVERY public surface, including a single
  // collection page (`onlyCollectionId`, the target of a shared collection link)
  // — a focused view of a public collection must never expose unfeatured public
  // works the artist did not curate into the exhibition.
  const collectionPiecesFor = getPortfolioCollectionPieces;
  const publicCollections = collections
    .filter(isCollectionPublic)
    .filter((c) => !onlyCollectionId || c.id === onlyCollectionId)
    .map((c) => {
      const cp = collectionPiecesFor(c, pieces).map(toPublicPiece);
      // Resolve the cover through the SAME featured gate as the grid: an
      // artist-chosen cover is honored only when it is a featured piece or a
      // dedicated uploaded cover — a cover pointing at an unfeatured/private
      // piece is dropped to a featured piece so it can never leak onto the
      // Portfolio. `pieces` (this surface's widest view) is the detection set.
      const { coverUri, coverPieceId } = resolveGatedCover(c, cp, pieces);
      // Never repeat the cover artwork in the grid directly beneath it.
      const gridPieces = coverUri ? cp.filter((p) => p.imageUri !== coverUri) : cp;
      return { collection: c, pieces: cp, coverUri, coverPieceId, gridPieces };
    })
    .filter((entry) => entry.pieces.length > 0);

  const publicCollectionIds = publicCollections.map((entry) => entry.collection.id);
  const standalonePortfolioPieces = onlyCollectionId
    ? []
    : pieces
        .filter(
          (p) =>
            isPortfolioPiece(p) &&
            !(p.collectionIds ?? []).some((cid) => publicCollectionIds.includes(cid)),
        )
        .map(toPublicPiece);

  const hasContent = publicCollections.length > 0 || standalonePortfolioPieces.length > 0;

  // Measure natural ratios for every piece shown in the grids (flattened across
  // all public collections) so landscape work can break out full-width with no
  // crop, just like the Archive and collection views.
  const orientations = useImageOrientations(
    [
      ...standalonePortfolioPieces.map((p) => p.imageUri),
      ...publicCollections.flatMap((e) => e.gridPieces.map((p) => p.imageUri)),
    ],
  );

  const links: ProfileLink[] = [];
  if (site.contactEmail.trim()) links.push(buildProfileLink("mail", site.contactEmail.trim()));
  if (profile.instagram.trim()) links.push(buildProfileLink("instagram", profile.instagram.trim()));
  if (profile.website.trim()) links.push(buildProfileLink("globe", profile.website.trim()));
  if (site.etsy.trim()) links.push(buildProfileLink("shopping-bag", site.etsy.trim()));
  if (site.shopify.trim()) links.push(buildProfileLink("shopping-cart", site.shopify.trim()));

  // The share payload follows what the page actually is: a single-collection
  // page shares that collection (a mini-exhibition); otherwise the whole
  // portfolio. Both build on the env-driven public base URL so the link
  // resolves to the live host.
  const heroCollectionTitle = onlyCollectionId
    ? (publicCollections[0]?.collection.title ?? "")
    : "";
  const shareContent = onlyCollectionId
    ? buildLinkShareContent(
        heroCollectionTitle || "Exhibition",
        collectionShareUrl(profile.name, onlyCollectionId),
        "A ceramic exhibition",
        profile.name,
      )
    : buildLinkShareContent(
        profile.name || "Portfolio",
        portfolioShareUrl(profile.name),
        "A ceramic portfolio",
        profile.name,
      );

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
  const renderTile = (piece: PublicPieceView, span: "full" | "half", collectionId: string) => {
    const natural = orientations[piece.imageUri] ?? (span === "full" ? 1.5 : 0.82);
    const ratio =
      span === "half" ? Math.min(Math.max(natural, 0.72), 1.05) : Math.max(natural, 1.2);
    return (
      <Pressable
        key={piece.id}
        style={({ pressed }) => [styles.tileCol, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push(pieceHref(piece.id, `from=${collectionId}`))}
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
  const renderPieces = (collectionPieces: PublicPieceView[], collectionId: string) => {
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
            <View key={b.key}>{renderTile(b.piece, "full", collectionId)}</View>
          ) : (
            <View key={b.key} style={styles.galleryRow}>
              <View style={styles.galleryCol}>{b.left.map((p) => renderTile(p, "half", collectionId))}</View>
              <View style={styles.galleryCol}>{b.right.map((p) => renderTile(p, "half", collectionId))}</View>
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
        {/* Entering the artist's world before the work: one large, full-width
            hero shown at its TRUE proportions, then the calm identity — the
            artist name and ONE optional second line (the collection title on a
            single-exhibition page, otherwise the artist's own tagline). Shared
            with the owner's app entry so both first impressions feel identical. */}
        <ArtistHero
          imageUri={profile.heroImageUri}
          focalY={profile.heroFocalY}
          focalX={profile.heroFocalX}
          zoom={profile.heroZoom}
          name={profile.name}
          secondLine={
            onlyCollectionId
              ? publicCollections[0]?.collection.title
              : profile.tagline
          }
          pullUp={topPad + 64}
          bleed={28}
        />

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
              <Pressable
                key={l.label}
                style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.5 : 1 }]}
                onPress={() => openProfileLink(l)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${l.label}`}
                hitSlop={6}
              >
                <Feather name={l.icon} size={13} color={colors.mutedForeground} />
                <Text style={[styles.linkText, { color: colors.cobalt }]} numberOfLines={1}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Quiet network controls — kept deliberately low, after the artist's
            words, never at the top. On a single exhibition page the visitor can
            save that exhibition; on the portfolio they can follow the archive and
            save the artist. No counts, no metrics, no pressure. */}
        <View style={styles.inspireRow}>
          {onlyCollectionId ? (
            <SaveButton
              saved={isCollectionSaved(onlyCollectionId)}
              onPress={() => toggleCollectionSaved(onlyCollectionId)}
              label={isCollectionSaved(onlyCollectionId) ? "Saved" : "Save Exhibition"}
              accessibilityLabel="Save this exhibition to your inspiration"
            />
          ) : (
            <>
              <FollowButton
                following={isFollowing(artistRef.slug)}
                onPress={() => toggleFollowing(artistRef)}
              />
              <SaveButton
                saved={isArtistSaved(artistRef.slug)}
                onPress={() => toggleArtistSaved(artistRef)}
                label={isArtistSaved(artistRef.slug) ? "Saved" : "Save Artist"}
                accessibilityLabel="Save this artist to your inspiration"
              />
            </>
          )}
        </View>

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

        {standalonePortfolioPieces.length > 0 ? (
          <View style={styles.collectionSection}>
            <View style={styles.collectionHeader}>
              <Text style={[styles.collectionIndex, { color: colors.emerald }]}>
                Portfolio
              </Text>
              <Text style={[styles.collectionTitle, { color: colors.foreground }]}>
                Selected Work
              </Text>
              <Text style={[styles.collectionMeta, { color: colors.mutedForeground }]}>
                {`${standalonePortfolioPieces.length} ${
                  standalonePortfolioPieces.length === 1 ? "piece" : "pieces"
                }`}
              </Text>
            </View>
            {renderPieces(standalonePortfolioPieces, "portfolio")}
          </View>
        ) : null}

        {/* Public collections — optional groups flowing from the artist header. */}
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
                    coverPieceId
                      ? router.push(pieceHref(coverPieceId, `from=${collection.id}`))
                      : undefined
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
                  onPress={() =>
                    router.push(pieceHref(cp[0].id, `immersive=1&from=${collection.id}`))
                  }
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
              {gridPieces.length > 0 ? renderPieces(gridPieces, collection.id) : null}
            </View>
          ))
        ) : null}
      </ScrollView>

      {/* Floating back + share. In the owner's in-app PREVIEW we show a back
          button and a "Preview" pill; on the LIVE public page a visitor has no
          back stack and it isn't a preview, so those are dropped and only the
          share affordance remains. */}
      <View style={[styles.topBar, { top: topPad + 10 }]}>
        {live ? (
          // On a live public sub-page (reached from the foyer) offer a quiet way
          // back to the entrance; falls back to the foyer href on a cold load
          // that has no back stack. Without a backHref (the foyer itself opening
          // the portfolio directly) there is nothing to go back to.
          backHref ? (
            <Pressable
              style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace(backHref as Href)
              }
            >
              <Feather name="arrow-left" size={18} color="#8A7B6C" />
            </Pressable>
          ) : (
            <View />
          )
        ) : (
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={18} color="#8A7B6C" />
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {site.enabled ? (
            <Pressable
              style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
              onPress={() => {
                console.log("[glazevault] share link", shareContent.url);
                setShareVisible(true);
              }}
            >
              <Feather name="share-2" size={16} color="#8A7B6C" />
            </Pressable>
          ) : null}
          {live ? null : (
            <View style={[styles.previewPill, { backgroundColor: "rgba(107,139,122,0.14)" }]}>
              <Feather name="eye" size={11} color={colors.emerald} />
              <Text style={[styles.previewPillText, { color: colors.emerald }]}>Preview</Text>
            </View>
          )}
        </View>
      </View>

      {/* Share — only mounts once the public site is enabled, so the portfolio
          link is never shared before it would resolve. */}
      {site.enabled ? (
        <ShareSheet
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          content={shareContent}
        />
      ) : null}
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
  inspireRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
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
