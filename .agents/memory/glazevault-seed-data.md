---
name: GlazeVault seed data
description: Demo seeding is removed; how the retired blue-mug demo is purged without harming user pieces.
---

- GlazeVault no longer seeds ANY demo data. The old `SEED_PIECES` / `seed-blue-mug` sample and its `LEGACY_SEED_DEMO_NOTES` cleanup were removed from `PotteryContext`. Start state is empty when there are no real pieces.
  - **Why:** the demo `seed-blue-mug` piece (bundled `@seed/blue-mug`, byte-identical to `assets/images/blue-mug.png`) had propagated into Supabase. With a failed remote write (PGRST205 outage), remote-wins on reload kept restoring the demo image over the user's photo — the "image reverts to blue mug" bug.
- Purge the retired demo by its IMAGE signature, never by id alone. `isDemoSeedPiece(p)` matches `id === "seed-blue-mug"` AND imageUri is empty, `@seed/...`, or the deleted demo storage object marker `1780452984113-h6pjefo`.
  - **Why:** editing a piece in place keeps its id, so a real user image (web `data:` URI, native `pieces/...` path, or an uploaded `https` URL) can live under the `seed-blue-mug` id. Dropping by id alone (or "id + not data:") would delete genuine user photos.
  - **How to apply:** filter `isDemoSeedPiece` from BOTH local cache and remote results on load so the demo can't repaint or be re-synced up; any real image under that id passes through and syncs.
- One-time remote cleanup is done (data only, no schema change): the `seed-blue-mug` row was deleted from `public.pieces` and its storage object removed via the Storage API (direct `DELETE FROM storage.objects` is blocked — use the Storage REST API).
- Temporary debug logs `console.log("Saving piece images:", id, imageUri)` (in `pushPieceRemote`) and `console.log("Loaded piece images:", id, imageUri)` (load effect) were added at the user's request — remove when the image-revert investigation is closed.
