---
name: GlazeVault public landing top section
description: The calm, gallery-not-social contract for the public-site.tsx hero + identity block.
---

# Public landing top section (public-site.tsx)

The public artist landing top section is deliberately **calm/gallery, not social**:

- **Hero = one full-width image at its TRUE proportions, never cropped.** Measure
  the avatar's natural ratio via `useImageOrientations([avatarUri])`, set the frame
  `aspectRatio` to it with `contentFit="contain"` and a viewport `maxHeight` clamp
  (so an extreme portrait can't dominate — it letterboxes, never crops). No
  gradient, no overlay caption over the image.
- **Identity sits BELOW the hero:** artist name (always) + exactly ONE optional
  second line. Second line = collection title on a single-exhibition page
  (`onlyCollectionId`), otherwise `profile.tagline`. Render nothing when empty
  (trim + `? : null`).
- **No social clutter at the top.** Follow/Save (`inspireRow`) lives LOW — after
  the artist's bio/statement/links, just above the divider. No follower counts,
  no metrics, no eyebrow/URL label.

**Why:** product is record-first / archive-first; entering an artist's page should
feel like walking into a quiet exhibition, not a social profile.

**How to apply:** don't reintroduce crop (`cover`) on the hero, an overlay caption,
or top-of-page CTAs. `tagline` is the optional single-line identity field
(studio/motto/nickname) — wired end-to-end through ArtistProfile, dataService
ProfileRow mapping, supabase `profiles.tagline`, and the profile editor.
