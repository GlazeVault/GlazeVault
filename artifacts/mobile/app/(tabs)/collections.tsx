import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { useCollections } from "@/context/CollectionsContext";
import { usePottery } from "@/context/PotteryContext";
import { resolveImageSource } from "@/constants/seedImages";
import { useColors } from "@/hooks/useColors";

export default function CollectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { collections } = useCollections();
  const { pieces } = usePottery();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? collections.filter((c) =>
        [c.title, c.intro]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(trimmed))
      )
    : collections;

  const getPiecesForCollection = (collectionId: string) =>
    pieces.filter((p) => p.collectionId === collectionId);

  const getCoverForCollection = (collection: { id: string; coverImageUri?: string }) => {
    if (collection.coverImageUri) return collection.coverImageUri;
    const collectionPieces = getPiecesForCollection(collection.id);
    return collectionPieces[0]?.imageUri ?? null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad + 32, paddingBottom: insets.bottom + 120 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
                <Text style={[styles.heading, { color: colors.foreground }]}>Collections</Text>
              </View>
              <Pressable
                style={[styles.newBtn, { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.14)" }]}
                onPress={() => router.push("/collection/new")}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {collections.length === 0
                ? "No collections yet"
                : trimmed
                  ? `${filtered.length} of ${collections.length} ${collections.length === 1 ? "collection" : "collections"}`
                  : `${collections.length} ${collections.length === 1 ? "collection" : "collections"}`}
            </Text>
            {collections.length > 0 ? (
              <View style={styles.searchWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search collections"
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          trimmed ? (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsTitle, { color: colors.foreground }]}>
                No matches
              </Text>
              <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                No collections match “{query.trim()}”
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyCircle, { backgroundColor: colors.secondary }]}>
                <Feather name="layers" size={24} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No collections yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Group your works into curated series, themes, or firing sessions
              </Text>
              <Pressable
                style={[styles.emptyBtn, { borderColor: "rgba(120,110,100,0.2)" }]}
                onPress={() => router.push("/collection/new")}
              >
                <Text style={[styles.emptyBtnText, { color: colors.foreground }]}>
                  Create first collection
                </Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const cover = getCoverForCollection(item);
          const count = getPiecesForCollection(item.id).length;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => router.push(`/collection/${item.id}`)}
            >
              <View
                style={[
                  styles.cardImage,
                  { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.12)" },
                ]}
              >
                {cover ? (
                  <Image
                    source={resolveImageSource(cover)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="memory-disk"
                    recyclingKey={cover}
                  />
                ) : (
                  <View style={styles.cardPlaceholder}>
                    <Feather name="layers" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.intro ? (
                  <Text style={[styles.cardIntro, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {item.intro}
                  </Text>
                ) : null}
                <Text style={[styles.cardCount, { color: colors.mutedForeground }]}>
                  {count === 0 ? "No pieces" : `${count} ${count === 1 ? "piece" : "pieces"}`}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 28 },
  header: { marginBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heading: {
    fontSize: 38,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.5,
    lineHeight: 46,
  },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.75,
    marginBottom: 4,
  },
  divider: { height: 1, width: 40, marginBottom: 12 },
  count: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  searchWrap: { marginTop: 24 },
  noResults: { alignItems: "center", paddingTop: 32, gap: 8 },
  noResultsTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  noResultsText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
  empty: { alignItems: "center", paddingTop: 40, gap: 14 },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 0.75,
    borderRadius: 24,
  },
  emptyBtnText: { fontSize: 13, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  card: { marginBottom: 40 },
  cardImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 0.75,
  },
  cardPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { gap: 4 },
  cardTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  cardIntro: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    lineHeight: 20,
  },
  cardCount: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
    marginTop: 4,
    opacity: 0.7,
  },
});
