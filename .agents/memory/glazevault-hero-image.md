---
name: GlazeVault hero image
description: How the landing/portfolio hero image works and why it is modeled separately from the avatar.
---

# Hero image (landing entrance)

`heroImageUri` + `heroFocalY` (default 0.5) on ArtistProfile are FULLY independent
of `avatarUri` (the small round profile photo). Editing one never touches the other.

**Why:** the hero is the "exhibition entrance" image; the avatar is the artist
portrait. The user explicitly wanted them decoupled. There is NO display fallback
between them — only a one-time DB backfill seeds an existing artist's hero from
their avatar at migration time.

**How to apply:**
- Reposition = vertical focal point only (`HeroReposition` drag → focalY), never a
  crop/aspect tool. `computeHeroLayout(width, ratio, maxHeight, focalY)` in
  `components/HeroImage.tsx` is the SOLE pure layout function (contain when it fits;
  cover + clamped vertical translateY when taller). Keep it pure + unit-tested.
- Hero and avatar each upload SEPARATELY (dataService); fold BOTH saved URLs back
  into the cache in `ProfileContext.updateProfile`.
- The "optional line" under the name on the landing is the existing `tagline`
  field (hidden when empty), not a new field.
