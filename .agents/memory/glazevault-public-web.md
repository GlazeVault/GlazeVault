---
name: GlazeVault public web exhibition pages
description: How shareable public links resolve as real web pages, and the gating/readiness rules that keep private content unreachable.
---

# GlazeVault public web exhibition pages

Share links (`/{slug}`, `/{slug}/collection/{id}`, `/{slug}/piece/{id}`) resolve as
expo-router web routes served BY THE EXPO WEB APP itself.

**Why served by expo, not a separate server:** the main reverse proxy root `/` and
ALL arbitrary single-segment paths (`/anything`) are a CATCH-ALL to the expo web app.
Only literal prefixes claimed in an artifact's `artifact.toml` (e.g. `/api`) route
elsewhere. So bare `/{slug}` vanity URLs can ONLY be served from inside the expo app —
no new server, no proxy/toml change is possible for this URL shape.

## Structure
- Each live route is a THIN GATE that verifies public visibility BEFORE rendering, then
  reuses existing public presentation (`PublicSiteScreen` with `live`/`onlyCollectionId`
  props; piece detail via `?public=1`). No duplicated rendering logic.
- Gate verdicts use `PublicGate.tsx`: `usePublicReady()` + `<PublicLoading>` + `<PublicMissing>`
  ("Not on view" — deliberately non-committal, never reveals whether content exists).

## Readiness (avoid the not-on-view flash)
A public visitor arrives with an EMPTY cache, so contexts hydrate from Supabase async.
`usePublicReady()` waits for ALL THREE stores' `hydrated` flag (Profile/Collections/Pottery
each flip it once their initial cache+Supabase load settles), with a safety timer fallback.
**Why all three, not "any data arrived":** the old heuristic flashed "Not on view" on a
valid link when one store (e.g. pieces) hydrated before the profile that supplies the slug.

## Gating rule (the important one)
Private content must NEVER resolve publicly. Real guarantee = `isPubliclyVisiblePiece` /
`isCollectionPublic` + `publicSite.enabled` + slug match, ALL checked at the live route.
Shared links always use the gated `/{slug}/...` route. The bare `/piece/{id}?public=1` is
an INTERNAL owner-preview URL (also the redirect target) — it never leaks a PRIVATE piece
(still `isPubliclyVisiblePiece`-gated) but it does not re-check `publicSite.enabled`; that
residual is acceptable under the documented client-gating posture (anon-key + permissive
RLS; true RLS hardening is a tracked future follow-up).

## Live chrome
`PublicSiteScreen` `live` prop drops the owner-only back button + "Preview" pill (a visitor
has no back stack and it isn't a preview); share stays. `onlyCollectionId` switches the
hero eyebrow to "Exhibition" and sources pieces via `getPublicCollectionPieces`.

## Domain
URL host is env-driven via `resolvePublicOrigin()` in ProfileContext
(`EXPO_PUBLIC_PUBLIC_SITE_URL` → `EXPO_PUBLIC_DOMAIN`→https → `glazevault.art` fallback).
Custom domain (glazevault.art) is connected at DEPLOY time; user sets the env var after.
