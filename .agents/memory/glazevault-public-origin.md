---
name: GlazeVault public link origin
description: Why visible public-link previews must use the resolved origin, never the brand domain, and how the share URL host is resolved.
---

# Public link origin (display must match what Share/Copy use)

**Rule:** Any place that DISPLAYS a public link (profile editor preview, public-site hero, owner piece detail) must derive it from the resolved origin — `publicSiteLabel(name)` / `publicBaseUrl(name)` in ProfileContext — never from the hardcoded brand domain constant `PUBLIC_SITE_DOMAIN` (`glazevault.art`).

**Why:** the brand domain isn't connected yet, so showing `glazevault.art/<slug>` to the user is a dead link that doesn't match what Share/Copy actually emit. The user read "link not generating / invalid link" as a bug when the share URL was actually fine — only the *preview text* was wrong. Keep displayed host == shared host.

**How to apply:**
- `resolvePublicOrigin()` precedence: `EXPO_PUBLIC_PUBLIC_SITE_URL` → `EXPO_PUBLIC_DOMAIN` (set by the expo `dev` workflow to `$REPLIT_DEV_DOMAIN`, so links work at runtime) → Replit-domain fallback (logs a `console.warn`). The `glazevault.art` brand domain is intentionally NOT the runtime fallback.
- Owner piece detail shows the copyable URL only when `isPubliclyVisiblePiece`; otherwise the quiet hint "Make public to share." The owner action block is gated behind the `if (isPublicView) return` early path, so it never renders in the public projection.
- Test mocks of `@/context/ProfileContext` must include `publicSiteLabel` (and `publicBaseUrl`) or public-site/profile renders crash with "is not a function".
- "Not on view" debugging: `app/[slug]/piece/[id].tsx` logs `availablePieceIds` + gate reasons; a public link 404s when the piece id isn't among the artist's Supabase-visible pieces (cache-only piece, site disabled, or not public), not because the URL is malformed.
