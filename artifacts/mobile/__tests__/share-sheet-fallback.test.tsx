/**
 * Guards the iPhone Share / Copy Link reliability fix in `components/ShareSheet`.
 *
 * The bug: every handler did `await Haptics.impactAsync(...)` BEFORE calling
 * Share.share() / Clipboard.setStringAsync(). On iOS Safari the Web Share and
 * async Clipboard APIs must be invoked synchronously inside the user gesture, so
 * the prior await dropped the transient activation and the action silently
 * failed — and a failed native share had no clipboard fallback at all.
 *
 * These tests assert the corrected behavior:
 *   - "Copy link" writes the public URL to the clipboard (gesture-safe) and
 *     confirms with a success notice.
 *   - "Share…" invokes the OS/Web share with the public link.
 *   - When the native share REJECTS (e.g. no Web Share API), it auto-copies the
 *     link to the clipboard and shows a "Link copied" notice (requirement 3).
 *   - A user-dismissed share (AbortError on web) is NOT treated as a failure and
 *     does not trigger the clipboard fallback.
 *
 * Factory-referenced outer vars are `mock`-prefixed per the jest hoisting rule.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Share } from "react-native";

import { ShareSheet } from "@/components/ShareSheet";
import type { ShareContent } from "@/constants/privacy";

const mockSetStringAsync = jest.fn(() => Promise.resolve(true));
jest.mock("expo-clipboard", () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

const mockNotice = jest.fn();
jest.mock("@/lib/notice", () => ({
  notice: (...args: unknown[]) => mockNotice(...args),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("@/hooks/useColors", () => ({
  useColors: () =>
    new Proxy(
      { radius: 12 },
      {
        get: (target, prop) =>
          typeof prop === "string" && prop in target
            ? (target as Record<string, unknown>)[prop]
            : "#000000",
      },
    ),
}));

const CONTENT: ShareContent = {
  title: "Cobalt Vase",
  headline: "Cobalt Vase — Test Artist on GlazeVault",
  message:
    "Cobalt Vase — Test Artist on GlazeVault\nstoneware · 2025\nhttps://glazevault.art/test-artist/piece/p1",
  url: "https://glazevault.art/test-artist/piece/p1",
};

// Lets the trailing `setTimeout(..., 250)` notice fire on real timers.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

describe("ShareSheet — iPhone share / copy reliability", () => {
  beforeEach(() => {
    mockSetStringAsync.mockClear();
    mockSetStringAsync.mockResolvedValue(true);
    mockNotice.mockClear();
  });

  it("Copy link writes the public URL to the clipboard and confirms", async () => {
    const { getByText } = render(
      <ShareSheet visible onClose={jest.fn()} content={CONTENT} />,
    );

    await fireEvent.press(getByText("Copy link"));

    // Copied synchronously within the gesture (before any awaited haptic).
    expect(mockSetStringAsync).toHaveBeenCalledWith(CONTENT.url);

    await flush();
    expect(mockNotice).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Link copied", variant: "success" }),
    );
  });

  it("Share… invokes the OS/Web share with the public link", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction" } as never);

    const { getByText } = render(
      <ShareSheet visible onClose={jest.fn()} content={CONTENT} />,
    );

    await fireEvent.press(getByText("Share…"));

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ url: CONTENT.url, message: CONTENT.message }),
    );

    await flush();
    // A successful share must NOT also copy to the clipboard.
    expect(mockSetStringAsync).not.toHaveBeenCalled();

    shareSpy.mockRestore();
  });

  it("falls back to copying the link when the native share fails", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockRejectedValue(new Error("Share is not supported in this browser"));

    const { getByText } = render(
      <ShareSheet visible onClose={jest.fn()} content={CONTENT} />,
    );

    await fireEvent.press(getByText("Share…"));
    await flush();

    expect(mockSetStringAsync).toHaveBeenCalledWith(CONTENT.url);
    expect(mockNotice).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Link copied", variant: "success" }),
    );

    shareSpy.mockRestore();
  });

  it("does NOT fall back when the user dismisses the share sheet", async () => {
    const abort = Object.assign(new Error("Abort"), { name: "AbortError" });
    const shareSpy = jest.spyOn(Share, "share").mockRejectedValue(abort);

    const { getByText } = render(
      <ShareSheet visible onClose={jest.fn()} content={CONTENT} />,
    );

    await fireEvent.press(getByText("Share…"));
    await flush();

    // A cancel is not a failure, so the link is not copied as a fallback.
    expect(mockSetStringAsync).not.toHaveBeenCalled();

    shareSpy.mockRestore();
  });
});
