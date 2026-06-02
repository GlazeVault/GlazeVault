---
name: GlazeVault context reactivity (getPiece vs pieces)
description: Why screens that must reflect live piece changes must read the reactive `pieces` list, not the getPiece ref-read
---

# Reactive source of truth for pieces

`PotteryContext` keeps both `const [pieces, setPieces]` (reactive state) and `piecesRef.current` (a mirror used so update callbacks have stable deps and never close over stale state). `getPiece(id)` reads `piecesRef.current` — a **ref**, so it is NOT reactive on its own.

## Rule
Any screen that must visually reflect the latest piece data (e.g. a visibility badge, a toggle's on/off state) must derive the piece from the reactive list: `const { pieces } = usePottery(); const piece = pieces.find(p => p.id === id)`. Do not use `getPiece(id)` for rendered, must-stay-fresh values.

**Why:** A stale-badge bug — a piece set Public in Piece Detail still showed a "Private" badge in Collection detail. Piece Detail had read `getPiece(id)`. It happened to re-render because the provider recreates its context value object every render, but relying on that is fragile; reading `pieces` directly is the explicit single source of truth.

**How to apply:** `getPiece(id)` is fine for one-shot, non-rendered reads — e.g. initializing a form's local `useState` at mount (the edit screen does this intentionally; the form's local copy is legitimate edit state, not a stale-render source). It is NOT fine for values shown on screen that must track live updates.

## Badge rendering
`PotteryCard` renders the badge only when `showVisibility` is set (collection detail passes it). It shows both states: lock+"Private" when `visibility==="private"`, globe+emerald "Public" when `"public"`. Don't render only one state — an absent badge reads as ambiguous.
