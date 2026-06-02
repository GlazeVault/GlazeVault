---
name: GlazeVault image & data persistence
description: How piece/avatar photos and all app data are persisted across reloads on Expo web vs native, and the write-ordering guarantee.
---

# Image persistence (web vs native)

GlazeVault runs primarily on **Expo web** (the preview target) but must also work native. Picked image URIs are ephemeral and break on reload, so all images go through `persistPieceImage` (in `constants/imageStorage.ts`) before being stored, and through `resolveImageSource` (in `constants/seedImages.ts`) before display.

- **Web**: convert the picked `blob:`/`http:` URI to a base64 `data:` URI (fetch + FileReader). A raw `blob:` URI dies on reload — that was the original "photos vanish" bug.
- **Native**: copy the file into `documentDirectory/pieces/` and store a **RELATIVE** path (`pieces/<file>`), NOT an absolute `file://`. iOS app-container paths change between builds, so a stored absolute URI would orphan the image.
- `persistPieceImage` is **idempotent**: it returns the input unchanged for `@seed`, `data:`, and already-relative paths (detected via `!uri.includes("://")`). Re-saving an unchanged piece never re-copies or mangles its image.
- `resolveImageSource` reconstructs the native absolute URI on read via `new File(Paths.document, ...uri.split("/")).uri`. **Every** image display site must route through it — a raw `source={{ uri }}` will break for native relative paths.

**Why:** web blob URIs and native absolute file URIs are both non-durable; base64 (web) + relative path (native) are the two that survive reload/reinstall.

**How to apply:** any new image field (avatar, piece, cover, etc.) must run through `persistPieceImage` on save and `resolveImageSource` on display. Avatar save must **fail-closed** (alert + abort) like piece add/edit, not swallow the error and store the temp URI.

**Avatar upload (profile):** tapping the avatar opens the picker in ANY mode (not gated on edit mode) and persists immediately via `updateProfile({avatarUri})` — it does NOT wait for the text-field Save button. The original "avatar never appears" bug was exactly this gating (onPress only set in edit mode + only the Save button persisted). Guard the picker with an in-flight ref to avoid duplicate native file copies on rapid taps.

# Data persistence & write ordering

All three contexts (Pottery/Collections/Profile) persist full snapshots to AsyncStorage and only seed when storage is empty (never overwrite saved data with mock/demo). Required debug logs: `Saved/Loaded pieces|collections|profile`.

- Each context keeps a `*Ref` mirror of latest state so callbacks read fresh data, not a stale render closure (prevents rapid toggles/edits clobbering each other).
- Each context also keeps a `writeChain` ref (`useRef<Promise<void>>`) that chains every `AsyncStorage.setItem` so writes commit **in call order** — an older snapshot can never land after a newer one.

**Why:** updating in-memory state then awaiting an unserialized setItem allowed two rapid saves to commit in reverse order and persist stale data.

# Web localStorage quota

Base64 data URIs live in the single AsyncStorage/localStorage blob, so large photos can blow the quota. Image-picker `quality` is capped (~0.7–0.9) to mitigate. If quota becomes a problem, add resize/compression + a max-bytes guard before calling the `update*`/`addPiece` methods (state is updated before the write, so a failed write currently desyncs UI from storage).
