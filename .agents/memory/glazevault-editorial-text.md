---
name: GlazeVault editorial read-more text
description: Shared ExpandableText for statement/collection descriptions, and why clampability is estimated not measured.
---

# Editorial read-more (ExpandableText)

`components/ExpandableText.tsx` is the single read-more used for the public
artist statement and for collection descriptions (public portfolio + owner
collection page). Preview clamps to `collapsedLines`, expands INLINE (no nav);
when expanded and the source has blank-line-separated paragraphs it renders them
with paragraph spacing.

- **Decide "is it clampable" from a newline-aware line ESTIMATE, never from
  measured layout.** **Why:** react-native-web does not fire `onTextLayout` (and
  jest-expo doesn't either), so a measure-only approach leaves long text clamped
  with NO "Read more" control on the web/canvas target. A plain char-count
  threshold also fails for statements written with many short MANUAL line breaks
  — count each `\n` plus soft-wrap per segment. `onTextLayout` is kept only to
  refine the estimate on native. **How to apply:** any future clamp/expand UI on
  this app must gate the toggle on the estimate; treat web as the default target.
- **Reset `expanded`/`clampable` on a `[text, collapsedLines]` effect** so a
  recycled row or navigation between collections never keeps stale toggle state.

# Portfolio voice / labels

- The immersive collection entry button is **"View Exhibition"** (not "View as
  gallery") on both owner and public surfaces — the experience is framed as an
  exhibition/monograph, not a generic image gallery.
- The artist statement is **left-aligned, regular serif** (PlayfairDisplay
  Regular, NOT italic) with a short preview — the prior centered-italic wall read
  as too dense. Text is meant to feel secondary/discoverable; artwork leads.
