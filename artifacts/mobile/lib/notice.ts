import { Alert, Platform } from "react-native";

import { presentActionSheet } from "@/lib/actionSheet";
import { showToast, type ToastVariant } from "@/lib/toast";

export type NoticeOptions = {
  title: string;
  message?: string;
  buttonText?: string;
  /**
   * Controls toast styling on web. Native alerts ignore this. Defaults to
   * "info".
   */
  variant?: ToastVariant;
};

/**
 * Cross-platform single-button informational notice.
 *
 * React Native's `Alert.alert` is a no-op on react-native-web, so validation
 * errors, permission denials, and success messages silently never appeared on
 * the Expo web target. On web this now renders a branded in-app toast (see
 * `@/components/ToastHost`) instead of the blocking, unstyled `window.alert`;
 * on iOS/Android it still resolves to a native single-button alert. Mirrors
 * `@/lib/confirm` for the informational (non-confirming) case.
 */
export function notice({
  title,
  message,
  buttonText = "OK",
  variant = "info",
}: NoticeOptions): Promise<void> {
  if (Platform.OS === "web") {
    showToast({ title, message, variant });
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
 * where `Alert.alert` is a no-op — it renders a single in-app modal listing
 * every option at once (see `@/components/ActionSheetHost`), instead of the old
 * chained `window.confirm` prompts. The chosen option's `onPress` is invoked;
 * dismissing the sheet (backdrop tap / close) runs the cancel option if present.
 */
export function chooseAction(title: string, message: string | undefined, options: ActionOption[]): Promise<void> {
  if (Platform.OS === "web") {
    return presentActionSheet(title, message, options).then((chosen) => {
      const cancel = options.find((o) => o.style === "cancel");
      // A dismissal (undefined) resolves to the cancel action so callers that
      // rely on cancel side effects still run.
      (chosen ?? cancel)?.onPress?.();
    });
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
