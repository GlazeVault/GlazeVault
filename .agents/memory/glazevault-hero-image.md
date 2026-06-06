---
name: GlazeVault hero image
description: How the landing/portfolio hero image works, why it is modeled separately from the avatar, and how its 2D crop (focalX/focalY/zoom) stays WYSIWYG.
---

# Hero image (landing entrance)

`heroImageUri` + a saved crop (`heroFocalY`, `heroFocalX` default 0.5, `heroZoom`
default 1) on ArtistProfile are FULLY independent of `avatarUri` (the small round
profile photo). Editing one never touches the other.

**Why:** the hero is the "exhibition entrance" image; the avatar is the artist
portrait. The user explicitly wanted them decoupled. There is NO display fallback
between them — only a one-time DB backfill seeds an existing artist's hero from
their avatar at migration time.

**How to apply:**
- `computeHeroLayout(width, ratio, maxHeight, {focalX,focalY,zoom})` in
  `components/HeroImage.tsx` is the SOLE pure layout function. The image is laid
  out at the frame WIDTH (imageWidth = width*zoom), height = baseHeight*zoom;
  translateX/Y = -focal*overflow (top-left convention). At zoom 1 + centered
  focal it is identical to the original calm behavior (fit-to-width, only tall
  overflow cropped → vertical-only). zoom>1 creates overflow on BOTH axes so the
  focal point can pan horizontally too. Keep it pure + unit-tested.
- Hero and avatar each upload SEPARATELY (dataService); fold BOTH saved URLs back
  into the cache in `ProfileContext.updateProfile`.
- The "optional line" under the name on the landing is the existing `tagline`
  field (hidden when empty), not a new field.
- A crop replays identically on every surface only because focal+zoom are
  normalized; differing frame aspect ratios (landing vs preview vs tool) still
  produce slightly different vertical windows — that is inherent, not a bug.

## Reposition tool: gesture-handler + reanimated (NOT PanResponder)

`HeroReposition` is a real pan + pinch crop tool built on
`react-native-gesture-handler` (`Gesture.Simultaneous(Pan, Pinch)`) + reanimated
shared values (scale, tx, ty), with a live `Animated.createAnimatedComponent(Image)`
preview. It replaced the old vertical-only PanResponder drag.

**Why the rewrite:** the prior focal-only drag disabled itself whenever the image
"fit" (landscape → zero overflow → nothing to drag), so users saw no effect.

**Critical gotchas:**
- The tool uses CENTER-origin transforms; HeroImage uses TOP-LEFT. The conversion
  must bridge them: `tx = W0*(s-1)*(0.5-focalX)`, `ty = (s-1)*H0/2 -
  focalY*(H0*s-frameH)`; inverse `focalX = 0.5 - tx/(W0*(s-1))`,
  `focalY = ((s-1)*H0/2 - ty)/(H0*s-frameH)` (W0=frame width, H0=image height at
  zoom 1). Both default to 0.5 when that axis has no overflow.
- Clamp so the image always covers the frame: `tx ∈ ±(s-1)W0/2`,
  `ty ∈ [frameH-(H0(1+s))/2, (s-1)H0/2]`. Reclamp tx/ty after any zoom change.
- `GestureHandlerRootView` MUST wrap the Modal content — gestures inside a RN
  `Modal` don't work otherwise (separate native view hierarchy).
- Web: pinch needs two pointers (trackpad pinch unreliable), so −/+ zoom buttons
  are the web zoom path; mouse drag covers pan. Set `cursor/touchAction:'none'/
  userSelect:'none'` + `draggable={false}` on the image so the page/native drag
  doesn't steal the gesture.
