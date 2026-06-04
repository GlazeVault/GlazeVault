---
name: GlazeVault public piece-detail gallery
description: How the fullscreen swipe gallery is scoped on the public vs owner piece-detail page, and why.
---

# Public piece-detail gallery scoping

The fullscreen `ImageViewer` swipe set on the piece-detail page is scoped differently for public vs owner views.

- **Public view** (`?public=1`): the gallery must include ONLY siblings that are
  `isPubliclyVisiblePiece(p, collections)` **AND** have an image (`!!p.imageUri`),
  restricted to the same `collectionId`. A piece with no collection = `[piece]` only.
  Viewer captions must honor each piece's own `publicDataSettings` (`showTitle`,
  `showClayBody`, `showGlazeName`) — not the owner's raw fields.
- **Owner view**: scope by the `from` collection param if present, else the whole archive.

**Why:** swiping is a back-door that can leak otherwise-hidden work. Scoping by
`collectionId` alone is NOT enough — a public collection can contain private pieces;
those are excluded by `isPubliclyVisiblePiece`. `showPhotos` is NO LONGER a display
gate (see below) — a public piece always shows its photo — so the swipe set keys off
`imageUri` presence, not `showPhotos`.

**How to apply:** any future change to the public detail gallery (or new public
surfaces that swipe across pieces) must filter through `isPubliclyVisiblePiece`
(+ `imageUri`), never bare `collectionId` equality. The public hero is itself a
`Pressable` that opens the viewer, and `ImageViewer` is rendered inside the public
return branch (it is a separate render path from the owner branch).

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
each still gated by its own `publicDataSettings` toggle (`showClayBody`/`showDimensions`/
`showYear`) and dropped if empty (`.filter(Boolean)`), e.g. "Stoneware · 12 × 12 × 14 in
· 2025". Technical/firing fields (glaze name + recipe, cone, firing environment, firing
notes, price) are **never** shown on any public surface — they live only on the owner's
private studio record (the owner `piece/[id]` InfoRows). EVERY public surface calls this
one helper: the public detail line (`publicMeta` in piece/[id].tsx isPublicView), the
fullscreen `ImageViewer` caption, and the public-site portfolio cards (`renderCaption`/
`renderTile` in public-site.tsx).

**Why:** this requirement has PING-PONGED — curated subset → toggle-driven-all-fields →
back to curated. The CURRENT and authoritative rule is the curated `clay·dim·year`
subset: the user wants a gallery-like portfolio with technical data kept private. A
piece with only glaze/cone/firing populated (e.g. an old "Mug") will now show just its
title publicly — that is INTENDED, not a bug. Do not "fix" it by re-adding technical
fields to the public line.

**How to apply:** to keep the toggle UI honest, `PUBLIC_DATA_FIELDS` (the per-piece
public-toggle list rendered in piece/[id].tsx and edit/[id].tsx) is trimmed to only the
publicly-displayable fields: Title, Photos, Studio Notes, Clay Body, Dimensions, Year.
`PublicMetaPiece` and `showAllPublicDetails()` are kept in lockstep with this set; the
full `PublicDataSettings` TYPE still carries every key (defaults) so dataService round-
trips are unaffected. The owner `/collection/[id]` view is NOT a public surface — it
shows the owner's full data (with private badges) and must NOT be gated by
`publicDataSettings`.

## Public-site portfolio cards carry the same whispered caption
The public-site portfolio tiles (`renderTile` in public-site.tsx) render a caption
BENEATH each image — serif title (PlayfairDisplay) + the same `clay · dimensions ·
year` line built via the shared `buildPublicMetaLine` helper (see the toggle-driven
section above) — across all three layouts (catalog/editorial/masonry). The earlier
"silent cards" pass removed all text; this restored minimal artwork identity.

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

**How to apply:** `featuredInPortfolio` / `isPortfolioPiece` is now ONLY an owner-side
concept — the featured badge (components/PotteryCard.tsx) and the Feature-in-Portfolio
toggle (app/piece/[id].tsx). It does NOT drive any public homepage section. The
`getPortfolioPieces` selector was deleted (was only feeding the removed feed); do not
reintroduce a public portfolio-piece feed. A regression test in
__tests__/public-privacy.test.tsx asserts the public site renders no "Selected Works".
