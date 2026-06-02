import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PotteryCard } from "@/components/PotteryCard";
import { Visibility, isCollectionFeatured } from "@/constants/privacy";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

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
  const [saving, setSaving] = useState(false);

  if (!collection) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }}>
          Collection not found
        </Text>
      </View>
    );
  }

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
        data={collectionPieces}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad + 64, paddingBottom: insets.bottom + 40 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
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
                <View
                  style={[
                    styles.viewBadge,
                    {
                      backgroundColor:
                        collection.visibility === "public"
                          ? "rgba(107,139,122,0.12)"
                          : colors.secondary,
                    },
                  ]}
                >
                  <Feather
                    name={collection.visibility === "public" ? "globe" : "lock"}
                    size={11}
                    color={
                      collection.visibility === "public" ? colors.emerald : "#8A7B6C"
                    }
                  />
                  <Text
                    style={[
                      styles.viewBadgeText,
                      {
                        color:
                          collection.visibility === "public" ? colors.emerald : "#8A7B6C",
                      },
                    ]}
                  >
                    {collection.visibility === "public" ? "Public" : "Private"}
                  </Text>
                </View>
                {isCollectionFeatured(collection) ? (
                  <View
                    style={[styles.viewBadge, { backgroundColor: "rgba(107,127,163,0.12)" }]}
                  >
                    <Feather name="star" size={11} color={colors.cobalt} />
                    <Text style={[styles.viewBadgeText, { color: colors.cobalt }]}>Featured</Text>
                  </View>
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
        }
        renderItem={({ item }) => (
          <PotteryCard piece={item} fromCollectionId={id} showVisibility />
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
              setIsEditing(true);
            }}
          >
            <Feather name="edit-2" size={16} color="#8A7B6C" />
          </Pressable>
        )}
      </View>
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
  dividerFull: { height: 1, marginTop: 20, marginBottom: 0 },
  intro: {
    fontSize: 14,
    fontFamily: "Poppins_300Light",
    lineHeight: 22,
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
  viewBadgeRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  viewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  viewBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.4,
  },
});
