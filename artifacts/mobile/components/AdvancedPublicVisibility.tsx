import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * A quiet, collapsible "Advanced public visibility" section shown only when a
 * piece is Public. It holds the two per-piece field-exposure toggles — Show
 * glaze details and Show studio notes — both OFF by default. Turning the main
 * Public switch on never reveals these details; the artist opts each one in.
 *
 * The toggles are intentionally secondary: collapsed by default and visually
 * understated, so the calm default (artwork only) reads first. The flags are
 * enforced at the privacy boundary (constants/privacy.ts → toPublicPiece), so
 * this component only surfaces the choice — it cannot itself leak anything.
 */
export function AdvancedPublicVisibility({
  showGlazeDetails,
  showStudioNotes,
  onToggleGlaze,
  onToggleNotes,
}: {
  showGlazeDetails: boolean;
  showStudioNotes: boolean;
  onToggleGlaze: () => void;
  onToggleNotes: () => void;
}) {
  const colors = useColors();
  // Reveal the section when the artist has already opted something in, so an
  // enabled detail is never hidden behind a collapsed header.
  const [open, setOpen] = useState(showGlazeDetails || showStudioNotes);
  const anyOn = showGlazeDetails || showStudioNotes;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Advanced public visibility"
      >
        <Feather name="eye" size={13} color={colors.mutedForeground} />
        <View style={styles.headerLabels}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Advanced public visibility
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {anyOn
              ? "Some extra details are visible to visitors"
              : "Glaze details and studio notes stay private"}
          </Text>
        </View>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Row
            title="Show glaze details"
            sub="Glaze, cone, and firing environment appear on the public piece"
            value={showGlazeDetails}
            onPress={onToggleGlaze}
          />
          <Row
            title="Show studio notes"
            sub="Your notes appear on the public piece"
            value={showStudioNotes}
            onPress={onToggleNotes}
          />
        </View>
      ) : null}
    </View>
  );
}

function Row({
  title,
  sub,
  value,
  onPress,
}: {
  title: string;
  sub: string;
  value: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
    >
      <View style={styles.rowLabels}>
        <Text style={[styles.rowTitle, { color: value ? colors.cobalt : colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      <View
        style={[
          styles.toggle,
          { backgroundColor: value ? colors.cobalt : "rgba(120,110,100,0.18)" },
        ]}
      >
        <View style={[styles.toggleThumb, { transform: [{ translateX: value ? 18 : 2 }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  headerLabels: { flex: 1 },
  headerTitle: { fontFamily: "Poppins_400Regular", fontSize: 13.5 },
  headerSub: { fontFamily: "Poppins_300Light", fontSize: 11.5, marginTop: 1 },
  body: { gap: 4, paddingLeft: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 0.75,
    borderColor: "rgba(120,110,100,0.16)",
  },
  rowLabels: { flex: 1 },
  rowTitle: { fontFamily: "Poppins_400Regular", fontSize: 13 },
  rowSub: { fontFamily: "Poppins_300Light", fontSize: 11, marginTop: 1, lineHeight: 15 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
});
