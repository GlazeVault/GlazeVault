---
name: GlazeVault web action sheet
description: How multi-option choices render on web (in-app modal vs native multi-button Alert)
---

`chooseAction(title, message, options)` in `@/lib/notice` is the multi-option
sibling of `notice()`/`confirm()`. Native (iOS/Android) uses a multi-button
`Alert.alert`. On web `Alert.alert` is a no-op, so it renders ONE in-app modal
listing every option at once (replacing the old chained `window.confirm` fallback,
which was clunky one-yes/no-prompt-per-option).

**Architecture (mirrors the toast store):** module-level pub/sub
`@/lib/actionSheet` (subscribeActionSheet / presentActionSheet / resolveActionSheet)
holds a SINGLE active request; opening a new sheet auto-dismisses any current one.
A single `<ActionSheetHost />` (`@/components/ActionSheetHost`) mounted in the app
root next to `<ToastHost />` subscribes and renders the modal (bottom sheet,
backdrop tap to dismiss, safe-area aware, animated, uses `useColors`).

**Why a store, not context:** `chooseAction` is a plain async function called from
non-component code (e.g. add.tsx handleSave), so it can't read context; the
singleton emitter is the bridge — same reason as the toast store.

**Resolution contract:** the promise resolves with the chosen `ActionOption` or
`undefined` on dismissal. `chooseAction` then runs `(chosen ?? cancel).onPress`,
so a backdrop dismissal triggers the cancel option's side effects. `style:
"cancel"` is rendered as a separate footer button; `style: "destructive"` colors
the option `colors.destructive`.

**How to apply:** new web multi-option prompts just call `chooseAction`; no extra
wiring. Host is harmless on native (nothing is ever enqueued there). Callers:
PhotoSetEditor "Add Photo" (native only — web goes straight to file picker since
there's no camera capture) and add.tsx "Add to Collection?".
