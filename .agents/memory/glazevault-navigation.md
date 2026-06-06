---
name: GlazeVault bottom navigation
description: Why the tab bar is a custom JS tabBar (not NativeTabs) and how the center + action works.
---

# GlazeVault bottom navigation

The tab bar is a single custom `tabBar` rendered on expo-router `<Tabs>` (`GlazeTabBar` in `app/(tabs)/_layout.tsx`). It shows Home · Collections · [+ FAB] · Saved · Profile.

## The landing is a calm "foyer", not the grid
- `app/(tabs)/index.tsx` (the Home tab) is a foyer: shared `ArtistHero` (hero+name+optional tagline) + 3 `EntranceCard` doorways — Portfolio→`router.push('/public-site')`, Collections→`router.navigate('/(tabs)/collections')`, Archive→`router.push('/archive')`. NO grid here.
- The full archive grid lives at `app/archive.tsx` (root Stack card, `presentation:'card'`), reached via the Archive doorway so the grid is never the first impression. It is the ORIGINAL landing grid moved verbatim (FlashList orientation rows + search), plus a "Foyer" back button (`router.canGoBack() ? back() : replace('/')`).
- `archive` must be in `PRIVATE_ROOTS` (AuthGate, `app/_layout.tsx`) or it gets misread as a public `[slug]` route.
- After saving a piece, `add.tsx` does `router.replace('/archive')` (not `/`) so the user lands on the grid and sees the new piece — hence the archive back button's `canGoBack` fallback.
- **Foyer is the central hub:** every destination has a "← Foyer" back that returns to the entrance. Archive: `canGoBack ? back : replace('/')`. Portfolio (`/public-site`, pushed): `router.back()` (returns to foyer from the card; returns to Profile when opened from Profile — intended). Collections is a TAB (not pushed), so its "Foyer" back must `router.navigate('/')` (a tab-switch to Home), NOT `router.back()`.
- **Why:** user wanted "choosing where to wander inside an artist's space," gallery-foyer not app-dashboard; "always able to return to the artist entrance easily." The first tab was renamed Archive→**Home** (house icon) because index is no longer the grid. Collections kept as a bottom tab (tab-bar symmetry: 2·FAB·2) but given an explicit Foyer back for orientation.

## Why custom instead of NativeTabs
- The previous layout had two paths: NativeTabs (liquid-glass, iOS 26) and a classic JS tab bar. A centered emphasized **+** FAB that opens a menu is not expressible with NativeTabs' trigger model, so both were replaced by one custom tabBar.
- Tradeoff accepted: lose native liquid-glass tabs; keep iOS blur via `BlurView` so it still feels native.

## The center "+" is an action, not a route
- Tapping + opens `AddMenu` (bottom-sheet `Modal`) with two options: Record Piece → `/add`, Create Collection → `/collection/new`.
- **Routing mode matters:** `/add` is a tab route, so navigate to it with `router.navigate` (tab-switch semantics). `/collection/new` is a stack modal, so use `router.push`. Using `push` for `/add` stacks duplicate history entries and breaks Android back behavior.
- `add` stays registered as `<Tabs.Screen name="add" options={{ href: null }} />` — hidden from the bar but still reachable programmatically.

## Nav button wiring
- Standard pattern: `navigation.emit({type:"tabPress",...})` then `navigation.navigate(name)` if not focused and not default-prevented. Active state via `state.routes[state.index].name`.
- `TabBarProps` type is derived from `Tabs` props (`Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]`) to avoid depending on `@react-navigation/bottom-tabs`, which is not a direct dependency.

## Portfolio entry context (Remove from Portfolio vs Collection)
- The piece detail's `from=portfolio` sentinel ("Remove from Portfolio" = unfeature only) is reachable ONLY via the Profile→Portfolio path: Portfolio cards push `/collection/[id]` with `context:"portfolio"`; collection detail maps that to `pieceFrom = context==="portfolio" ? "portfolio" : id` and threads it to the piece-tile taps.
- Collections-tab entry (no context) stays collection-scoped (`from=<collectionId>` → "Remove from this Collection"). The collection's immersive "View Exhibition" button intentionally keeps `from=id`.
- **Why:** user wanted a piece opened *through the Portfolio* to behave as portfolio context, while collection behavior is preserved everywhere else. Accepted side effect: `from=portfolio` makes `fromCollectionId` undefined, so owner swipe set/caption become portfolio-wide there (intended, not a bug).

## Portfolio list must FILTER, not just relabel
- In portfolio context the collection detail must render the gallery (plus piece-count text, empty-state, immersive entry) from `getPortfolioCollectionPieces(collection, pieces)` — featured/portfolio pieces only — NOT the full member set.
- **Why:** "Remove from Portfolio" only sets featuredInPortfolio=false; if the list still shows all members the piece never visibly disappears (the original bug). The list is driven by reactive `pieces`, so filtering + the existing updatePiece→router.back() makes it vanish on return; no manual refetch needed.
- **How to apply:** gate on `context==="portfolio"`; default (Collections-tab) context keeps the full member list unchanged. Cover-picker grid (edit mode) intentionally stays on the full set.
