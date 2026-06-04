---
name: GlazeVault editorial read-more text
description: Shared ExpandableText for statement/bio/collection descriptions and why its preview is computed, not clamped.
---

# Editorial read-more (ExpandableText)

One shared component drives every long-text field: the public artist statement,
the artist bio, and collection descriptions (public portfolio + owner collection
page). Preview is short, expands INLINE (no nav/modal); blank-line paragraphs get
spacing.

- **The preview is COMPUTED to end at a clean boundary — never clamped mid-word.**
  **Why:** the user's hard requirement is no awkward cuts ("I realize ho…").
  CSS line-clamp / `numberOfLines` truncates mid-word and (on web) needs
  `onTextLayout`, which react-native-web never fires. **How to apply:** cut at the
  last sentence/paragraph boundary that fits a line-budget estimate; fall back to
  a whole-word cut (then show "…") only for a single over-long opening sentence;
  hard-cut a length only for an unbreakable token with no word boundary.
- **Keep `numberOfLines={collapsedLines}` as a hard HEIGHT cap on the collapsed
  preview** even though the cut is computed. **Why:** the line estimate is
  fixed-width and undershoots for CJK glyphs / large fonts / long tokens, which
  would otherwise render a too-tall preview. Do not remove it again.
- Boundaries include CJK terminal punctuation (。！？), and an abbreviation
  denylist + lowercase-follow heuristic keep "Dr.", "U.S.", "e.g." from reading
  as sentence ends. **Why:** this is a Korean-artist app, so CJK + clean prose
  cuts matter. Residual, accepted: "Dr." before a name not on the denylist.

# Portfolio voice / labels

- Immersive collection entry button is **"View Exhibition"** (not "View as
  gallery") on owner + public surfaces — framed as an exhibition, not a gallery.
- Statement AND bio are **left-aligned, regular serif** (PlayfairDisplay Regular,
  not italic/centered) — long-form reads as secondary to the artwork.
