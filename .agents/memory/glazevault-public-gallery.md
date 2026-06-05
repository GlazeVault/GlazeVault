---
name: GlazeVault public piece-detail gallery
description: How the fullscreen swipe gallery is scoped on the public vs owner piece-detail page, and why.
---

# Public piece-detail gallery scoping

The fullscreen `ImageViewer` swipe set on the piece-detail page is scoped differently for public vs owner views.

- **Public view** (`?public=1`): the swipe set is built by the single shared
  selector `getPublicSwipePieces(piece, pieces, collections, from)`. It is scoped
  to the `from` collection the visitor entered from WHEN that collection is public
  (so swiping stays inside the exhibition they were browsing); otherwise it spans
  portfolio pieces sharing ANY public collection with the opened piece. Either way
  every sibling is gated by `isPortfolioPiece` (featured + public + collected +
  photo + not archived), so a private/archived/UNFEATURED piece is never reachable.
  A piece outside the curated portfolio swipes alone (`[piece]`). All public-site
  entry points (tile, cover, "View Exhibition" immersive) pass `from=<collectionId>`.
  Viewer captions are built via `buildPublicMetaLine`/`toPublicPiece` (clay·dims·year
  plus any opted-in glaze/notes) and name the `from` collection when present.
- **Owner view**: scope by the `from` collection param if present, else the whole archive.

**Why:** swiping is a back-door that can leak otherwise-hidden work AND a place
where curation can break — once the public portfolio became featured-only
(via `getPortfolioCollectionPieces`), the swipe set had to match it, so the
gate moved from `isPubliclyVisiblePiece` to the stricter `isPortfolioPiece`.
Scoping by `collectionId` alone is NOT enough (a public collection can contain
private/unfeatured pieces). `showPhotos` is NO LONGER a display gate (see below).

**How to apply:** any future change to the public detail gallery (or new public
surfaces that swipe across pieces) must go through `getPublicSwipePieces` /
`isPortfolioPiece`, never bare `collectionId` equality or `isPubliclyVisiblePiece`.
The selector is pure and unit-tested in `__tests__/portfolio-gate.test.ts` (scoping,
unfeatured exclusion, private-`from` fallback, multi-collection). The public hero is
itself a `Pressable` that opens the viewer; `ImageViewer` renders inside the public
return branch (separate render path from the owner branch).

## showPhotos is DEPRECATED as a display gate (public pieces always show their photo)
A public piece with a valid `imageUri` but `publicDataSettings.showPhotos=false`
used to render a blank placeholder on public surfaces (portfolio tile, public hero,
cover fallback) while Archive/Collection — which never gated on `showPhotos` — showed
it fine. **The rule now:** public surfaces render the image whenever `piece.imageUri`
exists; `showPhotos` is ignored for display. The "Photos" toggle was removed from
`PUBLIC_DATA_FIELDS`; `showPhotos` stays in the `PublicDataSettings` type+DEFAULT only
for Supabase round-trip (marked `@deprecated`). **Why:** a gallery with hidden photos
is just blank placeholders — the user reported this as a bug. **How to apply:** never
reintroduce `showPhotos` as a render/scope/cover gate; gate public photos by
`piece.imageUri` presence + `isPubliclyVisiblePiece`. Cover fallbacks pick the first
piece WITH an `imageUri` (`cp.find(p => p.imageUri)`), not the first with `showPhotos`.

## Public metadata = clay · dimensions · year ONLY (curated gallery subset)
The public meta line is built by the single shared helper `buildPublicMetaLine(piece)`
in `constants/privacy.ts`. It joins, with "  ·  ", ONLY `clay · dimensions · year`,
dropped if empty (`.filter(Boolean)`), e.g. "Stoneware · 12 × 12 × 14 in · 2025". There
are NO per-field public toggles anymore — the old `publicDataSettings`/`showClayBody`
model is RETIRED; the three core fields are ALWAYS shown for a public piece. Glaze
details (glaze + cone + firingEnvironment) and studio notes are the ONLY public extras,
each a per-piece opt-in (`showGlazeDetails`/`showStudioNotes`, default OFF) rendered as
their own elements on the public piece view — NOT in this meta line (see
glazevault-privacy.md). EVERY public surface calls this one helper: the public detail
line (`publicMeta` in piece/[id].tsx isPublicView), the fullscreen `ImageViewer` caption,
and the public-site portfolio cards (`renderCaption`/`renderTile` in public-site.tsx).

