---
name: GlazeVault web toast notices
description: How informational notices render on web (in-app toast vs native Alert)
---

On web, `notice()` (`@/lib/notice`) renders a branded in-app toast instead of the
blocking `window.alert`. Native (iOS/Android) still uses `Alert.alert`.

**Architecture:** module-level pub/sub store `@/lib/toast` (subscribeToasts /
showToast / dismissToast) decouples the plain `notice()` function from React. A
single `<ToastHost />` (`@/components/ToastHost`) mounted in the app root subscribes
and renders the stack (top-center, safe-area aware, queue capped, auto-dismiss
~4s, tap to dismiss).

**Why a store, not context:** `notice()` is a plain async function called from
non-component code, so it can't read context; the singleton emitter is the bridge.

**Variants:** `notice({ variant })` → "success" (emerald) / "error" (destructive) /
"info" (cobalt, default). Only affects web toast styling; native ignores it.
Callers set "success" for "Link copied" and "error" for save/import/validation
failures; permission/info notices keep the default.

**How to apply:** new notices pass an appropriate `variant`. The ToastHost is
harmless on native (no toasts are ever enqueued there). `chooseAction` in notice.ts
still uses the window.confirm fallback (separate concern — multi-option menu task).
