---
name: GlazeVault image & data persistence
description: How piece/avatar photos and all app data are persisted across reloads on Expo web vs native, and the write-ordering guarantee.
---

# Image persistence (web vs native)

GlazeVault runs primarily on **Expo web** (the preview target) but must also work native. Picked image URIs are ephemeral and break on reload, so all images go through `persistPieceImage` (in `constants/imageStorage.ts`) before being stored, and through `resolveImageSource` (in `constants/seedImages.ts`) before display.

- **Web**: store a base64 `data:` URI. A raw `blob:` URI dies on reload — that was the original "photos vanish" bug. PREFER getting base64 straight from the picker (`launchImageLibraryAsync({ base64: true })` → `data:${asset.mimeType};base64,${asset.base64}`) over `fetch(blobUri)` + FileReader: **fetching a `blob:` URL fails inside the sandboxed canvas preview iframe**, which silently broke avatar upload. `persistPieceImage`'s fetch path still works under the Playwright test harness but not the preview iframe, so for picker-sourced web images go base64-direct.
- **Native**: copy the file into `documentDirectory/pieces/` and store a **RELATIVE** path (`pieces/<file>`), NOT an absolute `file://`. iOS app-container paths change between builds, so a stored absolute URI would orphan the image.
- `persistPieceImage` is **idempotent**: it returns the input unchanged for `@seed`, `data:`, remote `http(s)://` URLs, and already-relative paths (detected via `!uri.includes("://")`). Re-saving an unchanged piece never re-copies or mangles its image. The `http(s)://` guard is **load-bearing**: once a piece syncs to Supabase its `imageUri` is a remote Storage URL, and a metadata-only edit re-runs `persistPieceImage` on it FIRST in `handleSave`. Without the guard, native runs `new File(url).copy(...)` (copying a remote URL as a local file → throws) and web re-`fetch`es it; the throw is caught and aborts the save BEFORE `updatePiece`, so the metadata silently never saves and the user sees "Couldn't save photo". `dataService.uploadImage` has the same guard — **keep the two in lockstep**; any URI scheme one short-circuits, the other must too.
- `resolveImageSource` reconstructs the native absolute URI on read via `new File(Paths.document, ...uri.split("/")).uri`. **Every** image display site must route through it — a raw `source={{ uri }}` will break for native relative paths.

**Why:** web blob URIs and native absolute file URIs are both non-durable; base64 (web) + relative path (native) are the two that survive reload/reinstall.

**How to apply:** any new image field (avatar, piece, cover, etc.) must end up as a durable URI (web base64 / native relative) on save and route through `resolveImageSource` on display. Avatar save must **fail-closed** (alert + abort) like piece add/edit, not swallow the error and store the temp URI. CRITICAL: on failure do NOT revert the displayed URI back to empty — the old avatar code optimistically set the picked URI then reverted to `""` in its catch, so the image flashed and vanished (looked like "upload does nothing"). Compute a durable URI first, then `setAvatarUri` once; only alert on error.

**Avatar upload (profile):** tapping the avatar opens the picker in ANY mode (not gated on edit mode) and persists immediately via `updateProfile({avatarUri})` — it does NOT wait for the text-field Save button. The original "avatar never appears" bug was exactly this gating (onPress only set in edit mode + only the Save button persisted). Guard the picker with an in-flight ref to avoid duplicate native file copies on rapid taps. The avatar **display** must read from `profile.avatarUri` only (single source of truth), NOT an `isEditing ? localAvatarUri : profile.avatarUri` split — the local-state split is a latent drop risk and the letter fallback should appear iff `!profile.avatarUri`. Web upload (picker base64 → data: URI → updateProfile → img with data: src) is verified working end-to-end via the Playwright test harness (drive the hidden `input[type=file]` with an in-memory buffer).

# Data persistence & write ordering

All three contexts (Pottery/Collections/Profile) persist full snapshots to AsyncStorage and only seed when storage is empty (never overwrite saved data with mock/demo). Required debug logs: `Saved/Loaded pieces|collections|profile`.

- Each context keeps a `*Ref` mirror of latest state so callbacks read fresh data, not a stale render closure (prevents rapid toggles/edits clobbering each other).
- Each context also keeps a `writeChain` ref (`useRef<Promise<void>>`) that chains every `AsyncStorage.setItem` so writes commit **in call order** — an older snapshot can never land after a newer one.

**Why:** updating in-memory state then awaiting an unserialized setItem allowed two rapid saves to commit in reverse order and persist stale data.

# Web localStorage quota — cache is METADATA-ONLY + FAIL-SOFT

On web `AsyncStorage` IS `localStorage` (~5MB/origin). Earlier `persist()` serialized the WHOLE pieces array including base64 `data:` images into that one blob, so after a couple photos `setItem` threw `QuotaExceededError`. Because every mutation did `await persist()` BEFORE its Supabase call, a rejected cache write meant the remote write never ran, and handlers without try/finally stranded loading state → the "Save/Delete/Remove work once or twice then hang/do nothing" prod bug. (Native is immune: it caches tiny `pieces/` relative paths, not base64.)

**The rule (do not regress):**
- `persist()` writes a **metadata-only** snapshot: `toCacheSafePieces` (PotteryContext) drops any `data:` URI from `imageUri`/`images`; CollectionsContext drops a `data:` `coverImageUri`. Only https Supabase URLs + native `pieces/` paths are cached. The full-res `data:` URI stays in MEMORY for instant paint; the uploaded Supabase URL is folded back into cache after `pushPieceRemote`.
- `persist()` is **fail-soft**: the `setItem` is wrapped in `.catch` (logs, never rejects). The cache write must NEVER gate the remote Supabase write or a UI loading state.
- Mutation handlers (Save add/edit, Delete, Remove-from-collection) use try/catch/finally with the loading reset in `finally`; haptics are fire-and-forget (`.catch(()=>{})`, never awaited) so a web haptics rejection can't abort navigation.

**Why:** Supabase is the source of truth; the cache is only for instant paint/offline. A cache-only piece whose remote upload never succeeded WILL lose its image on reload (metadata-only strips it) — accepted tradeoff.
**How to apply:** never write base64 to the cache; never make a remote write or a `setSaving`/loading reset depend on the cache `setItem` resolving. Other piece toggles (feature/public/archive, remove-from-portfolio) still `await Haptics.*` before mutating — same fire-and-forget guard should be applied if they ever show the same web-abort symptom.
