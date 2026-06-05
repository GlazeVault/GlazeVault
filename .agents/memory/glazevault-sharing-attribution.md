---
name: GlazeVault sharing & attribution
description: How public sharing builds its payload and preserves original-artist attribution.
---

# GlazeVault sharing & attribution

Sharing other artists' public work reuses ONE path — `ShareSheet` (native OS
share + copy-link) fed by `buildShareContent` (piece) / `buildLinkShareContent`
(collection, portfolio) in `constants/privacy.ts`. Sharing is NOT reposting:
there is no repost feed, reshare count, like metric, or duplication into the
sharer's profile — a share is a public link that opens the ORIGINAL artist's
public page (`pieceShareUrl`/`collectionShareUrl`/`portfolioShareUrl`).

**Attribution rule:** every share carries `buildAttributionHeadline(title,
artistName)` → `"{Title} — {Artist} on GlazeVault"`, collapsing to
`"{Title} on GlazeVault"` when the title IS the artist (portfolio) or no artist
is passed. The headline is `ShareContent.headline` and is used as the native
share title/subject and the first line of `message`. Callers pass `profile.name`
as the artist (single-artist app: all renderable public content is the local
profile).

**Why:** the product brief requires shared previews to read like recommending an
exhibition with the original artist preserved, e.g. "Memory of Clay — Sang-Jeong
Lee on GlazeVault" — never an anonymous link, never a repost.

**How to apply:**
- Any new share call site must pass `artistName` (4th arg of the link builder /
  3rd arg of the piece builder) or attribution silently drops.
- Privacy is unchanged: the piece is still projected through `toPublicPiece`
  first, so glaze/cone/firing/notes never reach a share even if a piece opted
  them into its public VIEW. Share affordances stay gated to public surfaces.
- Link-preview IMAGE is a function of the public page's OpenGraph tags (the URL),
  NOT the RN `Share.share` call — don't try to attach an image to the share.
