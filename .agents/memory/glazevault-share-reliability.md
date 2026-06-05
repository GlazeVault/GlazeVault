---
name: GlazeVault share/copy reliability
description: Why share/copy-link silently failed on iPhone Safari and the gesture-ordering rule every share handler must follow.
---

# Share / Copy Link reliability (iOS Safari web + Expo)

**Rule:** in any share/copy handler, call `Share.share(...)` / `Clipboard.setStringAsync(...)` SYNCHRONOUSLY first — before any `await` (including haptics). Haptics must be fire-and-forget and native-only (`Platform.OS !== "web"`, never awaited).

**Why:** the Web Share API and async Clipboard write require the call to happen inside the user's transient activation. Awaiting anything first (e.g. `await Haptics.impactAsync()`) yields a microtask and drops the activation, so on iPhone Safari share/copy reject silently. `expo-haptics` is also a no-op/unavailable on web. This was THE root cause of "share/copy link doesn't work on iPhone."

**How to apply:**
- Native share failure (not user-cancel) must auto-copy the link to the clipboard + show a "Link copied" notice — never a dead end.
- Distinguish cancel from failure: iOS Safari Web Share rejects with `AbortError` (don't fall back); native iOS resolves with `dismissedAction` (no throw).
- Private pieces must never produce a link: gate the share affordance on `isPubliclyVisiblePiece` AND guard the open handler (defense in depth) — a non-public link would 404 for visitors.
- Affected handlers live in `components/ShareSheet.tsx` (helpers: `tapFeedback`, `isShareDismissal`, `copyLinkToClipboard`) and `app/(tabs)/profile.tsx` (public-site copy/share). Keep them in sync.
- Logging convention: `[glazevault] share link generated <url>`, `[glazevault] share action result: <action>`, `[glazevault] (share fallback )copied link to clipboard <url>`.
