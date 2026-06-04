import { Alert, Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirm/cancel prompt.
 *
 * React Native's `Alert.alert` is a no-op on react-native-web, so destructive
 * confirmations silently did nothing on the Expo web target. This resolves to a
 * real `window.confirm` on web and a native two-button alert on iOS/Android,
 * returning whether the user confirmed.
 */
export function confirm({
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return Promise.resolve(false);
    }
    const body = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(body));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
