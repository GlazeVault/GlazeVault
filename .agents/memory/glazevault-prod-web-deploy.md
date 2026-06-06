---
name: GlazeVault production web serving
description: How production serves the Expo WEB app (not the Expo Go QR page), and why the build/serve are shaped this way.
---

# Production serves the Expo WEB build, not Expo Go

**Rule:** Production (`pnpm --filter @workspace/mobile run build` + `run serve`,
wired in `.replit-artifact/artifact.toml` `[services.production]`) exports and
serves the **web SPA**, so `https://<deploy>.replit.app` opens the GlazeVault app
directly in a browser.

**Why:** The default Replit Expo artifact template's production build produced an
**Expo Go static deployment** — `/` served a "Download Expo Go / Scan QR code"
landing page (old `scripts/build.js` + `server/templates/landing-page.html`).
Alpha/web users hitting the URL saw the QR page, not the app. We replaced that
flow entirely.

**How to apply:**
- `build` = `expo export --platform web --output-dir dist` (heap bumped via
  `NODE_OPTIONS=--max-old-space-size=4096` — the export OOMs under memory
  contention; the first symptom is an empty `dist/` with the log stopping at
  "Starting Metro Bundler" and exit code -1, NOT an error message).
- `app.json` `web.output: "single"` → SPA (one `dist/index.html`). Required
  because public artist routes are dynamic (`[slug]`, `[slug]/archive`, etc.) and
  can't be statically pre-rendered (slugs come from Supabase at runtime).
- `server/serve.js` is a zero-dep Node static server: serves real files from
  `dist/`, **falls back to `index.html` for any extensionless route** (this is
  what makes `/{slug}` public links resolve via client-side routing), returns 404
  for missing files that have an extension, no-cache on `index.html`, immutable
  cache on `/_expo/*` + `/assets/*`.
- App is Supabase-direct on web (no API-server dependency); `EXPO_PUBLIC_SUPABASE_*`
  are baked in at build (deployment secrets). Public-link origin is correct in
  prod via `window.location.origin` (see public-origin topic), so no build-time
  domain is needed for links.
- The deleted Expo-Go path (`scripts/build.js`, `server/templates/`) is GONE —
  don't resurrect it for web. Changes only take effect after the user re-publishes.
