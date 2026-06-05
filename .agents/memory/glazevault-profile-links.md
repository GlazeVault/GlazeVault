---
name: GlazeVault public profile contact/social links
description: How Instagram/website/email/shop rows on the public portfolio resolve to real external links.
---

# Public profile contact/social links

The public-site contact rows (Instagram, website, email, Etsy, Shopify) are real
external links, not static text.

- `buildProfileLink(icon, label)` in `public-site.tsx` turns the raw artist-typed
  value into a `ProfileLink {icon,label,url,appUrl?}`: `mail`→`mailto:`,
  `instagram`→`https://instagram.com/<handle>` plus `appUrl`
  `instagram://user?username=<handle>` (handle stripped by `instagramHandle()` of
  `@`, scheme, `www.`/`m.`/`instagram.com/` prefix, trailing slash);
  website/etsy/shopify get an `https://` scheme prepended if missing.
- `openProfileLink()` tries the native app deep link first (only when NOT web, via
  `Linking.canOpenURL`), then falls back to the web URL, all in try/catch so a
  malformed link never crashes the page. **Why:** public links are mostly opened
  in mobile Safari (web) where deep-link probing is skipped anyway; the app-open
  path only matters inside the native app.
- iOS app-open requires `LSApplicationQueriesSchemes: ["instagram"]` in
  `app.json` infoPlist — without it `canOpenURL` returns false and it silently
  falls back to the browser. Any NEW app-scheme deep link needs its scheme added
  there too.
- Design: rows are `Pressable` with opacity-only feedback (`pressed ? 0.5 : 1`),
  no other restyle — keep it minimal.
