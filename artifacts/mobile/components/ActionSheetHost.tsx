import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  resolveActionSheet,
  subscribeActionSheet,
  type ActionSheetRequest,
} from "@/lib/actionSheet";
import type { ActionOption } from "@/lib/notice";

function Sheet({ request }: { request: ActionSheetRequest }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const settled = useRef(false);

  const settle = React.useCallback(
    (chosen: ActionOption | undefined) => {
      if (settled.current) return;
      settled.current = true;
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => resolveActionSheet(chosen));
    },
    [anim]
  );

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const cancelOption = request.options.find((o) => o.style === "cancel");
  const actionOptions = request.options.filter((o) => o.style !== "cancel");

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={() => settle(cancelOption)}
    >
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          onPress={() => settle(cancelOption)}
        />
        <Animated.View
          style={[
            styles.sheetWrap,
            {
              paddingBottom: insets.bottom + 16,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {request.title}
              </Text>
              {request.message ? (
                <Text style={[styles.message, { color: colors.mutedForeground }]}>
                  {request.message}
                </Text>
              ) : null}
            </View>

            <View style={styles.options}>
              {actionOptions.map((option, index) => {
                const destructive = option.style === "destructive";
                return (
                  <Pressable
                    key={`${option.text}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={option.text}
                    onPress={() => settle(option)}
                    style={({ pressed }) => [
                      styles.optionBtn,
                      {
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        backgroundColor: pressed ? colors.secondary : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: destructive ? colors.destructive : colors.foreground },
                      ]}
                    >
                      {option.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelOption?.text ?? "Cancel"}
              onPress={() => settle(cancelOption)}
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  backgroundColor: pressed ? colors.secondary : "transparent",
                },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                {cancelOption?.text ?? "Cancel"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Renders the single active web action sheet. Mounted once at the app root next
 * to `ToastHost`. Subscribes to the module-level action-sheet store and shows
 * one in-app modal listing every option at once.
 *
 * Action sheets are only enqueued on web (see `chooseAction` in `@/lib/notice`),
 * where the platform's multi-button `Alert.alert` is a no-op; on native this host
 * stays empty because choices route through `Alert.alert` instead.
 */
export function ActionSheetHost() {
  const [request, setRequest] = useState<ActionSheetRequest | null>(null);

  useEffect(() => subscribeActionSheet(setRequest), []);

  if (!request) return null;

  // Re-mount per request id so the entrance animation replays each time.
  return <Sheet key={request.id} request={request} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(45, 45, 42, 0.45)",
  },
  sheetWrap: {
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 12px 32px rgba(45, 45, 42, 0.22)",
      },
      default: {
        shadowColor: "#2D2D2A",
        shadowOpacity: 0.22,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      },
    }),
  },
  header: {
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 14,
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    letterSpacing: 0.2,
  },
  message: {
    fontFamily: "Poppins_300Light",
    fontSize: 13,
    lineHeight: 19,
  },
  options: {
    gap: 8,
  },
  optionBtn: {
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  optionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  cancelBtn: {
    marginTop: 12,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
