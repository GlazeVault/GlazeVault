import { Feather } from "@expo/vector-icons";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PotteryCard } from "@/components/PotteryCard";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

export default function FavoritesScreen() {
  const colors = useColors();
  const { pieces } = usePottery();
  const insets = useSafeAreaInsets();

  const favorites = pieces.filter((p) => p.isFavorite);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Favorites</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          {favorites.length} {favorites.length === 1 ? "piece" : "pieces"}
        </Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.secondary, borderRadius: 40 },
            ]}
          >
            <Feather name="heart" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No favorites yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Tap the heart on any piece to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
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
  list: { paddingHorizontal: 12 },
  row: { gap: 10, paddingHorizontal: 8, marginBottom: 10 },
  cardWrap: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
