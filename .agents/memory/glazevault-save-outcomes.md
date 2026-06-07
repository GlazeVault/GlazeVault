---
name: GlazeVault self-diagnosing save flows
description: How save/update/upload paths classify failures, preserve locally, and avoid stuck spinners.
---

# GlazeVault save outcomes

`lib/saveError.ts` is the contract: `withTimeout` (default SAVE_TIMEOUT_MS), `classifySaveError` (offline/timeout/auth/permission/upload/network/server/unknown), `SaveOutcome {ok, error?}`, `SAVE_OK`, `notifySaveError`, `offerRetry`.

**Rules (durable):**
- Contexts write the change to the local cache FIRST, then attempt the remote write wrapped in `withTimeout`, and return a `SaveOutcome`. `addPiece`/`addCollection` return `{piece|collection, outcome}`.
- UI dedicated-Save handlers wrap the remote portion in `try { ... } finally { setSaving(false) }` so the spinner can never stick — on throw OR early return.
- Retry loops on dedicated Save screens must re-sync the SAME row via `updateX(id, payload)`. **NEVER** re-call `addX` inside a retry: `addCollection`/`addPiece` mint a fresh id every call, so retrying them spawns duplicate rows (and re-runs side effects like `addPieceToCollection`). Pattern: create/locate id ONCE, then loop on `updateX(targetId, payload)`.
- Because contexts now RETURN failures instead of throwing, every call site — including fire-and-forget immediate-saves (e.g. profile `toggleSite`, avatar auto-save) — must consume the outcome and `notifySaveError(outcome.error)` on `!ok`, or it fails silently.

**Why:** Source-of-truth is Supabase, cache is AsyncStorage; a cache-only piece/collection that never reached the server produces a public link that 404s. Users were left with infinite "Saving…" and no idea why. The retry-duplicate bug was caught in review — retrying addCollection created multiple local collections.

**How to apply:** Any new save/update/upload path: return SaveOutcome from the context, consume it at the call site, and if it's a retryable dedicated Save, loop on the update (not the add).
