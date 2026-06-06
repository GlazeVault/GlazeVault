---
name: GlazeVault shared landing hero
description: The owner app-entry and public page share ONE ArtistHero first-impression component
---

The owner's app-entry screen (the Archive tab, `app/(tabs)/index.tsx`) and the
public shared page (`app/public-site.tsx`) lead with the SAME calm first
impression via the shared `components/ArtistHero.tsx`: one large hero image at
its TRUE proportions (contain, no crop, natural ratio from useImageOrientations,
height clamped to ~0.78 * window), then the artist name, then ONE optional line
(tagline / collection title) that is hidden when empty/whitespace.

**Why:** user explicitly asked both screens to "feel the same" and that the
Archive grid must NOT be the first thing seen on app open.

**How to apply:**
- ArtistHero takes `pullUp` (negative top margin to bleed to the top edge) and
  `bleed` (negative horizontal margin to span past parent padding). Public site
  passes bleed=28 (scroll padding 28); owner index passes bleed=15 (FlashList
  contentContainer paddingHorizontal 15) and renders the hero as the
  `ListHeaderComponent`, so the Archive grid sits below the fold.
- The optional second line is resolved by the CALLER (public: collection title
  on a single-collection page else tagline; owner: tagline) and passed in raw;
  ArtistHero trims and omits when empty.
- Keep the two in lockstep — change the hero look in ArtistHero, not per-screen.
