---
name: GlazeVault public web exhibition pages
description: How shareable public links resolve as real web pages, and the provider/gating rules that keep private content unreachable across accounts.
---

# GlazeVault public web exhibition pages

Share links (`/{slug}`, `/{slug}/collection/{id}`, `/{slug}/piece/{id}`) resolve as
expo-router web routes served BY THE EXPO WEB APP itself.

**Why served by expo, not a separate server:** the main reverse proxy root `/` and
ALL arbitrary single-segment paths (`/anything`) are a CATCH-ALL to the expo web app.
Only literal prefixes claimed in an artifact's `artifact.toml` (e.g. `/api`) route
elsewhere. So bare `/{slug}` vanity URLs can ONLY be served from inside the expo app —
no new server, no proxy/toml change is possible for this URL shape.

## Cross-account remote fetch (the current model)
Once auth landed, public links must show ANY artist's public archive to a DIFFERENT
signed-in artist or an anonymous visitor — not the local (owner) contexts. So each
`[slug]` route wraps `<PublicArtistProvider slug={slug}>` which REMOTELY fetches that
one artist's public data from Supabase by slug:
- `loadPublicProfileBySlug` — fetches RLS-visible profiles and matches `public_site.enabled`
  + derived `publicSiteSlug(name)`. There is NO persisted unique slug column, so it orders
  by `created_at ASC` and takes the first match → resolution is DETERMINISTIC (earliest
  artist wins on a name collision). A true unique-slug column is a follow-up.
- `loadPublicPiecesForUser` / `loadPublicCollectionsForUser` — `eq user_id`, then filter
  `isPubliclyVisiblePiece` / public collections.

`usePublicArtist()` exposes `status` (`loading|ready|missing`) + profile/pieces/collections.
`usePublicArtistOptional()` returns the context when inside a provider, else null.

## Gating (each [slug] route is a THIN gate)
Render `<PublicLoading>` while `status==='loading'`; render `<PublicMissing>` ("Not on view",
deliberately non-committal) when `status==='missing'`, `!profile.publicSite.enabled`, or the
specific piece/collection isn't found / fails `isPubliclyVisiblePiece` / `isCollectionPublic`.

## Foyer structure (the slug ROOT is a foyer, not the portfolio)
`[slug]/index` is a public FOYER (ArtistHero + 3 EntranceCards) mirroring the in-app home
foyer — it does NOT render the portfolio directly anymore. The three doorways are their own
routes (all registered in `_layout.tsx`, all wrapped in their own PublicArtistProvider):
- `[slug]/portfolio` → `<PublicSiteScreen live backHref={/${slug}}/>` (the OLD `[slug]/index`
  behavior; PublicSiteScreen gained an optional `backHref` → shows a back arrow in live mode,
  `canGoBack?back:replace(backHref)`).
- `[slug]/collections` → calm list of PUBLIC collections only (`isCollectionPublic` +
  `getPortfolioCollectionPieces` + `resolveGatedCover`, drop empty), cards open existing
  `[slug]/collection/{id}`.
- `[slug]/archive` → grid of EVERY public piece (provider pieces are already
  `isPubliclyVisiblePiece`-filtered; project via `toPublicPiece`), tiles open existing
  `[slug]/piece/{id}`. Orientation-aware NO-CROP layout (buildOrientationRows + always
  `contentFit="contain"`, never cover — cover crops; covers are the only crop exception).
Collection/piece detail routes are unchanged. Owner foyer & piece share links untouched.

**Dual-source switch:** `public-site.tsx` and `app/piece/[id].tsx` call
`usePublicArtistOptional()` — when a provider is present they render from the REMOTE public
context; otherwise they fall back to local owner contexts (owner's own in-app preview). Owner
preview navigates `/piece/{id}?public=1` (private route a signed-in owner can reach); live
public nav goes to `/{slug}/piece/{id}` (the guard treats `[slug]` as anon-allowed).

**Do NOT** redirect public routes to `/piece/...` — the auth guard bounces anonymous visitors
off private routes. `PublicGate.tsx` now only exports `PublicLoading`/`PublicMissing`
(the old `usePublicReady()` 3-context-hydration readiness gate is GONE — superseded by the
provider's `status`).
