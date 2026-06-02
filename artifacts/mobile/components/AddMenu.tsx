import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface AddMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface OptionConfig {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  route: string;
  mode: "navigate" | "push";
}

const OPTIONS: OptionConfig[] = [
  {
    icon: "feather",
    title: "Record Piece",
    subtitle: "Add a new work to your archive",
    route: "/add",
    mode: "navigate",
  },
  {
    icon: "layers",
    title: "Create Collection",
    subtitle: "Start a new curated series",
    route: "/collection/new",
    mode: "push",
  },
];

export function AddMenu({ visible, onClose }: AddMenuProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleSelect = async (opt: OptionConfig) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
    if (opt.mode === "navigate") {
      router.navigate(opt.route as never);
    } else {
      router.push(opt.route as never);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
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
              <Text style={[styles.eyebrow, { color: colors.cobalt }]}>Create</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Add to GlazeVault</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.options}>
                {OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.route}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: pressed ? colors.secondary : "transparent",
                        borderColor: "rgba(120,110,100,0.14)",
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={opt.title}
                    accessibilityHint={opt.subtitle}
                    onPress={() => handleSelect(opt)}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name={opt.icon} size={20} color={colors.foreground} />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                        {opt.title}
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: colors.mutedForeground }]}>
                        {opt.subtitle}
                      </Text>
                    </View>
                    <Feather name="arrow-up-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
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
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  divider: { height: 1, width: 40, marginBottom: 20 },
  options: { gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 0.75,
    gap: 16,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, gap: 3 },
  optionTitle: {
    fontSize: 17,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.2,
  },
  optionSubtitle: {
    fontSize: 12.5,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.2,
    lineHeight: 18,
  },
});
