---
name: GlazeVault firing metadata fields
description: How cone/firingEnvironment work and why legacy `firing` is kept in lockstep.
---

# Firing metadata on PotteryPiece

`PotteryPiece` has three firing-related fields: legacy `firing`, plus newer `cone` (free text) and `firingEnvironment` (selected from `FIRING_ENVIRONMENT_OPTIONS` in `constants/pottery.ts`).

## Rule: `firing` and `firingEnvironment` are kept in lockstep
- On write, `firing` is set to the same value as `firingEnvironment`. This is centralized in `PotteryContext` `addPiece`/`updatePiece` (not at call sites), so any future write path stays in sync automatically.
- `normalizePiece` backfills `firingEnvironment` from legacy `firing` when empty (migrates old stored data + any record that only set `firing`).
- Display fallback everywhere is `firingEnvironment || firing`.

**Why:** legacy/seed data (e.g. seed "Blue Mug") only had `firing`; dropping it would lose data. Keeping both in sync means reads never have to guess which is authoritative.

**How to apply:** never write only one of the two. If you add a new screen/flow that edits firing, just set `firingEnvironment` — the context syncs `firing`. To remove the legacy field entirely someday, ensure all stored records have been migrated first.

## Card vs detail surfaces
- Archive `PotteryCard` meta line shows `[clay, cone, firingEnvironment||firing]` (glaze intentionally dropped from the card).
- Piece detail InfoRows show clay, glaze, cone, firing environment, dimensions.
