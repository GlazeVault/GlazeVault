---
name: GlazeVault publish/share remote-persistence guarantee
description: Why sharing-critical actions must verify the Supabase write succeeded, not rely on the cache-only offline buffer.
---

# Publish/share must confirm the row is live on Supabase

The public site reads **Supabase**, never the local AsyncStorage cache. The
write path intentionally treats remote write failures as non-fatal (kept
cache-only, logged with `console.warn`, no background sync queue). That offline
buffer is fine for routine edits, but it means a piece can be "public" in the
owner's cache while **absent from Supabase**, so its public link 404s
("Not on view / private").

**Rule:** sharing-critical actions (publish toggle, feature toggle, every owner
Share entry point) must AWAIT the remote write result and surface failure to the
user instead of silently succeeding. `pushPieceRemote`/`updatePiece` return a
boolean (`true` = live on server or no Supabase configured; `false` = remote
write attempted and failed); `ensurePieceRemote(id)` re-pushes a cached piece at
share time to self-heal a piece that never synced.

**Why:** a shared piece showed "private" publicly because the row only existed in
the device cache (a past remote write had failed silently).

**How to apply:**
- There are MULTIPLE owner share entry points — the piece-screen Share button AND
  the fullscreen `ImageViewer`'s own share action. Gate them ALL. `ImageViewer`
  takes an optional `onRequestShare: () => Promise<boolean>` gate; owner usages
  pass it, the public-visitor usage does NOT (a visitor can't push someone else's
  piece — RLS would reject and wrongly block sharing).
- Do NOT add a background sync queue (intentionally excluded). Re-push only in
  direct response to a sharing-critical action.
- Do NOT change visual design when fixing sharing logic.
