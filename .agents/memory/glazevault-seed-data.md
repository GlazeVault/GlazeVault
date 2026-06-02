---
name: GlazeVault seed data
description: Rules for the seeded sample piece so demo content never masquerades as user data.
---

- Seed pieces (e.g. `seed-blue-mug`) must NOT carry fabricated/AI-style prose in **editable** fields (especially `notes`). Such text loads into the Edit form via `useState(piece?.notes ?? "")` and looks like the user wrote it.
  - **Why:** users reported the Edit "Notes" field showing AI prose they never typed — it was baked into the seed's saved `notes`.
  - **How to apply:** keep seed `notes: ""`; short factual metadata (clay/glaze/cone) is fine. The Edit form is correct — the bug is always in the seed data, not the form.
- Already-stored seed data is cleaned in-memory on load inside `normalizePiece`, gated on seed fingerprint (`id === "seed-blue-mug"` AND `imageUri === "@seed/blue-mug"`) AND a verbatim text match, so genuine user notes are never cleared. Cleanup is idempotent and not re-persisted.
