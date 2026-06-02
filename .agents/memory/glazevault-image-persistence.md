---
name: GlazeVault image persistence
description: How picked/camera piece photos are copied into permanent storage before being saved
---

# Image persistence

ImagePicker / camera URIs point into a temporary OS cache that can be purged, so they must NEVER be written to `piece.imageUri`. A `persistPieceImage(uri)` helper (in `constants/imageStorage.ts`) copies the picked file into `documentDirectory/pieces/` and returns the permanent `file://` URI; callers (`add` + `edit` save flows) must call it before `addPiece`/`updatePiece`.

**Why:** without copying, photos vanish after an app reload once the cache is cleared.

**How to apply:**
- On native, if the copy fails the helper THROWS; the save flow must catch it, alert the user, and abort — do not fall back to storing the raw temp URI (that re-introduces the bug).
- Web has no document directory → helper returns the URI unchanged.
- `@seed` asset refs and URIs already under the pieces dir are returned untouched (no re-copy on edit).
- Uses the expo-file-system v19 class API (`Paths.document`, `Directory`, `File`, `source.copy(dest)`, sync `dir.exists`/`dir.create`), NOT the legacy `FileSystem.copyAsync` function API.
- Scope is piece photos only; profile avatar is intentionally not persisted this way unless asked.
