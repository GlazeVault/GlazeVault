import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Modal, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import type { ShareContent } from "@/constants/privacy";
import { notice } from "@/lib/notice";

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  // Pre-projected, public-safe content built by `buildShareContent` /
  // `buildLinkShareContent`. The sheet only ever receives this allowlisted
  // payload (title + quiet meta + public link) — never the raw piece — so no
  // owner-only studio field can reach a share. The link itself only points at
  // public surfaces; callers gate the share affordance to public content.
  content: ShareContent;
}

// The Web Share API (iOS Safari) and the async Clipboard write both require the
// call to happen synchronously inside the user gesture. Awaiting anything first
// — even a haptic — can drop the transient activation and make share/copy fail
// silently. So haptics are fire-and-forget and native-only, and every handler
// issues the share/clipboard call FIRST.
function tapFeedback() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// True when the share was dismissed by the user rather than failing. iOS
// Safari's Web Share API rejects with an AbortError on cancel; native iOS
// instead resolves with `dismissedAction` (handled without throwing).
function isShareDismissal(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === "AbortError";
}

// Copies the public link to the clipboard, logging the outcome. `viaFallback`
// marks the copy that happens automatically after a failed native share.
async function copyLinkToClipboard(
  url: string,
  viaFallback: boolean,
): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);
    console.log(
      `[glazevault] ${viaFallback ? "share fallback " : ""}copied link to clipboard`,
      url,
    );
    return true;
  } catch (e) {
    console.warn("[glazevault] clipboard copy failed", e);
    return false;
  }
}

/**
 * A calm, two-action share sheet. "Share…" opens the real OS share sheet (the
 * native iOS share experience) via React Native's Share API; "Copy link" puts
 * the public URL on the clipboard. There is deliberately no social/commerce
 * grid — GlazeVault sharing is sending someone to a quiet exhibition, not
 * broadcasting to a feed.
 */
export function ShareSheet({ visible, onClose, content }: ShareSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleNativeShare = useCallback(async () => {
    console.log("[glazevault] share action: opening share sheet", content.url);
    // Fire the OS/Web share SYNCHRONOUSLY (no await before it) so iOS Safari's
    // Web Share API still sees the user gesture; only then run the (non-blocking)
    // haptic and close the sheet. `url` is honored by iOS; Android/web also carry
    // the link in `message`, so it travels on every platform.
    const sharePromise = Share.share(
      {
        // The attribution headline ("Title — Artist on GlazeVault") travels as
        // the share title/subject and leads the message, so the recipient is
        // recommended an exhibition with its original artist preserved.
        title: content.headline,
        message: content.message,
        url: content.url,
      },
      { subject: content.headline },
    );
    tapFeedback();
    onClose();
    try {
      const result = await sharePromise;
      console.log(
        "[glazevault] share action result:",
        result?.action ?? "shared",
      );
    } catch (e) {
      // A user cancel is not a failure — don't fall back on it.
      if (isShareDismissal(e)) {
        console.log("[glazevault] share action result: dismissed by user");
        return;
      }
      // Native/Web share is unavailable or errored (e.g. a desktop browser with
      // no Web Share API): automatically copy the link so the action is never a
      // dead end, then show a quiet confirmation.
      console.warn("[glazevault] share failed; falling back to copy link", e);
      const copied = await copyLinkToClipboard(content.url, true);
      setTimeout(() => {
        notice(
          copied
            ? {
                title: "Link copied",
                message: "Sharing wasn’t available, so the link is on your clipboard.",
                variant: "success",
              }
            : {
                title: "Couldn’t share",
                message: content.url,
                variant: "info",
              },
        );
      }, 250);
    }
  }, [content, onClose]);

  const handleCopyLink = useCallback(async () => {
    // Copy FIRST, within the gesture, so iOS Safari allows the clipboard write.
    const copied = await copyLinkToClipboard(content.url, false);
    tapFeedback();
    onClose();
    setTimeout(() => {
      notice(
        copied
          ? {
              title: "Link copied",
              message: `${content.url} is on your clipboard.`,
              variant: "success",
            }
          : {
              title: "Couldn’t copy automatically",
              message: content.url,
              variant: "info",
            },
      );
    }, 250);
  }, [content.url, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Share
              </Text>
              <Text
                style={[styles.subheading, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {content.title}
              </Text>
            </View>
            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              onPress={onClose}
              hitSlop={8}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Link preview */}
          {content.url ? (
            <View
              style={[
                styles.linkRow,
                {
                  backgroundColor: colors.secondary,
                  borderColor: "rgba(120, 110, 100, 0.12)",
                },
              ]}
            >
              <Feather name="link" size={14} color={colors.mutedForeground} />
              <Text
                style={[styles.linkText, { color: colors.mutedForeground }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {content.url.replace(/^https?:\/\//, "")}
              </Text>
            </View>
          ) : null}

          {/* Primary action — native OS share sheet */}
          <Pressable
            style={({ pressed }) => [
              styles.shareBtn,
              {
                backgroundColor: colors.foreground,
                borderRadius: colors.radius,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            onPress={handleNativeShare}
          >
            <Feather name="share-2" size={17} color={colors.background} />
            <Text style={[styles.shareBtnText, { color: colors.background }]}>
              Share…
            </Text>
          </Pressable>

          {/* Secondary action — copy link */}
          <Pressable
            style={({ pressed }) => [
              styles.copyRow,
              {
                backgroundColor: pressed ? colors.secondary : "transparent",
                borderRadius: 12,
              },
            ]}
            onPress={handleCopyLink}
          >
            <View
              style={[
                styles.copyIcon,
                {
                  backgroundColor: "rgba(240, 235, 228, 0.7)",
                  borderColor: "rgba(120, 110, 100, 0.12)",
                },
              ]}
            >
              <Feather name="copy" size={17} color={colors.foreground} />
            </View>
            <View style={styles.copyText}>
              <Text style={[styles.copyLabel, { color: "rgba(45, 45, 42, 0.72)" }]}>
                Copy link
              </Text>
              <Text style={[styles.copySub, { color: colors.mutedForeground }]}>
                Put the public link on your clipboard
              </Text>
            </View>
          </Pressable>

          {/* Cancel */}
          <Pressable style={styles.cancelRow} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45,45,42,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  headerText: { flex: 1, paddingRight: 12 },
  heading: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_400Regular",
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  subheading: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 0.75,
    marginBottom: 20,
  },
  linkText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Poppins_400Regular",
    letterSpacing: 0.2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 15,
    marginBottom: 6,
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.4,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  copyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.75,
  },
  copyText: { flex: 1, gap: 2 },
  copyLabel: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
  },
  copySub: {
    fontSize: 12,
    fontFamily: "Poppins_300Light",
  },
  cancelRow: {
    alignItems: "center",
    paddingTop: 22,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "Poppins_300Light",
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
});
