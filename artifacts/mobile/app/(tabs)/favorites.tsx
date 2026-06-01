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
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad + 32, paddingBottom: insets.bottom + 120 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.emerald }]}>Selected</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>Favourites</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {favorites.length === 0
                ? "No pieces saved yet"
                : `${favorites.length} ${favorites.length === 1 ? "piece" : "pieces"}`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyDot, { backgroundColor: colors.emerald, opacity: 0.18 }]} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nothing saved yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap the heart on any piece to add it here
            </Text>
          </View>
        }
        renderItem={({ item }) => <PotteryCard piece={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 28 },
  header: { marginBottom: 40 },
  eyebrow: { fontSize: 11, fontFamily: "Poppins_500Medium", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 },
  heading: { fontSize: 38, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.5, lineHeight: 46, marginBottom: 20 },
  divider: { height: 1, width: 40, marginBottom: 12 },
  count: { fontSize: 12, fontFamily: "Poppins_400Regular", letterSpacing: 0.3 },
  empty: { alignItems: "center", paddingTop: 48, gap: 14 },
  emptyDot: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontFamily: "PlayfairDisplay_400Regular", letterSpacing: 0.3, textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Poppins_300Light", textAlign: "center", lineHeight: 22, maxWidth: 240 },
});
