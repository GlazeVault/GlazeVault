/**
 * chooseAction() is the multi-option sibling of confirm(). React Native's
 * Alert.alert is a no-op on react-native-web, so the web target needs a real
 * in-app surface. These tests pin the two code paths:
 *
 *   - web    → delegates to the action-sheet store (presentActionSheet) and runs
 *              the chosen option's onPress; a dismissal (undefined) runs the
 *              cancel option instead.
 *   - native → fires the pressed Alert button's onPress and resolves.
 *
 * The action-sheet store itself (subscribe / present / resolve) is also pinned so
 * the host component can rely on a single active request that resolves exactly
 * once.
 */
import { Alert, Platform } from "react-native";

import {
  presentActionSheet,
  resolveActionSheet,
  subscribeActionSheet,
  type ActionSheetRequest,
} from "@/lib/actionSheet";
import { chooseAction } from "@/lib/notice";

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: jest.fn() },
}));

jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function setPlatform(os: string) {
  (Platform as { OS: string }).OS = os;
}

describe("action-sheet store", () => {
  it("emits the active request and resolves with the chosen option", async () => {
    let seen: ActionSheetRequest | null = null;
    const unsub = subscribeActionSheet((req) => {
      seen = req;
    });

    const option = { text: "Camera" };
    const promise = presentActionSheet("Add Photo", undefined, [
      option,
      { text: "Cancel", style: "cancel" as const },
    ]);

    expect(seen).not.toBeNull();
    expect(seen!.title).toBe("Add Photo");
    expect(seen!.options).toHaveLength(2);

    resolveActionSheet(option);
    await expect(promise).resolves.toBe(option);
    // The store clears itself once resolved so the host unmounts.
    expect(seen).toBeNull();

    unsub();
  });

  it("resolves undefined when dismissed", async () => {
    const promise = presentActionSheet("Pick", undefined, [{ text: "A" }]);
    resolveActionSheet(undefined);
    await expect(promise).resolves.toBeUndefined();
  });

  it("auto-dismisses a prior sheet when a new one opens", async () => {
    const first = presentActionSheet("First", undefined, [{ text: "A" }]);
    presentActionSheet("Second", undefined, [{ text: "B" }]);
    // Opening the second sheet resolves the first with a dismissal.
    await expect(first).resolves.toBeUndefined();
    resolveActionSheet(undefined);
  });
});

describe("chooseAction() on web", () => {
  beforeEach(() => {
    setPlatform("web");
  });

  it("runs the chosen option's onPress", async () => {
    const onCamera = jest.fn();
    const onCancel = jest.fn();
    const promise = chooseAction("Add Photo", undefined, [
      { text: "Camera", onPress: onCamera },
      { text: "Cancel", style: "cancel", onPress: onCancel },
    ]);

    // Simulate the host resolving with the Camera option.
    resolveActionSheet({ text: "Camera", onPress: onCamera });
    await promise;

    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("falls back to the cancel option when dismissed", async () => {
    const onChoose = jest.fn();
    const onCancel = jest.fn();
    const promise = chooseAction("Add to Collection?", "msg", [
      { text: "Choose", onPress: onChoose },
      { text: "Later", style: "cancel", onPress: onCancel },
    ]);

    resolveActionSheet(undefined);
    await promise;

    expect(onChoose).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("chooseAction() on native", () => {
  beforeEach(() => {
    setPlatform("ios");
    (Alert.alert as jest.Mock).mockReset();
  });

  function lastButtons(): AlertButton[] {
    const calls = (Alert.alert as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][2] as AlertButton[];
  }

  it("fires the pressed button's onPress and resolves", async () => {
    const onCamera = jest.fn();
    const promise = chooseAction("Add Photo", undefined, [
      { text: "Camera", onPress: onCamera },
      { text: "Cancel", style: "cancel" },
    ]);

    const cameraBtn = lastButtons().find((b) => b.text === "Camera");
    cameraBtn?.onPress?.();

    await promise;
    expect(onCamera).toHaveBeenCalledTimes(1);
  });
});
