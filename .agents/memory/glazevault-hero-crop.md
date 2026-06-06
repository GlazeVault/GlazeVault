---
name: GlazeVault hero crop/reposition geometry
description: The two-coordinate-model invariant tying HeroImage rendering to the HeroReposition editor; break one side and saved crops render wrong.
---

# Hero crop = {heroFocalX, heroFocalY, heroZoom}

A hero crop is persisted as three scalars on `ArtistProfile`: `heroFocalX` (0..1), `heroFocalY` (0..1), `heroZoom` (>=1). Stored in `profiles.hero_focal_x/hero_focal_y/hero_zoom` (defaults 0.5/0.5/1). Applied identically on the owner landing (`app/(tabs)/index.tsx`), public page (`app/[slug]/index.tsx`), and editor previews (`profile.tsx`) — all go through `ArtistHero` → `HeroImage`.

## The invariant (the crux — do not break)

There are TWO different rendering models that MUST stay algebraically equivalent for the same saved crop:

- **HeroImage** (`computeHeroLayout`): lays the image at rendered size `(W0*zoom, H0*zoom)` with a **top-left** translate: `translateX = -focalX*overflowX`, `translateY = -focalY*overflowY`, where `overflowX = W0*(zoom-1)`, `overflowY = H0*zoom - frameH`.
- **HeroReposition** (the editor): lays the image at base size `(W0, H0)` with a **center-origin scale** `s` plus translate `(tx, ty)`. Effective top-left = `(tx - (s-1)W0/2, ty - (s-1)H0/2)`.

These coincide exactly only because the re-seed effect uses `tx = W0*(s-1)*(0.5-focalX)`, `ty = (s-1)H0/2 - focalY*(H0*s-frameH)`, and `handleDone` is their exact algebraic inverse. Architect-verified equivalent.

**Why:** if you change ONE side's coordinate model (e.g. switch HeroImage to a center-origin transform, or change the editor's translate origin) without updating the re-seed + handleDone inversion in lockstep, the editor preview and the actual rendered hero will silently disagree — the artist's chosen crop won't match what ships.

**How to apply:** treat `computeHeroLayout`, HeroReposition's re-seed effect, and `handleDone` as one unit. Any edit to one requires re-deriving the other two. Guard with `__tests__/hero-image-layout.test.ts` (covers the layout side); a round-trip test for the editor equations would be the natural next guard.

## Clamp bounds (cover the frame)
Pan/pinch clamp to `tx ∈ [-mx, mx]` with `mx=(s-1)W0/2`; `ty ∈ [tyMin, tyMax]` with `tyMax=(s-1)H0/2`, `tyMin=frameH - H0*(1+s)/2`. These are exactly the bounds that keep the scaled image covering the frame on both axes. Web zoom uses +/- buttons (no pinch with a mouse); `touchAction:'none'` + `draggable={false}` stop native drag-ghosting.
