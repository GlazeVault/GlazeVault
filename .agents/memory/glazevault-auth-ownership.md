---
name: GlazeVault auth & per-user ownership
description: How real email/password accounts, per-user data scoping, and first-account legacy claiming work.
---

# GlazeVault auth & per-user ownership

Real Supabase email/password auth replaced the old single-artist/no-user model.

## Identity & data scoping
- `AuthContext` owns `userId` / `authReady`. `authReady` flips true ONLY after the
  session is resolved AND (for the first account) the legacy claim was attempted.
  **All data contexts (Pottery/Collections/Profile/Saved) must gate hydration on
  `authReady` and namespace their AsyncStorage cache key by `userId`**, and reset to
  empty on sign-out / account switch — otherwise one account's cache bleeds into another.
- `dataService` load/save/delete take `userId`, stamp `user_id`, and filter `eq user_id`.

## First-account legacy claim
First authenticated caller runs SECURITY DEFINER `claim_legacy_archive()`: it assigns all
null-`user_id` rows (incl. the old `'default'` archive) to that user, copies the `'default'`
profile, deletes it, and sets an `app_meta(legacy_claimed)` flag so later accounts start empty.
**Why:** the existing archive must survive the migration and belong to whoever signs up first.

## RLS (the security boundary — do not weaken)
Owner-all (`auth.uid() = user_id`) PLUS public SELECT for anon+authenticated:
pieces `is_public && !archived`; collections `visibility='public'`; profiles `public_site` enabled.
Grants: anon SELECT only; authenticated full. Storage: authenticated write, public read.
Public cross-account viewing relies on these public-SELECT policies (see
`glazevault-public-web.md`).

## Testing gotcha
Contexts that call `useAuth()` (e.g. SavedContext) break RTL tests that render the provider
bare. Mock `@/context/AuthContext` to `{ useAuth: () => ({ userId: "test-user", authReady: true }) }`
and namespace the expected storage key with that id. For manual A/B/C testing, DISABLE
Supabase "Confirm email".
