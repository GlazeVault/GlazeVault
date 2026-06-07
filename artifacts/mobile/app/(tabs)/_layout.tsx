import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useState, type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountButton } from "@/components/AccountButton";
import { AddMenu } from "@/components/AddMenu";
import { useColors } from "@/hooks/useColors";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type IconName = keyof typeof Feather.glyphMap;

interface NavItem {
  name: string;
  label: string;
  sf: string;
  feather: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { name: "index", label: "Home", sf: "house", feather: "home" },
  { name: "collections", label: "Collections", sf: "rectangle.stack", feather: "layers" },
  { name: "saved", label: "Saved", sf: "bookmark", feather: "bookmark" },
  { name: "profile", label: "Profile", sf: "person", feather: "user" },
];

function TabIcon({ item, active, color }: { item: NavItem; active: boolean; color: string }) {
  if (Platform.OS === "ios") {
    return <SymbolView name={(active ? `${item.sf}.fill` : item.sf) as never} tintColor={color} size={22} />;
  }
  return <Feather name={item.feather} size={20} color={color} />;
}

function GlazeTabBar({ state, navigation }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  const activeName = state.routes[state.index]?.name;

  const navItem = (item: NavItem) => {
    const active = activeName === item.name;
    const color = active ? colors.cobalt : colors.mutedForeground;
    return (
      <Pressable
        key={item.name}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityState={active ? { selected: true } : {}}
        accessibilityLabel={item.label}
        onPress={() => {
          const route = state.routes.find((r) => r.name === item.name);
          if (!route) return;
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(item.name as never);
          }
        }}
      >
        <TabIcon item={item} active={active} color={color} />
        <Text style={[styles.tabLabel, { color }]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {navItem(NAV_ITEMS[0])}
        {navItem(NAV_ITEMS[1])}

        <View style={styles.tabItem}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add"
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: colors.foreground,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            onPress={() => setMenuVisible(true)}
          >
            <Feather name="plus" size={24} color={colors.background} />
          </Pressable>
          <Text style={[styles.tabLabel, { color: colors.mutedForeground }]}>Add</Text>
        </View>

        {navItem(NAV_ITEMS[2])}
        {navItem(NAV_ITEMS[3])}
      </View>

      <AddMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <GlazeTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="collections" />
        <Tabs.Screen name="add" options={{ href: null }} />
        <Tabs.Screen name="saved" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {/* Always-visible entry to Account / Settings (log out) on every tab. */}
      <AccountButton />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: 66,
    paddingHorizontal: 8,
    borderRadius: 28,
    backgroundColor: "rgba(245, 241, 232, 0.98)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 110, 100, 0.10)",
    shadowColor: "#2D2D2A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
    shadowColor: "#2D2D2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
});
