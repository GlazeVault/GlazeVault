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

## No legacy/anonymous claim — every account starts EMPTY (removed)
The old SECURITY DEFINER `claim_legacy_archive()` + `app_meta` latch (handed all null-`user_id`
rows to whoever signed up first) was REMOVED — function call gone from bootstrap, function/table
dropped from `schema.sql` AND the live DB. New accounts now start completely empty; no
anonymous/demo/pre-auth data is ever inherited.
**Why:** for multi-account (alpha) use, auto-migrating unowned rows is a privacy/trust hazard —
a new account must never see another session's data. **Do not reintroduce any automatic
claim/migration of unowned rows.** (If a genuine pre-auth single-artist archive ever needs
recovering, do it as an explicit, one-off, owner-confirmed assignment — never automatic.)

## RLS (the security boundary — do not weaken)
Owner-all (`auth.uid() = user_id`) PLUS public SELECT for anon+authenticated:
pieces `is_public && !archived`; collections `visibility='public'`; profiles `public_site` enabled.
Grants: anon SELECT only; authenticated full. Storage: authenticated write, public read.
Public cross-account viewing relies on these public-SELECT policies (see
`glazevault-public-web.md`).

## Signup is email + password only (zero friction)
Signup deliberately collects ONLY email + password; `SignUpInput.name` is optional and
defaults to `""`. Name/website/instagram/avatar are NOT asked at signup — the artist adds
them later in the Profile tab. Empty name renders gracefully (`ArtistHero` → "Your Studio";
`ensureProfile` writes `name: ""`). **Why:** alpha onboarding must have no long forms /
usernames / questionnaire. Do not reintroduce profile fields into the signup screen.

## Testing gotcha
Contexts that call `useAuth()` (e.g. SavedContext) break RTL tests that render the provider
bare. Mock `@/context/AuthContext` to `{ useAuth: () => ({ userId: "test-user", authReady: true }) }`
and namespace the expected storage key with that id. For manual A/B/C testing, DISABLE
Supabase "Confirm email".
