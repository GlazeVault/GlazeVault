---
name: GlazeVault public profile loader / "Not on view"
description: Why anon public links broke, and the invariant that keeps them working.
---

# Public-by-slug loaders must not query columns the live table lacks

`loadPublicProfileBySlug` (dataService) resolves an artist by their name-derived
slug for anonymous visitors. The live `profiles` table has **no `created_at`
column** (pieces and collections DO). Ordering the profiles query by
`created_at` server-side returns a PostgREST **400 (42703 column does not
exist)**.

**Why this is catastrophic, not cosmetic:** `PublicArtistContext` wraps the
whole public fetch in one try/catch and maps *any* error to
`status="missing"`. So a single failing query collapses EVERY anonymous public
page — profile, collection, and piece links alike — to "Not on view", even
though the data and RLS are completely correct.

**Rule:** public-by-slug loaders must only reference columns that exist in the
deployed Supabase schema. Do deterministic tie-breaking (e.g. same-slug
collisions) by sorting **in memory** on a stable existing column (`user_id`),
never via `.order()` on a maybe-missing column.

**How to apply:** before adding any `.order()`/filter to a public loader, verify
the column exists in the live table (anon REST probe or schema.sql). Regression
locked by `__tests__/load-public-profile-by-slug.test.ts` (mock `.order()`
throws). Because `PublicArtistContext` swallows all errors into "missing",
transient/query failures are indistinguishable from genuine 404s — keep these
loaders strictly schema-safe.
