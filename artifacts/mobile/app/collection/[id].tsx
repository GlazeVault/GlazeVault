import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { persistPieceImage } from "@/constants/imageStorage";
import { Visibility, isCollectionFeatured } from "@/constants/privacy";
import { resolveImageSource } from "@/constants/seedImages";
import { useCollections } from "@/context/CollectionsContext";
import { PotteryPiece, usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import { uploadImage } from "@/services/dataService";
import { isSupabaseConfigured } from "@/services/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TileColors = ReturnType<typeof useColors>;

/**
 * Wraps content in a quiet rise-and-fade as it enters. Because FlatList mounts
 * rows lazily as they scroll into view, this reads as a gentle fade-in on
 * scroll without tracking scroll offsets manually.
 */
function FadeInView({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    const delay = Math.min(index, 5) * 70;
    opacity.value = withDelay(delay, withTiming(1, { duration: 520 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 560 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type TileVariant = "feature" | "spread" | "pair";

const TILE_ASPECT: Record<TileVariant, number> = {
  feature: 4 / 5,
  spread: 3 / 2,
  pair: 3 / 4,
};

/**
 * A single artwork tile for the editorial gallery. Tapping opens the piece
 * detail (which hosts the fullscreen viewer), so the viewer is preserved.
 */
function GalleryTile({
  piece,
  variant,
  fromCollectionId,
  colors,
}: {
  piece: PotteryPiece;
  variant: TileVariant;
  fromCollectionId: string;
  colors: TileColors;
}) {
  const { toggleFavorite } = usePottery();
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isPrivate = piece.visibility === "private";
  const isFeature = variant === "feature" || variant === "spread";

  // Keep the gallery quiet: show just the essentials (material · cone). The
  // full firing details live on the piece detail page.
  const meta = [piece.clay, piece.cone].filter(Boolean).join("  ·  ");

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(piece.id);
  };

  return (
    <AnimatedPressable
      style={pressStyle}
      onPressIn={() => {
        scale.value = withTiming(0.975, { duration: 160 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 240 });
      }}
      onPress={() =>
        router.push({
          pathname: "/piece/[id]",
          params: { id: piece.id, from: fromCollectionId },
        })
      }
    >
      <View style={[styles.tileImage, { aspectRatio: TILE_ASPECT[variant] }]}>
        <Image
          source={resolveImageSource(piece.imageUri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={320}
          cachePolicy="memory-disk"
          recyclingKey={piece.id}
        />
        <View style={styles.tileBadge}>
          <Feather
            name={isPrivate ? "lock" : "globe"}
            size={10}
            color={isPrivate ? "#8A7B6C" : colors.emerald}
          />
        </View>
        <Pressable style={styles.tileFav} onPress={handleFavorite} hitSlop={10}>
          <Feather
            name="heart"
            size={14}
            color={piece.isFavorite ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      </View>
      <View style={styles.tileInfo}>
        <Text
          style={[
            isFeature ? styles.tileTitleLg : styles.tileTitleSm,
            { color: colors.foreground },
          ]}
          numberOfLines={2}
        >
          {piece.title}
        </Text>
        {meta ? (
          <Text
            style={[styles.tileMeta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

type GalleryRow =
  | { key: string; kind: "feature" | "spread"; piece: PotteryPiece }
  | {
      key: string;
      kind: "pair";
      left: PotteryPiece;
      right: PotteryPiece;
      raise: "left" | "right";
    };

/**
 * Arranges pieces into a calm, asymmetric exhibition rhythm: a tall feature,
 * a staggered pair, a wide spread, then a pair again. Pairs alternate which
 * side is raised so the eye never settles into a grid.
 */
function buildGalleryRows(pieces: PotteryPiece[]): GalleryRow[] {
  const pattern: TileVariant[] = ["feature", "pair", "spread", "pair"];
  const rows: GalleryRow[] = [];
  let i = 0;
  let p = 0;
  let pairCount = 0;

  while (i < pieces.length) {
    const kind = pattern[p % pattern.length];
    if (kind === "pair") {
      if (i + 1 < pieces.length) {
        rows.push({
          key: pieces[i].id,
          kind: "pair",
          left: pieces[i],
          right: pieces[i + 1],
          raise: pairCount % 2 === 0 ? "right" : "left",
        });
        pairCount += 1;
        i += 2;
      } else {
        rows.push({ key: pieces[i].id, kind: "feature", piece: pieces[i] });
        i += 1;
      }
    } else {
      rows.push({ key: pieces[i].id, kind, piece: pieces[i] });
      i += 1;
    }
    p += 1;
  }

  return rows;
}

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getCollection, updateCollection, deleteCollection } = useCollections();
  const { pieces, removePieceFromCollection } = usePottery();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const collection = getCollection(id);
  const collectionPieces = pieces.filter((p) => p.collectionId === id);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(collection?.title ?? "");
  const [intro, setIntro] = useState(collection?.intro ?? "");
  const [visibility, setVisibility] = useState<Visibility>(collection?.visibility ?? "private");
  const [featuredOnSite, setFeaturedOnSite] = useState<boolean>(
    collection?.featuredOnSite ?? false
  );
  const [coverImageUri, setCoverImageUri] = useState(collection?.coverImageUri ?? "");
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickingCover = useRef(false);

  const pickCover = async () => {
    if (pickingCover.current) return;
    pickingCover.current = true;
    try {
      console.log("Choose cover upload pressed");
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow access to your photo library.");
          return;
        }
      }
      // On web the picker's `uri` is a blob: URL that can't be fetched inside the
      // sandboxed preview iframe, so we request base64 and build a permanent
      // data: URI directly — the same pattern that works for the profile avatar.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.85,
        base64: Platform.OS === "web",
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }
      const asset = result.assets[0];
      const selectedUri = asset.uri;
      console.log("Selected cover URI:", selectedUri.slice(0, 64));

      // Turn the picked image into a stable URI:
      //  - web   → base64 data: URI (survives reload, no blob fetch)
      //  - native → copy into documentDirectory and store a relative path
      let stored: string;
      if (Platform.OS === "web") {
        if (!asset.base64) throw new Error("Picker returned no base64 data on web");
        stored = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
      } else {
        stored = await persistPieceImage(selectedUri);
      }

      // Upload to Supabase Storage so the cover survives across devices and app
      // restarts. Falls back to the local stable URI if Supabase isn't set up.
      let uploadedUrl = stored;
      if (isSupabaseConfigured) {
        uploadedUrl = (await uploadImage(stored, "collections")) ?? stored;
      }
      console.log("Uploaded cover URL:", uploadedUrl.slice(0, 80));

      // Show it immediately and close the sheet.
      setCoverImageUri(uploadedUrl);
      setCoverPickerOpen(false);

      // Persist right away (Supabase + local cache) so it survives a restart
      // even if the user never presses Save.
      console.log("Saving collection cover:", collection?.id, uploadedUrl.slice(0, 80));
      await updateCollection(collection!.id, { coverImageUri: uploadedUrl });
    } catch (e) {
      console.warn("Failed to upload collection cover", e);
      Alert.alert("Cover image could not be saved. Please try again.");
    } finally {
      pickingCover.current = false;
    }
  };

  if (!collection) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }}>
          Collection not found
        </Text>
      </View>
    );
  }

  console.log("Loaded collection cover:", collection.coverImageUri);

  // Display fallback order: explicit cover -> first piece in this collection
  // that actually has a photo (skipping imageless pieces so the banner never
  // falls back to a blank/placeholder while later pieces do have images).
  const firstPieceImage = collectionPieces.find((p) => p.imageUri)?.imageUri ?? "";
  const headerCover = (collection.coverImageUri || firstPieceImage) || "";
  // The cover image acts as a banner/intro. While editing only the explicit
  // selection is shown (so Remove visibly clears it); otherwise the resolved
  // fallback is used. If a piece's image is the cover, skip it in the grid so
  // the same image never appears twice.
  const activeCover = isEditing ? coverImageUri || "" : headerCover;
  const gridPieces = activeCover
    ? collectionPieces.filter((p) => p.imageUri !== activeCover)
    : collectionPieces;
  const galleryRows = buildGalleryRows(gridPieces);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this collection a name.");
      return;
    }
    setSaving(true);
    await updateCollection(id, {
      title: title.trim(),
      intro: intro.trim(),
      visibility,
      // A private collection can never be featured.
      featuredOnSite: visibility === "public" ? featuredOnSite : false,
      coverImageUri: coverImageUri || undefined,
    });
    setSaving(false);
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Collection",
      `Remove "${collection.title}"? Pieces in this collection will not be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const p of collectionPieces) {
              await removePieceFromCollection(id, p.id);
            }
            await deleteCollection(id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={galleryRows}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad + 64, paddingBottom: insets.bottom + 40 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            {isEditing ? (
              <View style={styles.coverSection}>
                <Text style={[styles.coverSectionLabel, { color: colors.mutedForeground }]}>
                  Collection Cover
                </Text>
                {coverImageUri ? (
                  <View style={styles.coverWrap}>
                    <Image
                      source={resolveImageSource(coverImageUri)}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={220}
                      cachePolicy="memory-disk"
                      recyclingKey={coverImageUri}
                    />
                    <View style={styles.coverActions}>
                      <Pressable
                        style={[styles.coverBtn, { backgroundColor: "rgba(253,250,245,0.92)" }]}
                        onPress={() => setCoverPickerOpen(true)}
                      >
                        <Feather name="refresh-cw" size={13} color="#8A7B6C" />
                        <Text style={[styles.coverBtnText, { color: "#8A7B6C" }]}>Replace</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.coverBtn, { backgroundColor: "rgba(253,250,245,0.92)" }]}
                        onPress={() => setCoverImageUri("")}
                      >
                        <Feather name="trash-2" size={13} color={colors.destructive} />
                        <Text style={[styles.coverBtnText, { color: colors.destructive }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      styles.coverChooseBtn,
                      { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.22)" },
                    ]}
                    onPress={() => setCoverPickerOpen(true)}
                  >
                    <Feather name="image" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.coverChooseBtnText, { color: colors.foreground }]}>
                      Choose Cover Image
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : headerCover ? (
              <View style={styles.coverWrap}>
                <Image
                  source={resolveImageSource(headerCover)}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  recyclingKey={headerCover}
                />
              </View>
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                <Feather name="layers" size={26} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              </View>
            )}
            <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
            {isEditing ? (
              <TextInput
                style={[styles.titleInput, { color: colors.foreground, borderBottomColor: "rgba(120,110,100,0.2)" }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Collection title"
                placeholderTextColor={colors.mutedForeground}
              />
            ) : (
              <Text style={[styles.title, { color: colors.foreground }]}>{collection.title}</Text>
            )}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {isEditing ? (
              <TextInput
                style={[styles.introInput, { color: colors.foreground }]}
                value={intro}
                onChangeText={setIntro}
                placeholder="A short description of this collection…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
              />
            ) : collection.intro ? (
              <Text style={[styles.intro, { color: colors.mutedForeground }]}>{collection.intro}</Text>
            ) : null}
            <Text style={[styles.count, { color: colors.mutedForeground, marginTop: 12 }]}>
              {collectionPieces.length === 0
                ? "No pieces in this collection"
                : `${collectionPieces.length} ${collectionPieces.length === 1 ? "piece" : "pieces"}`}
            </Text>
            {isEditing ? (
              <>
              <Pressable
                style={[
                  styles.visibilityRow,
                  {
                    backgroundColor:
                      visibility === "public" ? "rgba(107,139,122,0.1)" : colors.secondary,
                    borderColor:
                      visibility === "public"
                        ? "rgba(107,139,122,0.3)"
                        : "rgba(120,110,100,0.16)",
                  },
                ]}
                onPress={() =>
                  setVisibility((v) => {
                    const next = v === "public" ? "private" : "public";
                    if (next === "private") setFeaturedOnSite(false);
                    return next;
                  })
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: visibility === "public" }}
                accessibilityLabel="Collection visibility"
              >
                <Feather
                  name={visibility === "public" ? "globe" : "lock"}
                  size={14}
                  color={visibility === "public" ? colors.emerald : colors.mutedForeground}
                />
                <View style={styles.visibilityLabels}>
                  <Text
                    style={[
                      styles.visibilityTitle,
                      {
                        color: visibility === "public" ? colors.emerald : colors.foreground,
                      },
                    ]}
                  >
                    {visibility === "public" ? "Public" : "Private"}
                  </Text>
                  <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                    {visibility === "public"
                      ? "Public pieces in here are visible to others"
                      : "Hidden from everyone but you"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.visToggle,
                    {
                      backgroundColor:
                        visibility === "public" ? colors.emerald : "rgba(120,110,100,0.18)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.visToggleThumb,
                      { transform: [{ translateX: visibility === "public" ? 18 : 2 }] },
                    ]}
                  />
                </View>
              </Pressable>
              {visibility === "public" ? (
                <Pressable
                  style={[
                    styles.visibilityRow,
                    {
                      marginTop: 10,
                      backgroundColor: featuredOnSite
                        ? "rgba(107,127,163,0.1)"
                        : colors.secondary,
                      borderColor: featuredOnSite
                        ? "rgba(107,127,163,0.3)"
                        : "rgba(120,110,100,0.16)",
                    },
                  ]}
                  onPress={() => setFeaturedOnSite((f) => !f)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: featuredOnSite }}
                  accessibilityLabel="Feature on public site"
                >
                  <Feather
                    name="star"
                    size={14}
                    color={featuredOnSite ? colors.cobalt : colors.mutedForeground}
                  />
                  <View style={styles.visibilityLabels}>
                    <Text
                      style={[
                        styles.visibilityTitle,
                        { color: featuredOnSite ? colors.cobalt : colors.foreground },
                      ]}
                    >
                      Feature on Public Site
                    </Text>
                    <Text style={[styles.visibilitySub, { color: colors.mutedForeground }]}>
                      {featuredOnSite
                        ? "Highlighted on your public site"
                        : "Not shown on your public site"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.visToggle,
                      {
                        backgroundColor: featuredOnSite
                          ? colors.cobalt
                          : "rgba(120,110,100,0.18)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.visToggleThumb,
                        { transform: [{ translateX: featuredOnSite ? 18 : 2 }] },
                      ]}
                    />
                  </View>
                </Pressable>
              ) : null}
              </>
            ) : (
              <View style={styles.viewBadgeRow}>
                <View style={styles.viewBadge}>
                  <Feather
                    name={collection.visibility === "public" ? "globe" : "lock"}
                    size={10}
                    color="#9C8E7E"
                  />
                  <Text style={[styles.viewBadgeText, { color: "#9C8E7E" }]}>
                    {collection.visibility === "public" ? "Public" : "Private"}
                  </Text>
                </View>
                {isCollectionFeatured(collection) ? (
                  <>
                    <Text style={styles.viewBadgeDot}>·</Text>
                    <View style={styles.viewBadge}>
                      <Feather name="star" size={10} color="#9C8E7E" />
                      <Text style={[styles.viewBadgeText, { color: "#9C8E7E" }]}>Featured</Text>
                    </View>
                  </>
                ) : null}
              </View>
            )}
            {isEditing ? (
              <View style={styles.editActions}>
                <Pressable
                  style={[styles.deleteBtn, { borderColor: "rgba(184,92,58,0.3)" }]}
                  onPress={handleDelete}
                >
                  <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete</Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsEditing(false)}
                  style={[styles.actionBtn, { borderColor: "rgba(120,110,100,0.2)" }]}
                >
                  <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.actionBtn, styles.saveBtn, { backgroundColor: colors.cobalt }]}
                >
                  <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
                    {saving ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.dividerFull, { backgroundColor: "rgba(120,110,100,0.1)" }]} />
            )}
          </View>
        }
        ListEmptyComponent={
          collectionPieces.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
                <Feather name="layers" size={22} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No pieces yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Edit any piece and assign it to this collection
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <FadeInView index={index} style={styles.galleryRow}>
            {item.kind === "pair" ? (
              <View style={styles.pairRow}>
                <View style={[styles.pairCol, item.raise === "left" && styles.pairRaised]}>
                  <GalleryTile
                    piece={item.left}
                    variant="pair"
                    fromCollectionId={id}
                    colors={colors}
                  />
                </View>
                <View style={[styles.pairCol, item.raise === "right" && styles.pairRaised]}>
                  <GalleryTile
                    piece={item.right}
                    variant="pair"
                    fromCollectionId={id}
                    colors={colors}
                  />
                </View>
              </View>
            ) : (
              <GalleryTile
                piece={item.piece}
                variant={item.kind}
                fromCollectionId={id}
                colors={colors}
              />
            )}
          </FadeInView>
        )}
      />

      {/* Floating back + edit buttons */}
      <View style={[styles.topBar, { top: topPad + 10 }]}>
        <Pressable
          style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color="#8A7B6C" />
        </Pressable>
        {!isEditing && (
          <Pressable
            style={[styles.floatBtn, { backgroundColor: "rgba(253,250,245,0.9)" }]}
            onPress={() => {
              setTitle(collection.title);
              setIntro(collection.intro);
              setVisibility(collection.visibility);
              setFeaturedOnSite(collection.featuredOnSite);
              setCoverImageUri(collection.coverImageUri ?? "");
              setIsEditing(true);
            }}
          >
            <Feather name="edit-2" size={16} color="#8A7B6C" />
          </Pressable>
        )}
      </View>

      <Modal
        visible={coverPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCoverPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCoverPickerOpen(false)}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Choose Cover Image
          </Text>
          <Pressable
            style={[styles.uploadBtn, { borderColor: "rgba(120,110,100,0.22)", backgroundColor: colors.secondary }]}
            onPress={pickCover}
          >
            <Feather name="upload" size={15} color={colors.foreground} />
            <Text style={[styles.uploadBtnText, { color: colors.foreground }]}>
              Upload from library
            </Text>
          </Pressable>
          {collectionPieces.length > 0 ? (
            <>
              <Text style={[styles.modalSubLabel, { color: colors.mutedForeground }]}>
                From this collection
              </Text>
              <FlatList
                data={collectionPieces}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const selected = item.imageUri === coverImageUri;
                  return (
                    <Pressable
                      style={[
                        styles.gridItem,
                        { backgroundColor: colors.secondary },
                        selected && { borderColor: colors.cobalt, borderWidth: 2 },
                      ]}
                      onPress={() => {
                        setCoverImageUri(item.imageUri);
                        setCoverPickerOpen(false);
                      }}
                    >
                      <Image
                        source={resolveImageSource(item.imageUri)}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={160}
                        cachePolicy="memory-disk"
                        recyclingKey={item.imageUri}
                      />
                      {selected ? (
                        <View style={[styles.gridCheck, { backgroundColor: colors.cobalt }]}>
                          <Feather name="check" size={13} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            </>
          ) : (
            <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>
              Add pieces to this collection to choose a cover from them.
            </Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 28 },
  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
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
  header: { marginBottom: 32 },
  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  },
  coverPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  coverActions: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    gap: 8,
  },
  coverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  coverBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  coverPicker: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    aspectRatio: 16 / 10,
    borderRadius: 14,
    borderWidth: 0.75,
    borderStyle: "dashed",
    marginBottom: 20,
  },
  coverPickerText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.2 },
  coverPickerHint: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  coverSection: { marginBottom: 20 },
  coverSectionLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  coverChooseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 0.75,
  },
  coverChooseBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(40,34,28,0.32)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0.75,
    marginBottom: 20,
  },
  uploadBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  modalSubLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  gridRow: { gap: 10 },
  gridContent: { gap: 10, paddingBottom: 8 },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  gridCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEmpty: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
    lineHeight: 20,
    paddingVertical: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.4,
    lineHeight: 42,
    marginBottom: 20,
  },
  titleInput: {
    fontSize: 30,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    paddingVertical: 6,
    borderBottomWidth: 0.75,
    marginBottom: 20,
  },
  divider: { height: 1, width: 40, marginBottom: 16 },
  dividerFull: {
    height: 1,
    width: 28,
    alignSelf: "center",
    marginTop: 44,
    marginBottom: 8,
  },
  intro: {
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    lineHeight: 27,
    letterSpacing: 0.2,
    maxWidth: 330,
  },
  introInput: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
    minHeight: 60,
  },
  count: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.75,
    marginRight: "auto",
  },
  deleteBtnText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.75,
  },
  saveBtn: { borderWidth: 0 },
  actionBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium" },
  empty: { alignItems: "center", paddingTop: 32, gap: 12 },
  emptyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0.75,
    marginTop: 18,
  },
  visibilityLabels: { flex: 1, gap: 2 },
  visibilityTitle: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.2 },
  visibilitySub: { fontSize: 11, fontFamily: "Poppins_300Light", letterSpacing: 0.2 },
  visToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  visToggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
  galleryRow: { marginBottom: 40 },
  pairRow: { flexDirection: "row", gap: 16 },
  pairCol: { flex: 1 },
  pairRaised: { marginTop: 34 },
  tileImage: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(120,110,100,0.06)",
  },
  tileBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.86)",
  },
  tileFav: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.82)",
  },
  tileInfo: { paddingTop: 12, paddingHorizontal: 2, gap: 5 },
  tileTitleLg: {
    fontSize: 21,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  tileTitleSm: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  tileMeta: {
    fontSize: 11,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.4,
    opacity: 0.6,
  },
  viewBadgeRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
  viewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  viewBadgeDot: { fontSize: 11, color: "#C2B6A6" },
  viewBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
