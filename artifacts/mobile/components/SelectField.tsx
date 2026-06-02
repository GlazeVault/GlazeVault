import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface SelectFieldProps {
  value: string;
  options: string[];
  placeholder: string;
  title: string;
  onChange: (v: string) => void;
}

export function SelectField({ value, options, placeholder, title, onChange }: SelectFieldProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const open = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setVisible(true);
  };

  const select = async (opt: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange(value === opt ? "" : opt);
    setVisible(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.field,
          { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={open}
      >
        <Text
          style={[
            styles.fieldText,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
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
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
                <View style={[styles.divider, { backgroundColor: "rgba(120,110,100,0.12)" }]} />
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }} bounces={false}>
                  {options.map((opt) => {
                    const selected = value === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={({ pressed }) => [
                          styles.option,
                          {
                            backgroundColor: pressed ? colors.secondary : "transparent",
                            borderBottomColor: "rgba(120,110,100,0.08)",
                          },
                        ]}
                        onPress={() => select(opt)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            {
                              color: selected ? colors.cobalt : colors.foreground,
                              fontFamily: selected ? "Poppins_500Medium" : "Poppins_400Regular",
                            },
                          ]}
                        >
                          {opt}
                        </Text>
                        {selected && <Feather name="check" size={16} color={colors.cobalt} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  fieldText: { fontSize: 16, fontFamily: "Poppins_300Light" },
  overlay: { flex: 1, backgroundColor: "rgba(40,36,32,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  divider: { height: 1, marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 15, letterSpacing: 0.3 },
});
