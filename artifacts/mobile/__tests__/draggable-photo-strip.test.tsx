/**
 * End-to-end drag lifecycle for DraggablePhotoStrip — the runtime glue that the
 * pure helpers (computeDropTarget, computeEdgeAutoScroll) can't catch on their
 * own. The slot math and the edge-ramp math each have unit tests; what's left
 * untested is how the component WIRES them together at runtime:
 *
 *   - the Pan gesture's onStart → onUpdate → onEnd handlers, which capture the
 *     start slot, recompute the hover slot from finger travel, and finally fire
 *     onReorder(from, to);
 *   - the per-frame pump (useFrameCallback) that, while the finger is held near
 *     an edge, advances the scroll offset AND re-derives the hover slot from the
 *     dragged item's content displacement (so the drop target keeps tracking the
 *     photo even as the strip scrolls under the finger).
 *
 * A bug in that glue — wrong scrollDelta, a hover slot that isn't refreshed
 * during auto-scroll, or a drop that ignores the scrolled distance — would slip
 * past the pure-helper tests entirely. So we drive the real component:
 *
 * Gesture-handler is mocked so `Gesture.Pan()` records its handlers and
 * `GestureDetector` exposes them per thumbnail (in render order). Reanimated is
 * mocked with REAL mutable shared values, a captured `useFrameCallback` we can
 * pump by hand, and `runOnJS`/`scrollTo` made synchronous/no-op — but
 * computeDropTarget/computeEdgeAutoScroll run for real, so the wiring (not a
 * stub) is what's under test.
 *
 * Layout normally feeds viewportW/stripPageX via measureInWindow, which is a
 * no-op under jest. Since the strip's shared values are created in a fixed order
 * in the component, we read them back from the mock and inject a realistic
 * viewport so the edge math behaves like it would on device. Factory-referenced
 * outer vars are `mock`-prefixed per the jest hoisting rule.
 */
import { act, render } from "@testing-library/react-native";
import React from "react";

import { STRIDE } from "@/constants/photoDropTarget";

interface PanHandlers {
  onStart?: () => void;
  onUpdate?: (e: { translationX: number; absoluteX: number }) => void;
  onEnd?: () => void;
  onFinalize?: () => void;
}

// Every Pan gesture created during render, in thumbnail order. Index N is the
// gesture wired to the Nth thumbnail.
const mockGestures: { handlers: PanHandlers }[] = [];

// The single per-frame pump registered by the strip. We invoke it by hand to
// simulate frames advancing while the finger is held at an edge.
const mockFrame: { cb: (() => void) | null } = { cb: null };

// Real mutable shared values, captured in creation order so the test can read
// drag state back and inject a viewport (see header).
const mockSharedValues: { value: number }[] = [];

