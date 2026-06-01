import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PotteryCard } from "@/components/PotteryCard";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

export default function GalleryScreen() {
  const colors = useColors();
  const { pieces } = usePottery();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return pieces;
    const q = search.toLowerCase();
    return pieces.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.technique.toLowerCase().includes(q) ||
        p.materials.toLowerCase().includes(q) ||
        p.glaze.toLowerCase().includes(q)
    );
  }, [pieces, search]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            My Gallery
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.secondary,
            borderRadius: colors.radius,
            borderColor: colors.border,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by title, technique..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Feather
            name="x"
            size={16}
            color={colors.mutedForeground}
            onPress={() => setSearch("")}
          />
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          {pieces.length === 0 ? (
            <>
              <Image
                source={require("@/assets/images/placeholder1.png")}
                style={styles.emptyImage}
                contentFit="cover"
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Your gallery awaits
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap + to add your first pottery piece
              </Text>
            </>
          ) : (
            <>
              <Feather name="search" size={40} color={colors.accent} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No results
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try a different search term
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <PotteryCard piece={item} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  heading: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    lineHeight: 34,
  },
  subheading: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    padding: 0,
  },
  list: { paddingHorizontal: 12 },
  row: { gap: 10, paddingHorizontal: 8, marginBottom: 10 },
  cardWrap: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyImage: {
    width: 160,
    height: 200,
    borderRadius: 16,
    marginBottom: 8,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Poppins_600SemiBold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
