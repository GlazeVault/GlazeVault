import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { isPortfolioPiece, isPubliclyVisiblePiece } from "@/constants/privacy";
import type { PotteryPiece } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

/**
 * One quiet, icon-first status indicator for a piece, shared by every owner
 * surface (Archive grid, Collection grid) so the badge language reads
 * identically everywhere:
 *   archive  → Retired
 *   ☆ star   → Featured in Portfolio
 *   🌐 globe → Public
 *   🔒 lock  → Private
 * Priority is singular and calm: archived → featured → public → private.
 * Icon-only by design (label carried via accessibility), positioned top-left.
 */
export function PieceStatusBadge({
  piece,
  style,
}: {
  piece: PotteryPiece;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();

  let icon: keyof typeof Feather.glyphMap;
  let color: string;
  let label: string;

  if (piece.archived) {
    icon = "archive";
    color = "#8A7B6C";
    label = "Retired";
  } else if (isPortfolioPiece(piece)) {
    icon = "star";
    color = colors.emerald;
    label = "Featured in portfolio";
  } else if (isPubliclyVisiblePiece(piece)) {
    icon = "globe";
    color = colors.cobalt;
    label = "Public";
  } else {
    icon = "lock";
    color = "#8A7B6C";
    label = "Private";
  }

  return (
    <View
      style={[styles.badge, style]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={12} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.86)",
    borderWidth: 0.5,
    borderColor: "rgba(120,110,100,0.12)",
  },
});
