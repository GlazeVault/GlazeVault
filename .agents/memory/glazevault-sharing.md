---
name: GlazeVault sharing model
description: How piece/collection/portfolio sharing works and how private content is kept unshareable.
---

# GlazeVault sharing (in-app MVP)

Sharing = "sending someone to a quiet exhibition", never a social broadcast.

## Shape
- ONE slim `ShareSheet` with exactly two actions: "Share…" (native `Share.share`) and "Copy link" (`expo-clipboard`). No social/commerce platform grid (that was the old fake UI — do not reintroduce).
- All public URLs are centralized in `ProfileContext`: `publicBaseUrl` / `portfolioShareUrl` / `collectionShareUrl` / `pieceShareUrl`, all fully-qualified `https://glazevault.art/{slug}/...`. Build share links ONLY from these — never hand-concatenate `PUBLIC_SITE_DOMAIN` (that yields scheme-less, non-tappable links).
- Two content builders in `constants/privacy.ts`: `buildShareContent` (pieces — projects through `toPublicPiece`/`buildPublicMetaLine`, so no owner-only field leaks) and `buildLinkShareContent` (collection/portfolio — title + optional subtitle + url, no piece projection).

## Privacy gating (the rule)
**A private piece, private collection, or unpublished portfolio must never construct a share payload or link** — gate BOTH the affordance AND the `ShareSheet` mount, not just the button.
- Piece: gate on `isPublic` / `isPubliclyVisiblePiece`; owner viewer per-photo `share` is `undefined` for non-public pieces (ImageViewer guards `current?.share`).
- Collection: gate on `isCollectionPublic(collection)`.
- Portfolio: gate on `site.enabled`.

**Why:** archive-first product promise — a private studio archive can't accidentally emit a working public link. Affordance-only gating still leaves a built URL in props/state; the architect flagged this, so we also conditionally mount the sheet.

## Public web exhibition pages (built)
Share links now resolve as real web routes served BY THE EXPO WEB APP itself — see `glazevault-public-web.md`. OG preview/social cards are still deferred.

## Tests
Any test that renders piece/collection/profile/public-site must mock `@/context/ProfileContext` INCLUDING the URL helpers (`publicBaseUrl`, `portfolioShareUrl`, `collectionShareUrl`, `pieceShareUrl`) or the screen throws "x is not a function" at render.
