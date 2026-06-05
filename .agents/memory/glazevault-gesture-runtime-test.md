---
name: GlazeVault gesture/reanimated runtime tests
description: How to integration-test a reanimated + gesture-handler component (drag lifecycle, frame pump) under jest-expo without a real gesture system.
---

To exercise the *runtime glue* of a component built on `react-native-gesture-handler` + `react-native-reanimated` (gesture handlers, `useFrameCallback` pump) — not just the extracted pure helpers — drive it directly via mocks:

- **Mock `react-native-gesture-handler`:** `Gesture.Pan()` returns a chainable builder that records its `onStart/onUpdate/onEnd/onFinalize` handlers; `GestureDetector` pushes its `gesture` prop into a module-level array and renders children. Thumbnails render in order, so `mockGestures[i]` is the i-th item's gesture. Grab the handler refs from the FIRST render — they close over stable shared values, so they keep working after state-driven re-renders.
- **Mock `react-native-reanimated` with REAL mutable shared values:** `useSharedValue` returns `{value}` stored via `useRef` and pushed (once) to an ordered array; `useFrameCallback(cb)` just captures `cb` so the test pumps frames by calling it by hand; `runOnJS(f)` returns `f` (synchronous); `scrollTo`/`withTiming` are no-ops/identity; `default.ScrollView`/`default.View` render RN equivalents. Leave `computeDropTarget`/`computeEdgeAutoScroll` UNMOCKED so the real wiring is under test.
- **Injecting viewport:** layout feeds `viewportW`/`stripPageX` via `measureInWindow`, which is a **no-op under jest** (verified). Instead read them back from the captured shared-value array by their fixed creation order in the component and set them after render.
- Wrap each handler/frame call in `act()` (onStart/onFinalize call `setState` via the synchronous `runOnJS`).

**Why:** pure-helper unit tests can't catch glue bugs (wrong `scrollDelta`, hover slot not refreshed during auto-scroll). See `artifacts/mobile/__tests__/draggable-photo-strip.test.tsx`.
