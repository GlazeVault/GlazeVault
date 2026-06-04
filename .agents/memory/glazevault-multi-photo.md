---
name: GlazeVault multi-photo per piece
description: How a piece carries multiple photos with a chosen cover, and why public surfaces still show only one.
---

# Multi-photo per piece

A piece has `imageUri` (the cover/primary, backward-compatible accessor every old
reader keeps using) and `images: string[]` (the ordered full set that ALWAYS
includes the cover).

**`coalesceImages(imageUri, images)` (constants/imageStorage.ts) is the single
normalizer.** It is the only place that reconciles the two fields and must be
called at every boundary that produces a piece: cache load (`normalizePiece`),
remote row mapping (`rowToPiece`), and creation (`addPiece`). It drops empties,
fills an empty `images` from the cover, fills an empty cover from `images[0]`, and
guarantees the cover is a member of `images`.

**Why the public projection is unchanged:** multiple photos are an OWNER-only
feature. `toPublicPiece` (constants/privacy.ts) still exposes a single `imageUri`,
so a non-owner only ever sees one cover per public piece. This is what keeps the
privacy jest guard (`__tests__/public-privacy.test.tsx`) green without edits to
the allowlist. **How to apply:** never add `images[]` to the public projection or
to any public/share surface — that would leak owner-only photos.

**Owner viewer flattens, public viewer does not.** In `app/piece/[id].tsx` the
owner branch builds `viewerItems` as one entry PER PHOTO across in-scope pieces and
tracks `pieceStartIndex` (where the current piece's photos start) + `viewerStart`
(which photo was tapped). The public branch stays one-cover-per-piece. Keep these
two branches separate; do not unify them.

**Remote storage:** `pieces.image_urls text[]` mirrors `images`; `pieces.image_url`
remains the cover. `savePiece` coalesces, uploads ALL images in parallel, then
remaps the cover by index from the uploaded URLs. Schema lives in
`supabase/schema.sql` (idempotent `add column if not exists` + backfill from
`image_url`); it is applied manually via the Supabase SQL editor per SETUP.md —
the sandbox cannot reach the DB (direct host is IPv6-only; pooler secret rejects
the tenant).
