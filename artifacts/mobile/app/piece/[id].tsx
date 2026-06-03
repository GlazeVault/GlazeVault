import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageViewer, type ViewerItem } from "@/components/ImageViewer";
import { ShareSheet } from "@/components/ShareSheet";
import { buildPublicMetaLine, isPubliclyVisiblePiece } from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
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
  const params = useLocalSearchParams<{ id: string; from?: string; public?: string }>();
  const { id, from } = params;
  const isPublicView = params.public === "1";
  const { pieces, updatePiece, toggleFavorite, deletePiece, removePieceFromCollection } = usePottery();
  const { collections } = useCollections();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const piece = pieces.find((p) => p.id === id);
  const [shareVisible, setShareVisible] = useState(false);
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false);
  const [updatingCollection, setUpdatingCollection] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  if (!piece) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }}>
          Piece not found
        </Text>
      </View>
    );
  }

  const currentCollection = collections.find((c) => c.id === piece.collectionId) ?? null;

  // Pieces the fullscreen viewer can swipe through. In the public preview we keep
  // it to this piece alone so private work is never reachable; when opened from a
  // collection we stay within that collection; otherwise the whole archive.
  const galleryPieces = (() => {
    if (isPublicView) {
      // Public gallery: swipe only across publicly visible pieces that have a
      // photo, in the same collection. Never reach a private piece (or one in a
      // private collection) — that gate lives in isPubliclyVisiblePiece.
      if (!piece.collectionId) return [piece];
      const siblings = pieces.filter(
        (p) =>
          p.collectionId === piece.collectionId &&
          isPubliclyVisiblePiece(p, collections) &&
          !!p.imageUri,
      );
      return siblings.some((p) => p.id === piece.id) ? siblings : [piece];
    }
    const scoped = from ? pieces.filter((p) => p.collectionId === from) : pieces;
    return scoped.some((p) => p.id === piece.id) ? scoped : [piece];
  })();
  const viewerItems: ViewerItem[] = galleryPieces.map((p) => {
    if (isPublicView) {
      // Captions use the shared buildPublicMetaLine helper, so the fullscreen
      // viewer reads identically to the detail page and the portfolio cards.
      return {
        uri: p.imageUri,
        title: p.title,
        materials: buildPublicMetaLine(p),
      };
    }
    return {
      uri: p.imageUri,
      title: p.title,
      materials: [p.clay, p.glaze].filter(Boolean).join("  ·  "),
    };
  });
  const viewerIndex = Math.max(
    0,
    galleryPieces.findIndex((p) => p.id === piece.id),
  );

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  const handleDelete = () => {
    Alert.alert("Remove Piece", `Remove "${piece.title}" from your archive?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deletePiece(piece.id);
          router.back();
        },
      },
    ]);
  };

  const handleContextRemove = () => {
    if (!from) {
      handleDelete();
      return;
    }
    Alert.alert(
      "Remove from Collection",
      `Remove "${piece.title}" from this collection? It will stay in your archive.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await removePieceFromCollection(from, piece.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleSelectCollection = async (collectionId: string | undefined) => {
    setUpdatingCollection(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updatePiece(piece.id, { collectionId });
    setUpdatingCollection(false);
    setCollectionPickerVisible(false);
  };

  const handleRemoveFromCollection = async () => {
    if (!piece.collectionId) return;
    setUpdatingCollection(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removePieceFromCollection(piece.collectionId, piece.id);
      setCollectionPickerVisible(false);
    } finally {
      setUpdatingCollection(false);
    }
  };

  const formattedDate = new Date(piece.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Public preview: how this piece appears to others. A piece is public iff its
  // collection is in the portfolio AND it has a photo — there are no per-piece
  // publishing controls. isPubliclyVisiblePiece is the single source of truth.
  if (isPublicView) {
    const latestPiece = pieces.find((p) => p.id === id);
    if (!latestPiece || !isPubliclyVisiblePiece(latestPiece, collections)) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <View style={[styles.privateCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="lock" size={20} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
          </View>
          <Text style={[styles.privateTitle, { color: colors.foreground }]}>This piece is private</Text>
          <Text style={[styles.privateText, { color: colors.mutedForeground }]}>
            Add its collection to your portfolio to publish it.
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

    // One quiet, editorial metadata line (clay · dimensions · year) shared with
    // the portfolio cards + fullscreen viewer via buildPublicMetaLine, so the
    // same string renders identically on every public surface.
    const publicMeta = buildPublicMetaLine(piece);

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
          {piece.imageUri ? (
            <Pressable
              onPress={() => setViewerVisible(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`View ${piece.title ? piece.title : "piece"} fullscreen`}
            >
              <Image
                source={resolveImageSource(piece.imageUri)}
                style={styles.heroImage}
                contentFit="cover"
                transition={220}
                cachePolicy="memory-disk"
                recyclingKey={piece.id}
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
            {piece.title ? (
              <Text style={[styles.title, { color: colors.foreground }]}>{piece.title}</Text>
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
          pieceTitle={piece.title || "Untitled piece"}
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
        {/* Hero image — tap to open the fullscreen viewer */}
        <Pressable
          onPress={() => setViewerVisible(true)}
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
          {galleryPieces.length > 1 ? (
            <View style={styles.galleryHint}>
              <Feather name="layers" size={11} color="#FFFFFF" />
              <Text style={styles.galleryHintText}>
                {viewerIndex + 1} / {galleryPieces.length}
              </Text>
            </View>
          ) : null}
        </Pressable>

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

          {/* Publish status — derived from the piece's collection, not a per-piece
              toggle. A piece is public iff its collection is in the portfolio and
              it has a photo. Publishing is managed on the collection. */}
          {(() => {
            const isPublished = isPubliclyVisiblePiece(piece, collections);
            return (
              <View
                style={[
                  styles.visibilityRow,
                  {
                    backgroundColor: isPublished ? "rgba(107,139,122,0.1)" : colors.secondary,
                    borderColor: isPublished ? "rgba(107,139,122,0.3)" : "rgba(120,110,100,0.16)",
                  },
                ]}
                accessibilityRole="text"
                accessibilityLabel={isPublished ? "In your portfolio" : "Not in your portfolio"}
              >
                <Feather
                  name={isPublished ? "globe" : "lock"}
                  size={14}
                  color={isPublished ? colors.emerald : colors.mutedForeground}
                />
                <View style={styles.visibilityLabels}>
                  <Text
                    style={[
                      styles.visibilityTitle,
                      { color: isPublished ? colors.emerald : colors.foreground },
                    ]}
                  >
                    {isPublished ? "In Portfolio" : "Not in Portfolio"}
                  </Text>
                  <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                    {isPublished
                      ? "Shown on your public site"
                      : currentCollection
                        ? !piece.imageUri
                          ? "Add a photo to show it publicly"
                          : "Turn on “Show in Portfolio” for its collection"
                        : "Add it to a collection that’s in your portfolio"}
                  </Text>
                </View>
              </View>
            );
          })()}

          {isPubliclyVisiblePiece(piece, collections) ? (
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
            <View style={[styles.collectionAccent, { backgroundColor: colors.cobalt, opacity: currentCollection ? 1 : 0.35 }]} />
            <Feather
              name="layers"
              size={13}
              color={currentCollection ? colors.cobalt : colors.mutedForeground}
              style={{ opacity: currentCollection ? 1 : 0.7 }}
            />
            <Text
              style={[
                styles.collectionRowText,
                {
                  color: currentCollection ? colors.cobalt : colors.mutedForeground,
                  fontFamily: currentCollection ? "Poppins_400Regular" : "Poppins_300Light",
                },
              ]}
            >
              {currentCollection ? `Collection · ${currentCollection.title}` : "Add to Collection"}
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
                styles.deleteLink,
                { opacity: pressed ? 0.5 : 0.7 },
              ]}
              onPress={handleContextRemove}
            >
              <Text style={[styles.deleteLinkText, { color: colors.mutedForeground }]}>
                {from ? "Remove from collection" : "Remove from archive"}
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
                  Add to Collection
                </Text>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  {collections.length === 0
                    ? "Create a collection first from the Collections tab."
                    : "Choose a collection for this piece."}
                </Text>

                <View style={[styles.sheetDivider, { backgroundColor: "rgba(120,110,100,0.1)" }]} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 320 }}
                  bounces={false}
                >
                  {/* None option */}
                  {piece.collectionId && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.collectionOption,
                        {
                          backgroundColor: pressed ? colors.secondary : "transparent",
                          borderColor: "rgba(120,110,100,0.1)",
                        },
                      ]}
                      onPress={handleRemoveFromCollection}
                      disabled={updatingCollection}
                    >
                      <View style={[styles.optionIconCircle, { backgroundColor: colors.secondary }]}>
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </View>
                      <View style={styles.optionLabels}>
                        <Text style={[styles.optionTitle, { color: colors.mutedForeground }]}>
                          Remove from collection
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Existing collections */}
                  {collections.map((col) => {
                    const isSelected = piece.collectionId === col.id;
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
                        onPress={() => handleSelectCollection(col.id)}
                        disabled={updatingCollection || isSelected}
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
                        {isSelected && (
                          <Feather name="check" size={15} color={colors.cobalt} />
                        )}
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
        pieceTitle={piece.title}
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
  deleteLink: { alignItems: "center", paddingVertical: 4 },
  deleteLinkText: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    textDecorationLine: "underline",
    letterSpacing: 0.2,
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
