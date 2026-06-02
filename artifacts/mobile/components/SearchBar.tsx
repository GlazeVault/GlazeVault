import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Search" }: SearchBarProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.secondary, borderColor: "rgba(120,110,100,0.14)" },
      ]}
    >
      <Feather name="search" size={15} color={colors.mutedForeground} style={{ opacity: 0.7 }} />
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable
          hitSlop={8}
          onPress={() => onChangeText("")}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
        >
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.75,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
    padding: 0,
  },
});
