---
name: GlazeVault status badge
description: Single shared icon-first status badge for pieces; one priority order across all owner surfaces
---

# Unified piece status badge

One shared `PieceStatusBadge` (in `components/StatusBadge.tsx`) is the ONLY status
indicator for a piece on owner surfaces (Archive grid, Collection works grid). It
derives state from the piece itself (no `published`/state props threaded in) and
renders icon-only (label via accessibility).

Singular priority order (calm, one badge at a time):
**archived → featured → public → private** mapped to **archive → star → globe → lock**.

**Why:** before this, each surface hand-rolled its own badge with inconsistent
icons/labels/colors (some icon+text, some globe/lock-only). Centralizing keeps the
visual language identical everywhere and prevents drift.

**How to apply:** any NEW surface that shows piece status must use
`PieceStatusBadge` — do not re-add inline globe/lock or icon+text badges. The
public Portfolio (`public-site`) intentionally shows NO per-piece status badge
(everything there is already public, so a badge would be noise).
