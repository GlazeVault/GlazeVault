---
name: GlazeVault context reactivity (getPiece vs pieces)
description: Why screens that must reflect live piece changes must read the reactive `pieces` list, not the getPiece ref-read
---

# Reactive source of truth for pieces

`PotteryContext` keeps both `const [pieces, setPieces]` (reactive state) and `piecesRef.current` (a mirror used so update callbacks have stable deps and never close over stale state). `getPiece(id)` reads `piecesRef.current` — a **ref**, so it is NOT reactive on its own.

## Rule
Any screen that must visually reflect the latest piece data (e.g. a visibility badge, a toggle's on/off state) must derive the piece from the reactive list: `const { pieces } = usePottery(); const piece = pieces.find(p => p.id === id)`. Do not use `getPiece(id)` for rendered, must-stay-fresh values.

**Why:** A stale-badge bug — a piece set Public in Piece Detail still showed a "Private" badge in Collection detail. Piece Detail had read `getPiece(id)`. It happened to re-render because the provider recreates its context value object every render, but relying on that is fragile; reading `pieces` directly is the explicit single source of truth.

**How to apply:** `getPiece(id)` is only safe when the piece is GUARANTEED already loaded at mount AND you read it exactly once. It is NOT safe on a route that can be cold-loaded / reloaded / deep-linked: on a cold load the archive hasn't hydrated, `getPiece` returns undefined, and because it's a ref the component never re-renders when data arrives → blank screen (this blanked the edit screen). Read from the reactive `pieces` list and, if you need form `useState` initialized from the piece, gate the form behind a child that mounts only once the piece exists (show a loader otherwise) so the initializers always get real values. Never pair a missing-piece check with an eager `router.back()` at the top of such a screen — it fires during the load race and bounces you out before data arrives.

## Badge rendering
`PotteryCard` renders the badge only when `showVisibility` is set (collection detail passes it). It shows both states: lock+"Private" when `visibility==="private"`, globe+emerald "Public" when `"public"`. Don't render only one state — an absent badge reads as ambiguous.
