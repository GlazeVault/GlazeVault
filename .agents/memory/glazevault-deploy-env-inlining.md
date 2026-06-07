---
name: GlazeVault deploy env inlining
description: Why production public pages broke ("Not on view") while dev worked — Expo export build lacks workspace Secrets.
---

# Deployment build does not get workspace Secrets

`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read at **bundle time** by `supabase.ts` and inlined into the static web bundle. The Replit production `expo export` build runs WITHOUT the workspace Secrets/shared env vars in its environment, so it inlined empty strings → `isSupabaseConfigured` was false in production → `PublicArtistContext` status="missing" → every public page (`/[slug]`, `/[slug]/portfolio`) rendered the "Not on view" gate. Dev worked fine because the Expo dev workflow DOES get the env.

**Committing `.env.production` is NOT enough** — `expo export` does NOT reliably auto-load it in the Replit deploy build. Verified: the file was committed and present at the deploy commit, yet the shipped bundle contained neither the URL host `fvwvrjeqnenqejhnsbro` nor the `sb_publishable_` key → `isSupabaseConfigured` false in prod.

**Fix that actually works:** the `build` script must SOURCE the file into the real env before exporting, so Expo's babel transform inlines `process.env.EXPO_PUBLIC_*`:
`set -a; if [ -f ./.env.production ]; then . ./.env.production; fi; set +a; … expo export …`
Confirmed: rebuilt bundle then contained both `fvwvrj` and `sb_publishable`. Dev is unaffected (dev uses the `dev` script + real Secrets, never `build`).

**How to apply:** for any `EXPO_PUBLIC_*` value that must survive a static-export deploy, (1) keep it in `artifacts/mobile/.env.production` (public-by-design; `.gitignore` ignores `.env` and `.env*.local` but NOT `.env.production`) AND (2) ensure `build` sources that file. Re-publish after editing. Verify by grepping `dist/_expo/static/js/web/*.js` for the project ref.
