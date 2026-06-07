import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export interface OnboardingCollection {
  id: string;
  title: string;
}

interface CollectionOnboardingSheetProps {
  visible: boolean;
  collections: OnboardingCollection[];
  /** The collection currently being filed into (shows an inline spinner). */
  busyId: string | null;
  onSelectCollection: (collectionId: string) => void;
  onCreateNew: () => void;
  onSkip: () => void;
}

/**
 * A calm next-step sheet shown right after a piece is saved to the Archive.
 * Its only purpose is discoverability: it makes Collections visible the moment
 * a first work exists, so the artist understands they can group pieces into a
 * series or exhibition. It never changes the piece's public/private state —
 * filing is pure organization — and it is always trivially skippable.
 */
export function CollectionOnboardingSheet({
  visible,
  collections,
  busyId,
  onSelectCollection,
  onCreateNew,
  onSkip,
}: CollectionOnboardingSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const busy = busyId !== null;
  const hasCollections = collections.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <TouchableWithoutFeedback onPress={busy ? undefined : onSkip}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background,
                  paddingBottom: Math.max(insets.bottom, 24),
                },
              ]}
            >
              <View style={[styles.handle, { backgroundColor: "rgba(120,110,100,0.2)" }]} />

              <View style={styles.eyebrowRow}>
                <View style={[styles.checkDot, { backgroundColor: "rgba(107,139,122,0.16)" }]}>
                  <Feather name="check" size={12} color={colors.emerald} />
                </View>
                <Text style={[styles.eyebrow, { color: colors.emerald }]}>Added to Archive</Text>
              </View>

              <Text style={[styles.title, { color: colors.foreground }]}>Add to Collection</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Organize this work into a collection or series.
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {hasCollections ? (
                <>
                  <ScrollView
                    style={{ maxHeight: 260 }}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                  >
                    {collections.map((col) => {
                      const rowBusy = busyId === col.id;
                      return (
                        <Pressable
                          key={col.id}
                          disabled={busy}
                          style={({ pressed }) => [
                            styles.row,
                            {
                              backgroundColor: pressed ? colors.secondary : "transparent",
                              borderColor: "rgba(120,110,100,0.14)",
                              opacity: busy && !rowBusy ? 0.5 : 1,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Add to ${col.title}`}
                          onPress={() => onSelectCollection(col.id)}
                        >
                          <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
                            <Feather name="layers" size={17} color={colors.foreground} />
                          </View>
                          <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                            {col.title}
                          </Text>
                          {rowBusy ? (
                            <ActivityIndicator size="small" color={colors.mutedForeground} />
                          ) : (
                            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.createRow,
                      {
                        borderColor: "rgba(107,127,163,0.4)",
                        backgroundColor: pressed ? "rgba(107,127,163,0.08)" : "transparent",
                        opacity: busy ? 0.5 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Create new collection"
                    onPress={onCreateNew}
                  >
                    <Feather name="plus" size={17} color={colors.cobalt} />
                    <Text style={[styles.createText, { color: colors.cobalt }]}>Create New Collection</Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Skip for now"
                    onPress={onSkip}
                  >
                    <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for Now</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyBody, { color: colors.foreground }]}>
                    Collections organize works into series or exhibitions.
                  </Text>

                  <Pressable
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: pressed || busy ? 0.88 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Create your first collection"
                    onPress={onCreateNew}
                  >
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
                      Create Your First Collection
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Skip for now"
                    onPress={onSkip}
                  >
                    <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for Now</Text>
                  </Pressable>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(40,36,32,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 22 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  divider: { height: 1, width: 40, marginTop: 18, marginBottom: 18 },
  list: { gap: 10, paddingBottom: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 0.75,
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.2,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  createText: { fontSize: 14, fontFamily: "Poppins_500Medium", letterSpacing: 0.3 },
  emptyBody: {
    fontSize: 15,
    fontFamily: "Poppins_300Light",
    lineHeight: 23,
    marginBottom: 22,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  primaryText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  skipBtn: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  skipText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.4,
  },
});
