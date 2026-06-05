import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useCollections } from "@/context/CollectionsContext";
import { useProfile } from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";
import { useColors } from "@/hooks/useColors";

/**
 * A public web visitor arrives with an empty cache, so the contexts need a beat
 * to hydrate from Supabase before we can know whether a slug / piece / collection
 * is really public or really missing. Each store exposes a `hydrated` flag that
 * flips once its initial cache + Supabase load has settled, so we wait for ALL
 * three before rendering a verdict — gating on "any data arrived" used to flash
 * "not on view" on a valid link when one store (e.g. pieces) hydrated before the
 * profile that supplies the slug. A safety timer still forces a definitive
 * answer in case a load hangs, so a genuinely-empty studio always resolves.
 */
export function usePublicReady(): boolean {
  const { hydrated: profileReady } = useProfile();
  const { hydrated: collectionsReady } = useCollections();
  const { hydrated: piecesReady } = usePottery();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return timedOut || (profileReady && collectionsReady && piecesReady);
}

export function PublicLoading() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.emerald} />
    </View>
  );
}

/**
 * Shown when a public link points at something that is private, unpublished, or
 * no longer on view. Deliberately quiet and non-committal — it never reveals
 * whether the content exists, only that it isn't publicly on view.
 */
export function PublicMissing() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <View style={[styles.circle, { backgroundColor: colors.secondary }]}>
        <Feather
          name="eye-off"
          size={22}
          color={colors.mutedForeground}
          style={{ opacity: 0.5 }}
        />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Not on view
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        This page is private or no longer part of a public exhibition.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_500Medium",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
    fontFamily: "Poppins_400Regular",
  },
});
