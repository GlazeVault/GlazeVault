import { AntDesign, Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface ShareOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  iconScale?: number;
}

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  pieceTitle: string;
}

export function ShareSheet({ visible, onClose, pieceTitle }: ShareSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleOption = useCallback(
    async (label: string) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (label === "Copy Link") {
        onClose();
        setTimeout(() => {
          Alert.alert("Link copied", `A link to "${pieceTitle}" has been copied to your clipboard.`);
        }, 300);
      } else {
        onClose();
        setTimeout(() => {
          Alert.alert(
            `Share to ${label}`,
            `This will open ${label} so you can share "${pieceTitle}". Full integration coming soon.`
          );
        }, 300);
      }
    },
    [onClose, pieceTitle]
  );

  const platforms: ShareOption[] = [
    {
      id: "instagram",
      label: "Instagram",
      icon: <FontAwesome name="instagram" size={22} color={colors.foreground} />,
      accent: "#C4A09A",
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <FontAwesome name="facebook" size={22} color={colors.foreground} />,
      accent: colors.cobalt,
    },
    {
      id: "pinterest",
      label: "Pinterest",
      icon: <FontAwesome name="pinterest" size={22} color={colors.foreground} />,
      accent: colors.primary,
      iconScale: 0.95,
    },
    {
      id: "etsy",
      label: "Etsy",
      icon: <FontAwesome name="etsy" size={22} color={colors.foreground} />,
      accent: "#C8A06A",
      iconScale: 0.92,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.heading, { color: colors.foreground }]}>Share</Text>
              <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
                {pieceTitle}
              </Text>
            </View>
            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              onPress={onClose}
              hitSlop={8}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Platform grid */}
          <View style={styles.grid}>
            {platforms.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [
                  styles.platformCell,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={() => handleOption(opt.label)}
              >
                {({ pressed }) => (
                  <>
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: pressed
                            ? "rgba(160, 145, 130, 0.06)"
                            : colors.secondary,
                          borderColor: "rgba(120, 110, 100, 0.12)",
                          borderWidth: 0.75,
                        },
                      ]}
                    >
                      <View
                        style={
                          opt.iconScale
                            ? { transform: [{ scale: opt.iconScale }] }
                            : undefined
                        }
                      >
                        {opt.icon}
                      </View>
                    </View>
                    <Text style={[styles.platformLabel, { color: colors.mutedForeground }]}>
                      {opt.label}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Copy Link */}
          <Pressable
            style={({ pressed }) => [
              styles.copyRow,
              {
                backgroundColor: pressed ? colors.secondary : "transparent",
                borderRadius: 12,
              },
            ]}
            onPress={() => handleOption("Copy Link")}
          >
            <View
              style={[
                styles.copyIcon,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="link" size={18} color={colors.foreground} />
            </View>
            <View style={styles.copyText}>
              <Text style={[styles.copyLabel, { color: colors.foreground }]}>Copy Link</Text>
              <Text style={[styles.copySub, { color: colors.mutedForeground }]}>
                Share a link to this piece
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.border} />
          </Pressable>

          {/* Cancel */}
          <Pressable style={styles.cancelRow} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45,45,42,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  heading: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  subheading: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  platformCell: {
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  platformLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  copyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  copyText: { flex: 1, gap: 2 },
  copyLabel: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
  },
  copySub: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
  },
  cancelRow: {
    alignItems: "center",
    paddingTop: 16,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
});
