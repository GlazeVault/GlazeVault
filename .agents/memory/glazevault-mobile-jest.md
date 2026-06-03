---
name: GlazeVault mobile jest setup
description: How the Expo/React Native test harness is wired in this pnpm monorepo and the non-obvious gotchas that make rendering tests work.
---

The mobile artifact uses `jest-expo` + `@testing-library/react-native` (run via `pnpm --filter @workspace/mobile run test`). Getting RN component-render tests to work here required several non-obvious fixes:

- **Version pinning to the Expo SDK.** `jest-expo` must match the Expo SDK major (SDK 54 → `jest-expo@~54`), and `jest`/`jest-watch-typeahead` want jest 29 (not 30). `react-test-renderer` must equal the installed `react` EXACTLY (19.1.0); a stray `react-test-renderer@19.2.3` against react 19.1.0 yields `Cannot read properties of null (reading 'useRef')` from a shared-internals mismatch.

- **pnpm + transformIgnorePatterns.** Default Expo/jest allowlists assume flat `node_modules`; pnpm stores real files under `node_modules/.pnpm/<name>@<ver>/node_modules/<name>`. The allowlist must match right after the `.pnpm/` segment, and scoped packages use `+` not `/` (e.g. `@react-native+js-polyfills`). See `artifacts/mobile/jest.config.js`.

- **Never call `jest.resetModules()` in a render test that imports `render` at module top.** RTL captures the React instance at import time; resetting the registry makes a lazily-`require()`d screen pull a *fresh, different* React, so its hooks read a null dispatcher (`Cannot read properties of null (reading 'useState')`). Either import everything after reset, or just don't reset.

- **`jest.mock` factory hoisting.** Factories may only reference outer vars whose names are `mock`-prefixed (e.g. `mockPieces`, `mockRouterParams`). Mock `expo-image`'s `Image` with `require("react").createElement(View, props)` — `react-native` has no `createElement`.

- **tsconfig includes `__tests__`** (it globs `**/*.tsx`), so test files are typechecked by `pnpm --filter @workspace/mobile run typecheck`. `@types/jest` is installed for the globals.

**Why:** these are environment-specific quirks (pnpm layout, Expo/React version lockstep, RTL's import-time React capture) that aren't derivable from the code and cost multiple attempts to find.
