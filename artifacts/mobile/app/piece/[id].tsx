import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DraggablePhotoStrip } from "@/components/DraggablePhotoStrip";
import { confirm } from "@/lib/confirm";
import { ImageViewer, type ViewerItem } from "@/components/ImageViewer";
import { ShareSheet } from "@/components/ShareSheet";
import {
  buildPublicMetaLine,
  buildShareContent,
  isCollectionPublic,
  isFeaturedPublicPiece,
  isPortfolioPiece,
  isPubliclyVisiblePiece,
  toPublicPiece,
} from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { PUBLIC_SITE_DOMAIN, publicSiteSlug, useProfile } from "@/context/ProfileContext";
import { useColors } from "@/hooks/useColors";

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: "rgba(120, 110, 100, 0.14)" }]}>
      <View style={[styles.infoAccent, { backgroundColor: accent }]} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function PieceDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    from?: string;
    public?: string;
    immersive?: string;
  }>();
  const { id, from } = params;
  const isPublicView = params.public === "1";
  const {
    pieces,
    updatePiece,
    toggleFavorite,
    deletePiece,
    addPieceToCollection,
    removePieceFromCollection,
  } = usePottery();
  const { collections } = useCollections();
  const { profile } = useProfile();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const shareUrl = `${PUBLIC_SITE_DOMAIN}/${publicSiteSlug(profile.name)}`;
  const piece = pieces.find((p) => p.id === id);
  const [shareVisible, setShareVisible] = useState(false);
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false);
  const [updatingCollection, setUpdatingCollection] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  // Offset (within the current piece's photos) the viewer should open at.
  const [viewerStart, setViewerStart] = useState(0);

  // Optional "view as gallery" entry: when a collection launches the immersive
  // art-book viewer it routes here with ?immersive=1, so we open the fullscreen
  // viewer straight away at the start of the sequence. All the scoping/privacy
  // logic for the swipe set still lives below — this just auto-opens it.
  const autoImmersive = params.immersive === "1";
  useEffect(() => {
    if (autoImmersive) {
      setViewerStart(0);
      setViewerVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoImmersive, id]);

  if (!piece) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }}>
          Piece not found
        </Text>
      </View>
    );
  }

  // A piece can now belong to many collections. Keep the full membership list
  // for the collection row + picker.
  const pieceCollections = collections.filter((c) => piece.collectionIds.includes(c.id));

  // Pieces the fullscreen viewer can swipe through. In the public preview we keep
  // it to this piece alone so private work is never reachable; when opened from a
  // collection we stay within that collection; otherwise the whole archive.
  const galleryPieces = (() => {
    if (isPublicView) {
      // Public gallery: swipe only across FEATURED, publicly visible pieces that
      // share a PUBLIC collection with this one — i.e. exactly the pieces shown
      // on the portfolio. Never reach a private/archived/unfeatured piece — that
      // gate lives in isFeaturedPublicPiece + isCollectionPublic.
      if (piece.collectionIds.length === 0) return [piece];
      const sharedPublicIds = piece.collectionIds.filter((cid) =>
        collections.some((c) => c.id === cid && isCollectionPublic(c)),
      );
      if (sharedPublicIds.length === 0) return [piece];
      const siblings = pieces.filter(
        (p) =>
          p.collectionIds.some((cid) => sharedPublicIds.includes(cid)) &&
          isFeaturedPublicPiece(p),
      );
      return siblings.some((p) => p.id === piece.id) ? siblings : [piece];
    }
    const scoped = from ? pieces.filter((p) => p.collectionIds.includes(from)) : pieces;
    return scoped.some((p) => p.id === piece.id) ? scoped : [piece];
  })();
  // Collection name shown in the viewer caption. When opened from a collection we
  // name that collection; otherwise the piece's first collection. The public
  // viewer only ever names a PUBLIC collection, so a private collection's name
  // never reaches a non-owner surface.
  const ownerCollectionName = (p: (typeof pieces)[number]): string => {
    const target = from
      ? collections.find((c) => c.id === from)
      : p.collectionIds
          .map((cid) => collections.find((c) => c.id === cid))
          .find(Boolean);
    return target?.title ?? "";
  };
  const publicCollectionName = (p: (typeof pieces)[number]): string => {
    const target = p.collectionIds
      .map((cid) => collections.find((c) => c.id === cid))
      .find((c): c is NonNullable<typeof c> => !!c && isCollectionPublic(c));
    return target?.title ?? "";
  };

  // The ordered photo set for a piece. Falls back to the single cover for
  // legacy pieces that predate multi-photo support.
  const ownerImagesOf = (p: (typeof pieces)[number]): string[] =>
    p.images && p.images.length > 0 ? p.images : p.imageUri ? [p.imageUri] : [];

  // The public viewer is one-cover-per-piece (privacy projection unchanged): a
  // non-owner can only ever see each public piece's cover. The owner viewer
  // FLATTENS to one entry per photo so the owner can swipe through every photo
  // of every in-scope piece. `pieceStartIndex` is where the current piece's
  // photos begin in the flattened list.
  let viewerItems: ViewerItem[];
  let pieceStartIndex: number;
  if (isPublicView) {
    viewerItems = galleryPieces.map((p) => {
      // Project to the public allowlist first, then read only from it, so the
      // fullscreen viewer can never receive a private studio field. Captions use
      // the shared buildPublicMetaLine helper, so the viewer reads identically
      // to the detail page and the portfolio cards. Share content is built from
      // the projection too, so it can carry no owner-only field.
      const pub = toPublicPiece(p);
      return {
        uri: pub.imageUri,
        title: pub.title,
        materials: buildPublicMetaLine(pub),
        collection: publicCollectionName(p),
        share: buildShareContent(pub, shareUrl),
      };
    });
    pieceStartIndex = Math.max(
      0,
      galleryPieces.findIndex((p) => p.id === piece.id),
    );
  } else {
    const items: ViewerItem[] = [];
    let start = 0;
    galleryPieces.forEach((p) => {
      if (p.id === piece.id) start = items.length;
      // Owner-only caption (never reaches a public surface): a museum-label line
      // that includes the firing atmosphere. Firing is read with the established
      // firingEnvironment || firing fallback and is deliberately excluded from
      // every public projection (see toPublicPiece / buildPublicMetaLine).
      const firingAtmosphere = p.firingEnvironment || p.firing;
      const materials = [p.clay, p.glaze || p.cone, firingAtmosphere, p.year]
        .filter(Boolean)
        .join("  ·  ");
      const collection = ownerCollectionName(p);
      // Sharing is always a public surface — buildShareContent projects through
      // the public allowlist, so even the owner's share carries no studio field.
      const share = buildShareContent(p, shareUrl);
      ownerImagesOf(p).forEach((uri) => {
        items.push({ uri, title: p.title, materials, collection, share });
      });
    });
    viewerItems = items;
    pieceStartIndex = start;
  }

  // Current piece's own photos + which one is the cover (the hero always shows
  // the cover, so the viewer opens there unless a specific thumbnail is tapped).
  const ownerImages = ownerImagesOf(piece);
  const coverOffset = Math.max(0, ownerImages.indexOf(piece.imageUri));
  const viewerIndex = isPublicView ? pieceStartIndex : pieceStartIndex + viewerStart;

  const openViewerAt = (offset: number) => {
    setViewerStart(offset);
    setViewerVisible(true);
  };

  // Promote a thumbnail to the cover. Order is untouched; the photo simply
  // becomes `imageUri`. Because it is already a member of `images[]`, the
  // coalesceImages cover∈images invariant is preserved.
  const handleSetCover = async (index: number) => {
    const next = ownerImages[index];
    if (!next || next === piece.imageUri) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updatePiece(piece.id, { imageUri: next, images: ownerImages });
  };

  // Drag-to-reorder the photo set. The cover is re-pointed so it keeps
  // referencing the SAME photo it did before the move (not the same slot), so
  // the cover stays a member of images[] and never changes identity on reorder.
  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...ownerImages];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Cover identity is preserved by URI, so order can shuffle freely while the
    // same photo stays the cover.
    await updatePiece(piece.id, { imageUri: piece.imageUri, images: next });
  };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Remove Piece",
      message: `Remove "${piece.title}" from your archive?`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deletePiece(piece.id);
    router.back();
  };

  const handleContextRemove = async () => {
    if (!from) {
      await handleDelete();
      return;
    }
    const confirmed = await confirm({
      title: "Remove from Collection",
      message: `Remove "${piece.title}" from this collection? It will stay in your archive.`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removePieceFromCollection(from, piece.id);
    router.back();
  };

  // Toggle membership of a single collection. Adding a piece to a collection is
  // pure organization — it never auto-publishes or features the piece.
  const handleToggleCollection = async (collectionId: string) => {
    setUpdatingCollection(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (piece.collectionIds.includes(collectionId)) {
        await removePieceFromCollection(collectionId, piece.id);
      } else {
        await addPieceToCollection(collectionId, piece.id);
      }
    } finally {
      setUpdatingCollection(false);
    }
  };

  // Portfolio curation + public visibility, kept coupled so Portfolio ⊆ Public:
  //  - Featuring a piece also makes it public.
  //  - Un-publishing a piece also un-features it.
  const isFeatured = isPortfolioPiece(piece);
  const isPublic = isPubliclyVisiblePiece(piece);

  const handleToggleFeature = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (piece.featuredInPortfolio) {
      await updatePiece(piece.id, { featuredInPortfolio: false });
    } else {
      await updatePiece(piece.id, { featuredInPortfolio: true, isPublic: true });
    }
  };

  const handleTogglePublic = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (piece.isPublic) {
      await updatePiece(piece.id, { isPublic: false, featuredInPortfolio: false });
    } else {
      await updatePiece(piece.id, { isPublic: true });
    }
  };

  const handleToggleArchive = async () => {
    // Archiving hides a piece from the public site, so confirm it; restoring is
    // non-destructive and applies immediately.
    if (!piece.archived) {
      const confirmed = await confirm({
        title: "Archive Piece",
        message: `Archive "${piece.title}"? It will be hidden from your public portfolio but stays in your archive.`,
        confirmText: "Archive",
        destructive: true,
      });
      if (!confirmed) return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updatePiece(piece.id, { archived: !piece.archived });
  };

  const formattedDate = new Date(piece.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Public preview: how this piece appears to others. A piece is publicly
  // visible iff it is marked Public, has a photo, and is not archived — curation
  // and publishing are now per-piece. isPubliclyVisiblePiece is the source of truth.
  if (isPublicView) {
    const latestPiece = pieces.find((p) => p.id === id);
    if (!latestPiece || !isPubliclyVisiblePiece(latestPiece)) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <View style={[styles.privateCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="lock" size={20} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
          </View>
          <Text style={[styles.privateTitle, { color: colors.foreground }]}>This piece is private</Text>
          <Text style={[styles.privateText, { color: colors.mutedForeground }]}>
            Turn on “Public” for this piece to publish it.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.privateBack, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.privateBackText, { color: colors.cobalt }]}>Go back</Text>
          </Pressable>
        </View>
      );
    }

    // Project to the public allowlist, then render ONLY from it — the detail
    // page can never read a private studio field. The metadata line (clay ·
    // dimensions · year) is shared with the portfolio cards + fullscreen viewer
    // via buildPublicMetaLine, so the same string renders identically on every
    // public surface.
    const publicView = toPublicPiece(piece);
    const publicMeta = buildPublicMetaLine(publicView);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={18} color="#8A7B6C" />
          </Pressable>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => setShareVisible(true)}
          >
            <Feather name="share-2" size={18} color="#8A7B6C" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        >
          {publicView.imageUri ? (
            <Pressable
              onPress={() => setViewerVisible(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`View ${publicView.title ? publicView.title : "piece"} fullscreen`}
            >
              <Image
                source={resolveImageSource(publicView.imageUri)}
                style={styles.heroImage}
                contentFit="cover"
                transition={220}
                cachePolicy="memory-disk"
                recyclingKey={publicView.id}
              />
              {galleryPieces.length > 1 ? (
                <View style={styles.galleryHint}>
                  <Feather name="layers" size={11} color="#FFFFFF" />
                  <Text style={styles.galleryHintText}>
                    {viewerIndex + 1} / {galleryPieces.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="image" size={26} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
            </View>
          )}

          <View style={styles.content}>
            <Text style={[styles.eyebrow, { color: colors.emerald }]}>Public View</Text>
            {publicView.title ? (
              <Text style={[styles.title, { color: colors.foreground }]}>{publicView.title}</Text>
            ) : null}

            {publicMeta ? (
              <Text style={[styles.publicMeta, { color: colors.mutedForeground }]}>
                {publicMeta}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <ShareSheet
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          content={buildShareContent(publicView, shareUrl)}
        />

        <ImageViewer
          visible={viewerVisible}
          items={viewerItems}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating controls */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <Pressable
          style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color="#8A7B6C" />
        </Pressable>
        <View style={styles.topRight}>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={handleFavorite}
          >
            <Feather
              name="heart"
              size={18}
              color={piece.isFavorite ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => setShareVisible(true)}
          >
            <Feather name="share-2" size={18} color="#8A7B6C" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* Hero image — tap to open the fullscreen viewer at the cover */}
        <Pressable
          onPress={() => openViewerAt(coverOffset)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`View ${piece.title} fullscreen`}
        >
          <Image
            source={resolveImageSource(piece.imageUri)}
            style={styles.heroImage}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={piece.id}
          />
          {ownerImages.length > 1 ? (
            <View style={styles.galleryHint}>
              <Feather name="image" size={11} color="#FFFFFF" />
              <Text style={styles.galleryHintText}>
                {ownerImages.length} photos
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* Thumbnail strip — tap a photo to make it the cover, hold and drag to
            reorder. The cover always stays a member of the photo set. */}
        {ownerImages.length > 1 ? (
          <View style={styles.thumbStrip}>
            <DraggablePhotoStrip
              images={ownerImages}
              coverIndex={coverOffset}
              onReorder={handleReorder}
              onSetCover={handleSetCover}
            />
            <Text style={[styles.thumbHint, { color: colors.mutedForeground }]}>
              Tap a photo to make it the cover · hold and drag to reorder
            </Text>
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{piece.title}</Text>

          {/* Date + visibility */}
          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: "#8A7B6C" }]}>
              Recorded {formattedDate}
            </Text>
          </View>

          {/* Curation & visibility — per-piece, kept coupled (Portfolio ⊆ Public).
              These are independent of which collections the piece belongs to. */}
          {piece.archived ? (
            <View
              style={[
                styles.visibilityRow,
                {
                  backgroundColor: colors.secondary,
                  borderColor: "rgba(120,110,100,0.16)",
                },
              ]}
            >
              <Feather name="archive" size={14} color={colors.mutedForeground} />
              <View style={styles.visibilityLabels}>
                <Text style={[styles.visibilityTitle, { color: colors.foreground }]}>
                  Archived
                </Text>
                <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                  Hidden from your portfolio and public site, but kept here
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.toggleGroup}>
              {/* Feature in Portfolio */}
              <Pressable
                style={[
                  styles.visibilityRow,
                  {
                    backgroundColor: isFeatured ? "rgba(107,139,122,0.1)" : colors.secondary,
                    borderColor: isFeatured ? "rgba(107,139,122,0.3)" : "rgba(120,110,100,0.16)",
                    opacity: piece.imageUri ? 1 : 0.55,
                  },
                ]}
                onPress={piece.imageUri ? handleToggleFeature : undefined}
                disabled={!piece.imageUri}
                accessibilityRole="switch"
                accessibilityState={{ checked: isFeatured, disabled: !piece.imageUri }}
                accessibilityLabel="Feature in Portfolio"
              >
                <Feather
                  name="star"
                  size={14}
                  color={isFeatured ? colors.emerald : colors.mutedForeground}
                />
                <View style={styles.visibilityLabels}>
                  <Text
                    style={[
                      styles.visibilityTitle,
                      { color: isFeatured ? colors.emerald : colors.foreground },
                    ]}
                  >
                    Feature in Portfolio
                  </Text>
                  <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                    {!piece.imageUri
                      ? "Add a photo to feature this piece"
                      : isFeatured
                        ? "Hand-picked for your curated portfolio"
                        : "Show this piece among your selected works"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.visToggle,
                    { backgroundColor: isFeatured ? colors.emerald : "rgba(120,110,100,0.18)" },
                  ]}
                >
                  <View
                    style={[styles.visToggleThumb, { transform: [{ translateX: isFeatured ? 18 : 2 }] }]}
                  />
                </View>
              </Pressable>

              {/* Public */}
              <Pressable
                style={[
                  styles.visibilityRow,
                  {
                    backgroundColor: isPublic ? "rgba(107,127,163,0.1)" : colors.secondary,
                    borderColor: isPublic ? "rgba(107,127,163,0.3)" : "rgba(120,110,100,0.16)",
                    opacity: piece.imageUri ? 1 : 0.55,
                  },
                ]}
                onPress={piece.imageUri ? handleTogglePublic : undefined}
                disabled={!piece.imageUri}
                accessibilityRole="switch"
                accessibilityState={{ checked: isPublic, disabled: !piece.imageUri }}
                accessibilityLabel="Public"
              >
                <Feather
                  name={isPublic ? "globe" : "lock"}
                  size={14}
                  color={isPublic ? colors.cobalt : colors.mutedForeground}
                />
                <View style={styles.visibilityLabels}>
                  <Text
                    style={[
                      styles.visibilityTitle,
                      { color: isPublic ? colors.cobalt : colors.foreground },
                    ]}
                  >
                    {isPublic ? "Public" : "Private"}
                  </Text>
                  <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                    {!piece.imageUri
                      ? "Add a photo to make this piece public"
                      : isPublic
                        ? "Viewable in your public collections and archive"
                        : "Only you can see this piece"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.visToggle,
                    { backgroundColor: isPublic ? colors.cobalt : "rgba(120,110,100,0.18)" },
                  ]}
                >
                  <View
                    style={[styles.visToggleThumb, { transform: [{ translateX: isPublic ? 18 : 2 }] }]}
                  />
                </View>
              </Pressable>
            </View>
          )}

          {isPublic && !piece.archived ? (
            <Pressable
              style={({ pressed }) => [styles.previewBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => router.push(`/piece/${piece.id}?public=1`)}
            >
              <Feather name="eye" size={13} color={colors.cobalt} />
              <Text style={[styles.previewBtnText, { color: colors.cobalt }]}>
                Preview public view
              </Text>
            </Pressable>
          ) : null}

          {/* Collection row */}
          <Pressable
            style={({ pressed }) => [
              styles.collectionRow,
              {
                backgroundColor: pressed ? colors.secondary : "transparent",
                borderColor: "rgba(120, 110, 100, 0.14)",
                borderRadius: 10,
              },
            ]}
            onPress={() => setCollectionPickerVisible(true)}
          >
            <View style={[styles.collectionAccent, { backgroundColor: colors.cobalt, opacity: pieceCollections.length > 0 ? 1 : 0.35 }]} />
            <Feather
              name="layers"
              size={13}
              color={pieceCollections.length > 0 ? colors.cobalt : colors.mutedForeground}
              style={{ opacity: pieceCollections.length > 0 ? 1 : 0.7 }}
            />
            <Text
              style={[
                styles.collectionRowText,
                {
                  color: pieceCollections.length > 0 ? colors.cobalt : colors.mutedForeground,
                  fontFamily: pieceCollections.length > 0 ? "Poppins_400Regular" : "Poppins_300Light",
                },
              ]}
              numberOfLines={1}
            >
              {pieceCollections.length === 0
                ? "Add to Collections"
                : pieceCollections.length === 1
                  ? `Collection · ${pieceCollections[0].title}`
                  : `${pieceCollections.length} collections`}
            </Text>
            <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          </Pressable>

          {/* Info rows */}
          <View style={[styles.infoCard, { borderColor: "rgba(120, 110, 100, 0.14)" }]}>
            <InfoRow label="Clay" value={piece.clay} accent={colors.cobalt} />
            <InfoRow label="Glaze" value={piece.glaze} accent={colors.emerald} />
            <InfoRow label="Cone" value={piece.cone} accent={colors.primary} />
            <InfoRow
              label="Firing Environment"
              value={piece.firingEnvironment || piece.firing}
              accent={colors.cobalt}
            />
            {piece.dimensions ? (
              <InfoRow
                label="Dimensions"
                value={piece.dimensions}
                accent={colors.mutedForeground}
              />
            ) : null}
            {piece.year ? (
              <InfoRow
                label="Year"
                value={piece.year}
                accent={colors.mutedForeground}
              />
            ) : null}
          </View>

          {/* Notes */}
          {piece.notes ? (
            <View style={styles.notesSection}>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>
                Studio Notes
              </Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {piece.notes}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => router.push(`/piece/edit/${piece.id}`)}
              >
                <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
                  Edit Piece
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.shareBtn,
                  {
                    backgroundColor: pressed ? colors.secondary : colors.foreground,
                    borderColor: colors.foreground,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => setShareVisible(true)}
              >
                <Feather name="share-2" size={14} color={colors.background} />
                <Text style={[styles.actionBtnText, { color: colors.background }]}>
                  Share
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.archiveLink,
                { opacity: pressed ? 0.5 : 0.85 },
              ]}
              onPress={handleToggleArchive}
            >
              <Feather
                name={piece.archived ? "rotate-ccw" : "archive"}
                size={13}
                color={colors.mutedForeground}
              />
              <Text style={[styles.archiveLinkText, { color: colors.mutedForeground }]}>
                {piece.archived ? "Restore piece" : "Archive piece"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteLink,
                { opacity: pressed ? 0.5 : 0.7 },
              ]}
              onPress={handleContextRemove}
            >
              <Text style={[styles.deleteLinkText, { color: colors.mutedForeground }]}>
                {from ? "Remove from collection" : "Delete piece"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Collection picker modal */}
      <Modal
        visible={collectionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectionPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCollectionPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalSheet,
                  {
                    backgroundColor: colors.background,
                    paddingBottom: Math.max(insets.bottom, 24),
                  },
                ]}
              >
                {/* Handle bar */}
                <View style={[styles.handle, { backgroundColor: "rgba(120,110,100,0.2)" }]} />

                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  Collections
                </Text>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  {collections.length === 0
                    ? "Create a collection first from the Collections tab."
                    : "Organize this piece into one or more collections. This won’t publish it."}
                </Text>

                <View style={[styles.sheetDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 320 }}
                  bounces={false}
                >
                  {/* Existing collections — multi-select toggle */}
                  {collections.map((col) => {
                    const isSelected = piece.collectionIds.includes(col.id);
                    return (
                      <Pressable
                        key={col.id}
                        style={({ pressed }) => [
                          styles.collectionOption,
                          {
                            backgroundColor: isSelected
                              ? "rgba(107,127,163,0.08)"
                              : pressed
                              ? colors.secondary
                              : "transparent",
                            borderColor: isSelected
                              ? "rgba(107,127,163,0.18)"
                              : "rgba(120,110,100,0.1)",
                          },
                        ]}
                        onPress={() => handleToggleCollection(col.id)}
                        disabled={updatingCollection}
                      >
                        <View
                          style={[
                            styles.optionIconCircle,
                            {
                              backgroundColor: isSelected
                                ? "rgba(107,127,163,0.12)"
                                : colors.secondary,
                            },
                          ]}
                        >
                          <Feather
                            name="layers"
                            size={14}
                            color={isSelected ? colors.cobalt : colors.mutedForeground}
                          />
                        </View>
                        <View style={styles.optionLabels}>
                          <Text
                            style={[
                              styles.optionTitle,
                              { color: isSelected ? colors.cobalt : colors.foreground },
                            ]}
                          >
                            {col.title}
                          </Text>
                          {col.intro ? (
                            <Text
                              style={[styles.optionSub, { color: colors.mutedForeground }]}
                              numberOfLines={1}
                            >
                              {col.intro}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.optionCheckbox,
                            {
                              backgroundColor: isSelected ? colors.cobalt : "transparent",
                              borderColor: isSelected ? colors.cobalt : "rgba(120,110,100,0.3)",
                            },
                          ]}
                        >
                          {isSelected && (
                            <Feather name="check" size={12} color={colors.background} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {collections.length === 0 && (
                    <View style={styles.emptyCollections}>
                      <Feather name="layers" size={20} color={colors.mutedForeground} style={{ opacity: 0.35 }} />
                      <Text style={[styles.emptyCollectionsText, { color: colors.mutedForeground }]}>
                        No collections yet
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <Pressable
                  style={({ pressed }) => [
                    styles.sheetCancel,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  onPress={() => setCollectionPickerVisible(false)}
                >
                  <Text style={[styles.sheetCancelText, { color: colors.mutedForeground }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        content={buildShareContent(piece, shareUrl)}
      />

      <ImageViewer
        visible={viewerVisible}
        items={viewerItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topRight: { flexDirection: "row", gap: 8 },
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
  heroImage: { width: "100%", aspectRatio: 4 / 5 },
  galleryHint: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 13,
    backgroundColor: "rgba(19,16,13,0.55)",
  },
  galleryHintText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.4,
    color: "#FFFFFF",
  },
  thumbStrip: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  thumbHint: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    marginTop: 8,
  },
  content: { paddingHorizontal: 28, paddingTop: 28 },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.4,
    lineHeight: 40,
    marginBottom: 10,
  },
  publicMeta: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.6,
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 12,
    opacity: 0.8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  date: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0.75,
    marginBottom: 16,
  },
  visibilityLabels: { flex: 1, gap: 2 },
  visibilityTitle: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  visibilitySub: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  toggleGroup: { gap: 0 },
  visToggle: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
  },
  visToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.75,
    marginBottom: 20,
  },
  collectionAccent: { width: 2.5, height: 14, borderRadius: 2 },
  collectionRowText: {
    flex: 1,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  infoCard: {
    borderWidth: 0.75,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.75,
    gap: 12,
  },
  infoAccent: { width: 3, height: 16, borderRadius: 2 },
  infoLabel: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    width: 72,
  },
  infoValue: { flex: 1, fontSize: 14, fontFamily: "Poppins_300Light" },
  notesSection: { marginBottom: 28 },
  notesLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  notesText: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    marginTop: 6,
  },
  previewBtnText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  // Public-view private notice
  privateCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  privateTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  privateText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 240,
  },
  privateBack: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 },
  privateBackText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  actions: { gap: 16 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderWidth: 0.75,
  },
  shareBtn: { borderWidth: 0 },
  actionBtnText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  archiveLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  archiveLinkText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
  },
  deleteLink: { alignItems: "center", paddingVertical: 4 },
  deleteLinkText: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    textDecorationLine: "underline",
    letterSpacing: 0.2,
  },
  optionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,45,42,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  sheetSub: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    lineHeight: 18,
    marginBottom: 16,
  },
  sheetDivider: { height: 1, marginBottom: 12 },
  collectionOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0.75,
    marginBottom: 8,
  },
  optionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabels: { flex: 1 },
  optionTitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.1,
  },
  optionSub: {
    fontSize: 11,
    fontFamily: "Poppins_300Light",
    marginTop: 2,
  },
  emptyCollections: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  emptyCollectionsText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
  },
  sheetCancel: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
  },
});
