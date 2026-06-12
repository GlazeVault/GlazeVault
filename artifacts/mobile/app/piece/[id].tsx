import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
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

import { AdvancedPublicVisibility } from "@/components/AdvancedPublicVisibility";
import { DraggablePhotoStrip } from "@/components/DraggablePhotoStrip";
import { confirm } from "@/lib/confirm";
import { ImageViewer, type ViewerItem } from "@/components/ImageViewer";
import { SaveButton } from "@/components/SaveButton";
import { ShareSheet } from "@/components/ShareSheet";
import {
  buildPublicMetaLine,
  buildShareContent,
  getPublicSwipePieces,
  isCollectionPublic,
  isPortfolioPiece,
  isPubliclyVisiblePiece,
  MAX_PORTFOLIO_ITEMS,
  toPublicPiece,
} from "@/constants/privacy";
import { notice } from "@/lib/notice";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { pieceShareUrl, useProfile } from "@/context/ProfileContext";
import { usePublicArtistOptional } from "@/context/PublicArtistContext";
import { useSaved } from "@/context/SavedContext";
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
  // `from` is a context token set by whatever opened this screen:
  //   - a collection id          → opened from that Collection
  //   - the literal "portfolio"  → opened from the Portfolio / Featured context
  //   - absent                   → opened from the Archive
  // Collection-scoped logic (swipe set, caption, unlink) must treat the
  // "portfolio" sentinel as "no collection", so derive a clean collection id
  // and a portfolio flag the footer uses to pick the right contextual action.
  const fromPortfolio = from === "portfolio";
  const fromCollectionId = from && !fromPortfolio ? from : undefined;
  // When mounted under a `/[slug]/piece/[id]` route a PublicArtistProvider is
  // present, supplying ANOTHER artist's public archive. That makes this a public
  // view (owner controls hidden) and the data comes from the remote provider;
  // otherwise it's the owner's own piece and reads from the local contexts.
  const pub = usePublicArtistOptional();
  const isPublicView = params.public === "1" || !!pub;
  const {
    pieces: ownPieces,
    updatePiece,
    ensurePieceRemote,
    deletePiece,
    addPieceToCollection,
    removePieceFromCollection,
  } = usePottery();
  const { collections: ownCollections } = useCollections();
  const { profile: ownProfile } = useProfile();
  const pieces = pub ? pub.pieces : ownPieces;
  const collections = pub ? pub.collections : ownCollections;
  const profile = pub ? pub.profile : ownProfile;
  const { isPieceSaved, togglePieceSaved } = useSaved();
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
      // Public gallery: swipe is scoped to the collection the visitor entered
      // from (`from`) when that collection is public, so it stays within that
      // exhibition; otherwise it spans portfolio pieces sharing any public
      // collection. The gate (isPortfolioPiece + isCollectionPublic) lives in
      // the selector, so a private/archived/unfeatured piece is never reachable.
      return getPublicSwipePieces(piece, pieces, collections, fromCollectionId);
    }
    const scoped = fromCollectionId
      ? pieces.filter((p) => p.collectionIds.includes(fromCollectionId))
      : pieces;
    return scoped.some((p) => p.id === piece.id) ? scoped : [piece];
  })();
  // Collection name shown in the viewer caption. When opened from a collection we
  // name that collection; otherwise the piece's first collection. The public
  // viewer only ever names a PUBLIC collection, so a private collection's name
  // never reaches a non-owner surface.
  const ownerCollectionName = (p: (typeof pieces)[number]): string => {
    const target = fromCollectionId
      ? collections.find((c) => c.id === fromCollectionId)
      : p.collectionIds
          .map((cid) => collections.find((c) => c.id === cid))
          .find(Boolean);
    return target?.title ?? "";
  };
  const publicCollectionName = (p: (typeof pieces)[number]): string => {
    // Prefer the collection the visitor entered from (when it is public and the
    // piece belongs to it) so the caption matches the exhibition being browsed;
    // otherwise fall back to the piece's first public collection.
    const fromCollection =
      fromCollectionId && p.collectionIds.includes(fromCollectionId)
        ? collections.find((c) => c.id === fromCollectionId && isCollectionPublic(c))
        : undefined;
    if (fromCollection) return fromCollection.title;
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
        share: buildShareContent(pub, pieceShareUrl(profile.name, p.id), profile.name),
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
      // Sharing is gated to public content: a private piece offers no share
      // payload at all, so the owner viewer can never surface a share for it.
      // When present, buildShareContent still projects through the public
      // allowlist, so even the owner's share carries no studio field.
      const share = isPubliclyVisiblePiece(p)
        ? buildShareContent(p, pieceShareUrl(profile.name, p.id), profile.name)
        : undefined;
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

  // Delete = the only destructive action. It permanently removes the piece from
  // the archive, every collection, the portfolio, and all public routes.
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete Piece",
      message: "Delete this piece permanently? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await deletePiece(piece.id);
    } catch (e) {
      console.warn("[glazevault] delete piece failed", e);
      notice({ title: "Couldn’t delete", message: "We couldn’t delete this piece. Please try again.", variant: "error" });
      return;
    }
    router.back();
  };

  // Remove from this Collection = a pure unlink. It only detaches the piece from
  // the collection the visitor entered from; the piece stays in the archive,
  // keeps its photos, its other collections, and its Public status. (Removing it
  // from its LAST collection auto-unfeatures it — a featured piece must live in a
  // collection — which is handled inside removePieceFromCollection.)
  const handleRemoveFromCollection = async () => {
    if (!fromCollectionId) return;
    const confirmed = await confirm({
      title: "Remove from this Collection",
      message: `Remove "${piece.title}" from this collection? It will stay safely in your archive.`,
      confirmText: "Remove",
    });
    if (!confirmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await removePieceFromCollection(fromCollectionId, piece.id);
    } catch (e) {
      console.warn("[glazevault] remove from collection failed", e);
      notice({ title: "Couldn’t remove", message: "We couldn’t remove this piece from the collection. Please try again.", variant: "error" });
      return;
    }
    router.back();
  };

  // Remove from Portfolio = turn OFF featured only. The piece stays in the
  // archive, stays in its collections, and its Public/private status is
  // unchanged. Shown only when opened from the portfolio context.
  const handleRemoveFromPortfolio = async () => {
    if (!piece.featuredInPortfolio) return;
    const confirmed = await confirm({
      title: "Remove from Portfolio",
      message: `Remove "${piece.title}" from your portfolio? It stays public and in your collections.`,
      confirmText: "Remove",
    });
    if (!confirmed) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const portfolioCountBefore = pieces.filter((p) => p.featuredInPortfolio).length;
    console.log("[portfolio] Remove from Portfolio", {
      pieceId: piece.id,
      featuredBefore: piece.featuredInPortfolio,
      portfolioCountBefore,
    });
    await updatePiece(piece.id, { featuredInPortfolio: false });
    console.log("[portfolio] Removed from Portfolio", {
      pieceId: piece.id,
      featuredAfter: false,
      portfolioCountAfter: portfolioCountBefore - 1,
    });
    router.back();
  };

  // Toggle membership of a single collection. Collection membership is pure
  // organization — fully INDEPENDENT of a piece's Public / Featured / Archived
  // state. A private or retired piece can belong to a collection as a draft
  // member without being forced public: public surfaces gate their own display
  // (getPublicCollectionPieces / isPubliclyVisiblePiece), so a private member
  // simply stays hidden from the public collection until the owner publishes it.
  const handleToggleCollection = async (collectionId: string) => {
    const isMember = piece.collectionIds.includes(collectionId);
    setUpdatingCollection(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isMember) {
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
  const portfolioCount = pieces.filter(isPortfolioPiece).length;
  const portfolioFull = portfolioCount >= MAX_PORTFOLIO_ITEMS && !piece.featuredInPortfolio;

  const handleToggleFeature = async () => {
    if (piece.featuredInPortfolio) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await updatePiece(piece.id, { featuredInPortfolio: false });
      return;
    }
    // Gate: Portfolio is a deliberately small best-of selection. Collections
    // are optional groups/tags and do not gate portfolio membership.
    if (portfolioFull) {
      notice({
        title: "Portfolio is full",
        message: `Your portfolio can hold up to ${MAX_PORTFOLIO_ITEMS} pieces. Remove one before adding another.`,
        variant: "error",
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Featuring publishes the piece, so it must reach Supabase — otherwise the
    // public link 404s. Surface a failed remote write instead of silently
    // featuring a piece that lives only in the local cache.
    const ok = await updatePiece(piece.id, { featuredInPortfolio: true, isPublic: true });
    if (!ok) {
      notice({
        title: "Couldn’t publish",
        message:
          "This piece was saved on this device but couldn’t reach the cloud, so its public link won’t work yet. Check your connection and try again.",
        variant: "error",
      });
    }
  };

  const handleTogglePublic = async () => {
    if (piece.isPublic) {
      // Make Private — confirm the consequences first. This turns OFF public,
      // auto-unfeatures (Portfolio ⊆ Public), and clears the per-piece
      // field-exposure opt-ins so a piece later re-published starts
      // private-by-default. The piece itself is never deleted — it stays in the
      // owner's archive with all its photos and metadata.
      const confirmed = await confirm({
        title: "Make Private",
        message:
          "This piece will become private and be removed from:\n• Public Portfolio\n• Public Collections\n• Public Links\n\nThe piece will remain safely stored in your Archive.",
        confirmText: "Make Private",
        destructive: true,
      });
      if (!confirmed) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updatePiece(piece.id, {
        isPublic: false,
        featuredInPortfolio: false,
        showGlazeDetails: false,
        showStudioNotes: false,
      });
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Publishing must reach Supabase — the public site reads the server, not
      // the local cache. If the remote write fails the change is cache-only and
      // the public link would 404, so surface it instead of silently "publishing".
      const ok = await updatePiece(piece.id, { isPublic: true });
      if (!ok) {
        notice({
          title: "Couldn’t publish",
          message:
            "This piece was saved on this device but couldn’t reach the cloud, so its public link won’t work yet. Check your connection and try again.",
          variant: "error",
        });
      }
    }
  };

  // Confirms the piece is live on Supabase before any owner share. This
  // self-heals a piece that only ever made it into the local cache (a past
  // remote write failed) so the owner is never handed a public link that the
  // public site cannot read. Returns whether sharing may proceed.
  const ensureShareable = async (): Promise<boolean> => {
    const live = await ensurePieceRemote(piece.id);
    if (!live) {
      notice({
        title: "Couldn’t share yet",
        message:
          "This piece couldn’t be saved to the cloud, so its public link won’t work yet. Check your connection and try again.",
        variant: "error",
      });
    }
    return live;
  };

  // Owner Share button: gate on a live remote row, then open the sheet.
  const handleOpenShare = async () => {
    // Defense in depth: never generate a public link for a non-public piece. The
    // Share affordance is already hidden for private pieces, but guard here too
    // so a private piece can never produce a link that would 404 for visitors.
    if (!isPubliclyVisiblePiece(piece)) {
      notice({
        title: "This piece is private",
        message: "Make it public before sharing so the link will open for others.",
        variant: "info",
      });
      return;
    }
    const url = pieceShareUrl(profile.name, piece.id);
    console.log("[glazevault] share link generated", url);
    if (await ensureShareable()) {
      setShareVisible(true);
    }
  };

  // The exact public URL shown in the detail and used by Share / Copy. Empty
  // only when it genuinely can't be built (no piece id); logged so the reason is
  // visible in the console.
  const publicUrl = piece.id ? pieceShareUrl(profile.name, piece.id) : "";

  // Tap-to-copy on the displayed link (gesture-safe: the clipboard write fires
  // synchronously inside the tap, no awaited work before it).
  const handleCopyPublicUrl = () => {
    if (!isPubliclyVisiblePiece(piece)) {
      notice({
        title: "This piece is private",
        message: "Make it public before sharing so the link will open for others.",
        variant: "info",
      });
      return;
    }
    if (!publicUrl) {
      console.warn(
        "[glazevault] copy link skipped: public URL could not be generated",
        { pieceId: piece.id, artist: profile.name },
      );
      notice({
        title: "Couldn’t generate link",
        message: "This piece doesn’t have a public link yet.",
        variant: "error",
      });
      return;
    }
    console.log("[glazevault] copy link", publicUrl);
    Clipboard.setStringAsync(publicUrl)
      .then(() => {
        console.log("[glazevault] copied link to clipboard", publicUrl);
        notice({
          title: "Link copied",
          message: "The public link is on your clipboard.",
          variant: "success",
        });
      })
      .catch((err) => {
        console.warn("[glazevault] clipboard copy failed", err);
        notice({
          title: "Couldn’t copy automatically",
          message: publicUrl,
          variant: "info",
        });
      });
  };

  const handleToggleArchive = async () => {
    // Retiring hides a piece from the public site, so confirm it; restoring is
    // non-destructive and applies immediately.
    if (!piece.archived) {
      const confirmed = await confirm({
        title: "Retire Piece",
        message: `Retire "${piece.title}"? It will be hidden from your public portfolio but stays in your archive.`,
        confirmText: "Retire",
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
          <View style={styles.topRight}>
            <SaveButton
              variant="float"
              saved={isPieceSaved(piece.id)}
              onPress={() => togglePieceSaved(piece.id)}
              accessibilityLabel="Save this piece to your inspiration"
            />
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

            {/* Opt-in glaze details — these keys exist on publicView ONLY when
                the artist enabled "Show glaze details" for this piece, so an
                opted-out piece renders nothing here. */}
            {publicView.glaze || publicView.cone || publicView.firingEnvironment ? (
              <View style={[styles.infoCard, { borderColor: "rgba(120, 110, 100, 0.14)", marginTop: 22 }]}>
                <InfoRow label="Glaze" value={publicView.glaze ?? ""} accent={colors.emerald} />
                <InfoRow label="Cone" value={publicView.cone ?? ""} accent={colors.primary} />
                <InfoRow
                  label="Firing Environment"
                  value={publicView.firingEnvironment ?? ""}
                  accent={colors.cobalt}
                />
              </View>
            ) : null}

            {/* Opt-in studio notes — present only when "Show studio notes" is on. */}
            {publicView.notes ? (
              <View style={[styles.notesSection, { marginTop: 26 }]}>
                <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>Studio Notes</Text>
                <Text style={[styles.notesText, { color: colors.foreground }]}>{publicView.notes}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <ShareSheet
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          content={buildShareContent(publicView, pieceShareUrl(profile.name, piece.id), profile.name)}
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
          {isPublic ? (
            <Pressable
              style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
              onPress={() => setShareVisible(true)}
            >
              <Feather name="share-2" size={18} color="#8A7B6C" />
            </Pressable>
          ) : null}
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
                  Retired
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
                        ? "Hand-picked for your best-of portfolio"
                        : `Choose up to ${MAX_PORTFOLIO_ITEMS} best pieces`}
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

          {isPublic && !piece.archived ? (
            <AdvancedPublicVisibility
              showGlazeDetails={piece.showGlazeDetails}
              showStudioNotes={piece.showStudioNotes}
              onToggleGlaze={() =>
                updatePiece(piece.id, { showGlazeDetails: !piece.showGlazeDetails })
              }
              onToggleNotes={() =>
                updatePiece(piece.id, { showStudioNotes: !piece.showStudioNotes })
              }
            />
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

              {isPublic ? (
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
                  onPress={handleOpenShare}
                >
                  <Feather name="share-2" size={14} color={colors.background} />
                  <Text style={[styles.actionBtnText, { color: colors.background }]}>
                    Share
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Public link — the exact URL Share / Copy use. Visible and
                copyable only when the piece is public; a quiet hint otherwise. */}
            {isPublic ? (
              <Pressable
                style={({ pressed }) => [
                  styles.publicUrlRow,
                  {
                    backgroundColor: pressed ? colors.secondary : "transparent",
                    borderColor: "rgba(120,110,100,0.16)",
                  },
                ]}
                onPress={handleCopyPublicUrl}
                accessibilityRole="button"
                accessibilityLabel="Copy public link"
              >
                <Feather name="link" size={13} color={colors.mutedForeground} />
                <Text
                  style={[styles.publicUrlText, { color: colors.foreground }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {publicUrl.replace(/^https?:\/\//, "")}
                </Text>
                <Feather name="copy" size={13} color={colors.mutedForeground} />
              </Pressable>
            ) : (
              <Text
                style={[styles.publicUrlHint, { color: colors.mutedForeground }]}
              >
                Make public to share.
              </Text>
            )}

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
                {piece.archived ? "Restore piece" : "Retire piece"}
              </Text>
            </Pressable>

            {fromCollectionId ? (
              <Pressable
                style={({ pressed }) => [
                  styles.archiveLink,
                  { opacity: pressed ? 0.5 : 0.85 },
                ]}
                onPress={handleRemoveFromCollection}
              >
                <Feather name="minus-circle" size={13} color={colors.mutedForeground} />
                <Text style={[styles.archiveLinkText, { color: colors.mutedForeground }]}>
                  Remove from this Collection
                </Text>
              </Pressable>
            ) : fromPortfolio && piece.featuredInPortfolio ? (
              <Pressable
                style={({ pressed }) => [
                  styles.archiveLink,
                  { opacity: pressed ? 0.5 : 0.85 },
                ]}
                onPress={handleRemoveFromPortfolio}
              >
                <Feather name="star" size={13} color={colors.mutedForeground} />
                <Text style={[styles.archiveLinkText, { color: colors.mutedForeground }]}>
                  Remove from Portfolio
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.deleteLink,
                { opacity: pressed ? 0.5 : 0.7 },
              ]}
              onPress={handleDelete}
            >
              <Text style={[styles.deleteLinkText, { color: colors.mutedForeground }]}>
                Delete Piece
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

      {/* Owner share — only mounts for a public piece, so a private piece never
          even constructs a share payload or link (defence in depth beyond the
          gated buttons above). */}
      {isPublic ? (
        <ShareSheet
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          content={buildShareContent(piece, pieceShareUrl(profile.name, piece.id), profile.name)}
        />
      ) : null}

      <ImageViewer
        visible={viewerVisible}
        items={viewerItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
        onRequestShare={ensureShareable}
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
  publicUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 10,
  },
  publicUrlText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
  },
  publicUrlHint: {
    fontSize: 12.5,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    paddingVertical: 2,
  },
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
