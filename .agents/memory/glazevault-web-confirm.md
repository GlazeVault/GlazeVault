---
name: GlazeVault cross-platform confirm
description: Alert.alert is a no-op on react-native-web; use the confirm helper for any confirm/cancel or action prompt that must work on the Expo web target.
---

`Alert.alert(...)` silently does nothing on react-native-web (the Expo web target this app runs on). Any tap that relied on it (delete piece, remove-from-collection, delete collection, the post-save "add to collection?" prompt) did nothing on web.

Archiving a piece (`handleToggleArchive`) now also goes through `confirm()` (destructive) since archiving hides it from the public portfolio; **restoring from archive stays immediate** (non-destructive, no prompt).

**Rule:** for any confirm/cancel prompt that must work on web, use `@/lib/confirm` `confirm()` — it returns a `Promise<boolean>`, using `window.confirm` on web and a two-button `Alert.alert` on native. Make the handler `async` and `return` early when not confirmed.

**Why:** identical behavior on both targets without a custom modal; native keeps the destructive button styling.

**How to apply:**
- Binary destructive/confirm prompts → replace `Alert.alert` with `await confirm({ title, message, confirmText, destructive: true })`.
- Multi-option action sheets (3+ buttons, e.g. add.tsx "add to collection?", PhotoSetEditor "Add Photo") can't map to `window.confirm`. Branch `Platform.OS === "web"` to a binary `confirm()` (or direct action) and keep the native `Alert.alert` action sheet.
- Single-button informational alerts (validation "Title required", "Permission needed", "Link copied") are also no-ops on web but were left as-is — they're notices, not confirmations.
