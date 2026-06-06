---
name: GlazeVault deploy env inlining
description: Why production public pages broke ("Not on view") while dev worked — Expo export build lacks workspace Secrets.
---

# Deployment build does not get workspace Secrets

`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read at **bundle time** by `supabase.ts` and inlined into the static web bundle. The Replit production `expo export` build runs WITHOUT the workspace Secrets/shared env vars in its environment, so it inlined empty strings → `isSupabaseConfigured` was false in production → `PublicArtistContext` status="missing" → every public page (`/[slug]`, `/[slug]/portfolio`) rendered the "Not on view" gate. Dev worked fine because the Expo dev workflow DOES get the env.

**Fix:** a committed `artifacts/mobile/.env.production` holding both PUBLIC `EXPO_PUBLIC_*` values. Expo loads `.env.production` during `expo export` (log line `env: load .env.production`). dotenv uses `override:false`, so it never shadows a real `process.env` value — dev is unchanged; it only fills the gap in the credential-less deploy build.

**Why:** confirmed via build logs (latest successful build ran `expo export` but produced a bundle with neither the Supabase URL host `fvwvrjeqnenqejhnsbro` nor the `sb_publishable_` anon key), and a local `expo export` WITH env present DID inline them. So the gap is the build environment, not the code — the app's visibility/routing logic is correct.

**How to apply:** never assume Secrets reach a static-export production build. For any `EXPO_PUBLIC_*` value that must survive deploy, put it in `.env.production` (these are public-by-design, already shipped to every browser). `.gitignore` ignores `.env` and `.env*.local` but NOT `.env.production`. After editing, re-publish so the build re-inlines.
