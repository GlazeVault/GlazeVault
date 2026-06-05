---
name: GlazeVault public-site signature layout
description: There is ONE public-site layout (no mode selector); how its monograph flow works
---

# Public-site signature layout (single, no modes)

The public portfolio has exactly ONE layout — there is NO `homepageLayout` /
mode selector. `app/public-site.tsx` `renderPieces` is the only renderer.

The signature "monograph flow":
- Portrait/square pieces flow in TWO columns, packed shortest-column-first by
  estimated height (1/ratio), so heights stagger gently → calm organic rhythm.
- Column tile box ratio is CLAMPED to a calm band (~0.72–1.05) via `renderTile`
  `span="half"`; image stays `contentFit="contain"` (never cropped) so clamping
  only adds subtle matting on extremes — keeps asymmetry subtle, not chaotic.
- Landscape pieces (`isLandscapeRatio`) lift OUT into full-width exhibition
  "plates" (`span="full"`, true wide ratio) that punctuate the column flow.
- Spacing is deliberately generous (`galleryWrap`/`galleryCol` gap ~34) for a
  quiet, premium gallery feel.

**Why:** the earlier Catalog/Masonry/Editorial mode toggle was removed — the
difference between modes was too subtle to justify and diluted product identity.
The user wanted one signature layout: calm, curated, editorial, museum-like,
image-first; catalog clarity + art-book rhythm; no Pinterest chaos, no rigid
ecommerce grid.

**How to apply:** do NOT reintroduce layout modes or a selector. Keep the no-crop
principle (contain everywhere); the calm clamp + landscape full-width plates are
the levers for rhythm. `PublicSiteSettings` no longer has `homepageLayout`;
`normalizeProfile` whitelist drops any legacy stored value.
