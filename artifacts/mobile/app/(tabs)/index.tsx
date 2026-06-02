import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PotteryCard } from "@/components/PotteryCard";
import { SearchBar } from "@/components/SearchBar";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyDot, { backgroundColor: colors.cobalt, opacity: 0.18 }]} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Your archive awaits
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Begin by recording your first ceramic piece
      </Text>
    </View>
  );
}

export default function GalleryScreen() {
  const colors = useColors();
  const { pieces } = usePottery();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? pieces.filter((p) =>
        [p.title, p.clay, p.glaze, p.firing, p.cone, p.dimensions, p.notes]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(trimmed))
      )
    : pieces;

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
            <Text style={[styles.eyebrow, { color: colors.cobalt }]}>
              GlazeVault
            </Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Archive
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {pieces.length === 0
                ? "No pieces recorded"
                : trimmed
                  ? `${filtered.length} of ${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"}`
                  : `${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"}`}
            </Text>
            {pieces.length > 0 ? (
              <View style={styles.searchWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search pieces"
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
                No pieces match “{query.trim()}”
              </Text>
            </View>
          ) : (
            <EmptyState colors={colors} />
          )
        }
        renderItem={({ item }) => <PotteryCard piece={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 28 },
  header: {
    marginBottom: 40,
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
    marginBottom: 20,
  },
  divider: {
    height: 1,
    width: 40,
    marginBottom: 12,
  },
  count: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
  },
  searchWrap: {
    marginTop: 24,
  },
  noResults: {
    alignItems: "center",
    paddingTop: 32,
    gap: 8,
  },
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
  empty: {
    alignItems: "center",
    paddingTop: 48,
    gap: 14,
  },
  emptyDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    maxWidth: 240,
  },
});
