import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastVariant,
} from "@/lib/toast";

type Palette = ReturnType<typeof useColors>;

function variantStyle(variant: ToastVariant, colors: Palette) {
  switch (variant) {
    case "success":
      return { accent: colors.emerald, icon: "check-circle" as const };
    case "error":
      return { accent: colors.destructive, icon: "alert-circle" as const };
    default:
      return { accent: colors.cobalt, icon: "info" as const };
  }
}

function ToastRow({ toast }: { toast: ToastItem }) {
  const colors = useColors();
  const { accent, icon } = variantStyle(toast.variant, colors);
  const anim = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  const close = React.useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => dismissToast(toast.id));
  }, [anim, toast.id]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(close, toast.duration);
    return () => clearTimeout(timer);
  }, [anim, close, toast.duration]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss notice: ${toast.title}`}
        style={styles.body}
      >
        <Feather name={icon} size={20} color={accent} style={styles.icon} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              {toast.message}
            </Text>
          ) : null}
        </View>
        <Feather
          name="x"
          size={16}
          color={colors.mutedForeground}
          style={styles.close}
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Renders the in-app toast stack. Mounted once at the app root. Subscribes to
 * the module-level toast store and stacks notices at the top of the screen.
 *
 * Toasts are only enqueued on web (see `@/lib/notice`), where the platform's
 * blocking `window.alert` would otherwise be used; on native this host stays
 * empty because notices route through `Alert.alert` instead.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + 12 }]}
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    gap: 10,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 440,
    overflow: "hidden",
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 24px rgba(45, 45, 42, 0.16)",
      },
      default: {
        shadowColor: "#2D2D2A",
        shadowOpacity: 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      },
    }),
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  icon: {
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    lineHeight: 20,
  },
  message: {
    fontFamily: "Poppins_300Light",
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    marginTop: 2,
  },
});