jest.mock("react-native-reanimated", () => {
  const R = require("react");
  const RN = require("react-native");
  return {
    __esModule: true,
    default: {
      View: (p: Record<string, unknown>) => R.createElement(RN.View, p),
      ScrollView: (p: Record<string, unknown>) =>
        R.createElement(RN.ScrollView, p),
      createAnimatedComponent: (c: unknown) => c,
    },
    useSharedValue: (init: number) => {
      const ref = R.useRef(undefined);
      if (ref.current === undefined) {
        ref.current = { value: init };
        mockSharedValues.push(ref.current);
      }
      return ref.current;
    },
    useAnimatedStyle: () => ({}),
    useAnimatedRef: () => R.useRef(null),
    useAnimatedScrollHandler: (f: unknown) => f,
    useFrameCallback: (cb: () => void) => {
      mockFrame.cb = cb;
      return { setActive: () => {} };
    },
    runOnJS:
      (f: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        f(...args),
    scrollTo: () => {},
    withTiming: (v: unknown) => v,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const R = require("react");
  const makePan = () => {
    const handlers: PanHandlers = {};
    const builder: Record<string, unknown> = { handlers };
    const chain = (key: keyof PanHandlers) => (f: unknown) => {
      handlers[key] = f as never;
      return builder;
    };
    builder.activateAfterLongPress = () => builder;
    builder.onStart = chain("onStart");
    builder.onUpdate = chain("onUpdate");
    builder.onEnd = chain("onEnd");
    builder.onFinalize = chain("onFinalize");
    return builder;
  };
  return {
    Gesture: { Pan: makePan },
    GestureDetector: ({
      gesture,
      children,
    }: {
      gesture: { handlers: PanHandlers };
      children: React.ReactNode;
    }) => {
      mockGestures.push(gesture);
      return R.createElement(R.Fragment, null, children);
    },
  };
});

jest.mock("@expo/vector-icons", () => {
  const R = require("react");
  const RN = require("react-native");
  return {
    Feather: ({ name }: { name: string }) =>
      R.createElement(RN.Text, null, `icon:${name}`),
  };
});

jest.mock("expo-image", () => {
  const R = require("react");
  const RN = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => R.createElement(RN.View, props),
  };
});

jest.mock("@/constants/seedImages", () => ({
  resolveImageSource: (uri: string) => ({ uri }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () =>
    new Proxy(
      { radius: 12 },
      {
        get: (target, prop) =>
          typeof prop === "string" && prop in target
            ? (target as Record<string, unknown>)[prop]
            : "#000000",
      },
    ),
}));

import { DraggablePhotoStrip } from "@/components/DraggablePhotoStrip";

// Names of the parent strip's shared values, in the order they're declared in
// DraggablePhotoStrip (see the component). measureInWindow never fires under
// jest, so this is how the test injects/reads the strip's runtime drag state.
const SHARED_ORDER = [
  "activeIndex",
  "hoverIndex",
  "dragX",
  "scrollOffset",
  "scrollStart",
  "autoScroll",
  "viewportW",
  "stripPageX",
  "contentW",
] as const;

function shared(name: (typeof SHARED_ORDER)[number]): { value: number } {
  const idx = SHARED_ORDER.indexOf(name);
  return mockSharedValues[idx];
}

function makeImages(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `pieces/p${i}.jpg`);
}

describe("DraggablePhotoStrip drag lifecycle", () => {
  beforeEach(() => {
    mockGestures.length = 0;
    mockSharedValues.length = 0;
    mockFrame.cb = null;
  });

  it("fires onReorder(from, to) when a drag crosses slots without auto-scroll", () => {
    const onReorder = jest.fn();
    const images = makeImages(5);

    render(
      <DraggablePhotoStrip
        images={images}
        coverIndex={0}
        onReorder={onReorder}
        onSetCover={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    // Inject a realistic viewport (layout is a no-op under jest) so the finger
    // can sit in the dead zone and NOT trigger edge auto-scroll.
    shared("viewportW").value = 400;
    shared("stripPageX").value = 0;

    // Drag the thumbnail at index 1.
    const g = mockGestures[1].handlers;
    act(() => g.onStart!());

    // Finger travels exactly two slots to the right; absoluteX=200 lands in the
    // dead zone (between the 56px edge zones of a 400px strip) → no auto-scroll.
    act(() => g.onUpdate!({ translationX: 2 * STRIDE, absoluteX: 200 }));

    // Hover advanced 1 → 3 from finger travel alone; no scrolling occurred.
    expect(shared("hoverIndex").value).toBe(3);
    expect(shared("autoScroll").value).toBe(0);
    expect(shared("scrollOffset").value).toBe(0);
    // The per-frame pump must be a no-op when autoScroll is 0.
    act(() => mockFrame.cb!());
    expect(shared("scrollOffset").value).toBe(0);

    act(() => g.onEnd!());

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(1, 3);
  });

  it("auto-scrolls under a held finger and drops at the scrolled-to slot", () => {
    const onReorder = jest.fn();
    const images = makeImages(8); // long enough that the strip can scroll

    render(
      <DraggablePhotoStrip
        images={images}
        coverIndex={0}
        onReorder={onReorder}
        onSetCover={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    shared("viewportW").value = 400;
    shared("stripPageX").value = 0;
    const maxScroll = shared("contentW").value - shared("viewportW").value;
    expect(maxScroll).toBeGreaterThan(0); // sanity: content is scrollable

    // Drag thumbnail 0, with the finger pinned deep in the RIGHT edge zone
    // (absoluteX=395 of a 400px strip) but only a tiny finger travel.
    const g = mockGestures[0].handlers;
    act(() => g.onStart!());
    act(() => g.onUpdate!({ translationX: 30, absoluteX: 395 }));

    // Finger travel alone keeps the drop target at slot 0...
    expect(shared("hoverIndex").value).toBe(0);
    // ...but the finger is in the edge zone, so the pump is now armed.
    expect(shared("autoScroll").value).toBeGreaterThan(0);

    // Pump frames: the strip should scroll and the hover slot should be
    // RE-DERIVED from the scrolled distance (not just finger travel).
    for (let i = 0; i < 60; i++) act(() => mockFrame.cb!());

    expect(shared("scrollOffset").value).toBe(maxScroll); // scrolled to the end
    const expectedTo = Math.round((30 + maxScroll) / STRIDE);
    expect(shared("hoverIndex").value).toBe(expectedTo);
    expect(expectedTo).toBeGreaterThan(0); // proves auto-scroll moved the target

    act(() => g.onEnd!());

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, expectedTo);
  });

  it("does not fire onReorder when the drag ends on the original slot", () => {
    const onReorder = jest.fn();
    const images = makeImages(5);

    render(
      <DraggablePhotoStrip
        images={images}
        coverIndex={0}
        onReorder={onReorder}
        onSetCover={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    shared("viewportW").value = 400;
    shared("stripPageX").value = 0;

    const g = mockGestures[2].handlers;
    act(() => g.onStart!());
    // A nudge too small to cross into the next slot; absoluteX in the dead zone.
    act(() => g.onUpdate!({ translationX: 4, absoluteX: 200 }));
    expect(shared("hoverIndex").value).toBe(2);
    act(() => g.onEnd!());

    expect(onReorder).not.toHaveBeenCalled();
  });
});
