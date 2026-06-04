import { Alert, Platform } from "react-native";

export type NoticeOptions = {
  title: string;
  message?: string;
  buttonText?: string;
};

/**
 * Cross-platform single-button informational notice.
 *
 * React Native's `Alert.alert` is a no-op on react-native-web, so validation
 * errors, permission denials, and success messages silently never appeared on
 * the Expo web target. This resolves to a real `window.alert` on web and a
 * native single-button alert on iOS/Android. Mirrors `@/lib/confirm` for the
 * informational (non-confirming) case.
 */
export function notice({
  title,
  message,
  buttonText = "OK",
}: NoticeOptions): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.alert !== "function") {
      return Promise.resolve();
    }
    const body = message ? `${title}\n\n${message}` : title;
    window.alert(body);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: buttonText, onPress: () => resolve() },
    ]);
  });
}

export type ActionOption = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

/**
 * Cross-platform multi-option action sheet.
 *
 * On native this is a standard `Alert.alert` with multiple buttons. On web —
 * where `Alert.alert` is a no-op — it falls back to a sequence of `window.confirm`
 * prompts (one per non-cancel option, in order) so the user can still reach every
 * action. The first option the user accepts is invoked; declining all of them is
 * treated as the cancel action.
 */
export function chooseAction(title: string, message: string | undefined, options: ActionOption[]): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return Promise.resolve();
    }
    const cancel = options.find((o) => o.style === "cancel");
    const actions = options.filter((o) => o.style !== "cancel");
    for (let i = 0; i < actions.length; i++) {
      const option = actions[i];
      const isLast = i === actions.length - 1;
      // The last actionable option is auto-confirmed when no cancel exists, so
      // the user is never trapped without a way to pick the final action.
      const body = message ? `${option.text}?\n\n${message}` : `${option.text}?`;
      if (window.confirm(body)) {
        option.onPress?.();
        return Promise.resolve();
      }
      if (isLast && !cancel) {
        // Nothing left to offer; honor the last decline as a no-op.
        break;
      }
    }
    cancel?.onPress?.();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      options.map((o) => ({
        text: o.text,
        style: o.style,
        onPress: () => {
          o.onPress?.();
          resolve();
        },
      }))
    );
  });
}