**Why:** this requirement has PING-PONGED — curated subset → toggle-driven-all-fields →
back to curated. The CURRENT and authoritative rule is the curated `clay·dim·year`
subset: the user wants a gallery-like portfolio with technical data kept private. A
piece with only glaze/cone/firing populated (e.g. an old "Mug") will now show just its
title publicly — that is INTENDED, not a bug. Do not "fix" it by re-adding technical
fields to the public line.

**How to apply:** the per-field public-toggle UI (`PUBLIC_DATA_FIELDS`,
`showAllPublicDetails`, and the full `PublicDataSettings` blob/type) has been RETIRED
along with the `public_data_settings` column. Public exposure is now: always-public core
(title + clay·dim·year) PLUS the two independent per-piece opt-ins `showGlazeDetails`
(glaze+cone+firingEnvironment) and `showStudioNotes` (notes), both typed boolean columns,
default OFF, enforced solely by `toPublicPiece` (see glazevault-privacy.md). The owner
`/collection/[id]` view is NOT a public surface — it shows the owner's full data.

## Public-site portfolio cards carry the same whispered caption
The public-site portfolio tiles (`renderTile` in public-site.tsx) render a caption
BENEATH each image — serif title (PlayfairDisplay) + the same `clay · dimensions ·
year` line built via the shared `buildPublicMetaLine` helper (see the toggle-driven
section above). There is now ONE signature layout (no catalog/editorial/masonry
modes — see glazevault-public-layouts.md). The earlier "silent cards" pass removed
all text; this restored minimal artwork identity.

**Why:** image-only cards read as too anonymous/atmospheric; a quiet exhibition-
catalog caption gives archival presence without a database/card-UI feel.

**How to apply:** the data field is `clay` (NOT `clayBody` — that name only exists
as the `showClayBody` flag). Tiles are a column: `Pressable(tileCol) > tileImage box
(absoluteFill Image) > caption`. Tile styles are split into a wrapper/layout style
(flex/width/margin, e.g. `catalogLargeCol`) and an image-box style (aspectRatio, e.g.
`catalogLargeImg`); keep that split when adding tile variants or the caption width
won't match the image. The local `PublicPiece` interface must list any piece field
the caption reads (objects are full PotteryPiece cast by `getPublicCollectionPieces`).

## Public homepage is COLLECTION-DRIVEN (no standalone "Selected Works" feed)
The public site flows Artist Header → public collections directly; there is NO
separate curated "Selected Works" piece feed. Each public collection is a mini
exhibition with an IMAGE-FIRST editorial order: index eyebrow → title → piece
count → hero cover → intro/description preview → works grid. `hasContent` =
`publicCollections.length > 0`.

**Why:** a standalone curated feed duplicated artwork (a piece showed in Selected
Works AND inside its collection), which read as repetitive/noisy. Collections now
carry the storytelling. The description sits BELOW the hero (not above) so the
viewer emotionally enters through the image first, then reads — an exhibition-
catalog feel. Do not move the intro back above the hero.

**How to apply:** there is still NO standalone "Selected Works" piece feed
(a regression test in __tests__/public-privacy.test.tsx asserts this). BUT the
public homepage IS now curated/featured-only at the COLLECTION level:
each public collection shows only its `getPortfolioCollectionPieces` (gated by
`isPortfolioPiece`), and a public collection with zero featured pieces is dropped
entirely. So `isPortfolioPiece` is NOT owner-only anymore — it gates every public
portfolio surface (collection grid, profile preview, swipe set). Do not reintroduce
a flat cross-collection portfolio feed, and do not "downgrade" public surfaces back
to `isPubliclyVisiblePiece` (that would expose public-but-unfeatured pieces).

## Public-site editorial portrait hero (top of public portfolio)
The public site opens with a large, full-bleed studio PORTRAIT hero (replaced the
small circular avatar masthead): `portraitWrap` cancels the scroll's horizontal
padding (`marginHorizontal:-28`) and pulls up under the floating buttons
(`marginTop:-(topPad+64)`); height is viewport-driven
(`max(440, min(winHeight*0.62, 640))`). The avatar Image fills via
`StyleSheet.absoluteFill` + `contentFit="cover"`; a `LinearGradient`
(`transparent→transparent→colors.background`, locations `[0,0.5,1]`) dissolves it
into the page; caption (eyebrow "Portfolio" + serif name + URL) sits in the fade.
**Why:** the brief was "artist monograph / gallery publication, not a profile
header" — enter the artist's world before the work. **How to apply:** reuses the
existing `profile.avatarUri` (no new portrait field/DB column); the gradient end
color MUST equal `colors.background` or the melt shows a seam. Don't reintroduce
the circular avatar.
