/**
 * The cross-platform confirm() helper is the fix for destructive prompts silently
 * doing nothing on the Expo *web* target (React Native's Alert.alert is a no-op on
 * react-native-web). These tests pin the two code paths that the original bug and
 * its fix hinge on:
 *
 *   - web  → resolves whatever window.confirm() returned (true/false), and
 *            fail-closed (false) when window.confirm is unavailable.
 *   - native → resolves true only when the confirm button's onPress fires, false
 *              when the cancel button's onPress fires.
 *
 * react-native is mocked down to just Platform + Alert so the helper can run under
 * the node test environment without pulling in the full RN/web runtime. Platform.OS
 * is read at call time inside confirm(), so each test flips it directly.
 */
import { Alert, Platform } from "react-native";

import { confirm } from "@/lib/confirm";

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: jest.fn() },
}));

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function setPlatform(os: string) {
  (Platform as { OS: string }).OS = os;
}

describe("confirm() on web", () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
  });

  beforeEach(() => {
    setPlatform("web");
  });

  it("resolves true when window.confirm returns true", async () => {
    const winConfirm = jest.fn(() => true);
    global.window = { confirm: winConfirm } as unknown as Window & typeof globalThis;

    await expect(
      confirm({ title: "Remove Piece", message: "Are you sure?" }),
    ).resolves.toBe(true);
    // Title + message are joined into a single body string for the native prompt UI.
    expect(winConfirm).toHaveBeenCalledWith("Remove Piece\n\nAre you sure?");
  });

  it("resolves false when window.confirm returns false (user cancelled)", async () => {
    const winConfirm = jest.fn(() => false);
    global.window = { confirm: winConfirm } as unknown as Window & typeof globalThis;

    await expect(confirm({ title: "Delete Collection" })).resolves.toBe(false);
    // With no message, only the title is shown.
    expect(winConfirm).toHaveBeenCalledWith("Delete Collection");
  });

  it("fails closed (false) when window.confirm is unavailable", async () => {
    global.window = {} as unknown as Window & typeof globalThis;
    await expect(confirm({ title: "Remove Piece" })).resolves.toBe(false);
  });
});

describe("confirm() on native", () => {
  beforeEach(() => {
    setPlatform("ios");
    (Alert.alert as jest.Mock).mockReset();
  });

  function lastButtons(): AlertButton[] {
    const calls = (Alert.alert as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][2] as AlertButton[];
  }

  it("resolves true when the confirm button is pressed", async () => {
    const promise = confirm({
      title: "Remove Piece",
      confirmText: "Remove",
      destructive: true,
    });
    const confirmBtn = lastButtons().find((b) => b.text === "Remove");
    expect(confirmBtn?.style).toBe("destructive");
    confirmBtn?.onPress?.();
    await expect(promise).resolves.toBe(true);
  });

  it("resolves false when the cancel button is pressed", async () => {
    const promise = confirm({ title: "Remove Piece", confirmText: "Remove" });
    const cancelBtn = lastButtons().find((b) => b.style === "cancel");
    expect(cancelBtn?.text).toBe("Cancel");
    cancelBtn?.onPress?.();
    await expect(promise).resolves.toBe(false);
  });
});
