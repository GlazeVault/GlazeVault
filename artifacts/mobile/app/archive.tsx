import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PotteryCard } from "@/components/PotteryCard";
import { SearchBar } from "@/components/SearchBar";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";
import {
  buildOrientationRows,
  isLandscapeRatio,
  useImageOrientations,
} from "@/hooks/useImageOrientations";

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

/**
 * The complete studio record — the full archive grid — reached one step in from
 * the foyer (the Archive doorway). This was the original landing grid; it keeps
 * its orientation-aware no-crop layout and search, now behind a quiet back step
 * so the grid is never the first impression.
 */
export default function ArchiveScreen() {
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

  // Measure each cover's natural orientation so landscape pieces break out into
  // their own full-width "catalog plate" row while portrait/square stay paired
  // two-up. Unmeasured pieces default to portrait until their ratio resolves.
  const orientations = useImageOrientations(filtered.map((p) => p.imageUri));
  const rows = buildOrientationRows(
    filtered,
    (p) => p.id,
    (p) => isLandscapeRatio(orientations[p.imageUri]),
  );

  const header = (
    <View style={styles.headerInset}>
      <Pressable
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel="Back to foyer"
        hitSlop={10}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      >
        <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
        <Text style={[styles.backLabel, { color: colors.mutedForeground }]}>Foyer</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.cobalt }]}>GlazeVault</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>Archive</Text>
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
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Orientation-aware grid. Portrait/square pieces pair two-up; landscape
          pieces break out into their own full-width row so wide work reads like
          a catalog plate. Rows are pre-built so FlashList still virtualizes a
          single column while supporting the full-width span. */}
      <FlashList
        data={rows}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: 15,
          paddingTop: topPad + 20,
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={header}
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
        renderItem={({ item }) =>
          item.kind === "full" ? (
            // Landscape pieces span the full grid width like a wide catalog
            // plate, shown at their true ratio with no crop.
            <View style={styles.cell}>
              <PotteryCard
                piece={item.item}
                preserveAspectRatio
                initialAspectRatio={orientations[item.item.imageUri]}
              />
            </View>
          ) : (
            <View style={styles.pairRow}>
              <View style={styles.pairCell}>
                <PotteryCard
                  piece={item.left}
                  preserveAspectRatio
                  initialAspectRatio={orientations[item.left.imageUri]}
                />
              </View>
              <View style={styles.pairCell}>
                {item.right ? (
                  <PotteryCard
                    piece={item.right}
                    preserveAspectRatio
                    initialAspectRatio={orientations[item.right.imageUri]}
                  />
                ) : null}
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Each tile is inset by half the gutter so two columns sit 18px apart and the
  // outer margins land at 24px (15 content padding + 9 cell padding). A full-width
  // landscape cell uses the same inset so it lines up flush with the columns.
  cell: {
    paddingHorizontal: 9,
  },
  pairRow: {
    flexDirection: "row",
  },
  pairCell: {
    flex: 1,
    paddingHorizontal: 9,
  },
  headerInset: {
    paddingHorizontal: 9,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginLeft: -4,
  },
  backLabel: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.3,
    marginLeft: 2,
  },
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
