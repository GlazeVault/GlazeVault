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
- `build` = `expo export --platform web --output-dir dist --max-workers 2`
  (heap bumped via `NODE_OPTIONS=--max-old-space-size=4096`). The export is
  memory-heavy; `--max-workers 2` caps Metro transform workers (default = nproc,
  4 here) so peak RSS stays under the deploy builder's ceiling (container cgroup
  is 8 GB). OOM symptom: empty `dist/`, log stuck at "Starting Metro Bundler",
  SIGKILL with no exit code / no error message.
- VERIFIED 2026-06-06: the exported SPA builds, serves, and runs in a real
  browser with a clean console (`[supabase] Configured for …`, auth init, no
  errors) and `/status` returns 200 (deploy healthcheck passes). The web build
  itself is healthy — if prod still shows the Expo Go landing page, the cause is
  a STALE deployment (new build never published), not a runtime crash. Fix =
  republish.
- TESTING GOTCHA: you cannot build/verify `expo export` via detached background
  bash (`nohup`/`setsid &`) — those processes are reaped when the tool call
  returns, dying with no exit code (looks identical to an OOM). To run a >120s
  build or serve the prod SPA for a browser test, use a MANAGED workflow
  (configureWorkflow build+serve on 18115 → screenshot via the expo domain),
  then remove it and restart `artifacts/mobile: expo`.
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
