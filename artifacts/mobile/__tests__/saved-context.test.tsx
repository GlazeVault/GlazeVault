/**
 * SavedContext is the on-device "Save to Inspiration" + "Follow Artist" store.
 * It must (a) hydrate from AsyncStorage without clobbering a save/follow the
 * user made before that initial read resolved (the hydration race), and
 * (b) only ever persist AFTER hydration so the empty default never overwrites
 * stored data on first mount.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { SavedProvider, useSaved } from "@/context/SavedContext";

const STORAGE_KEY = "@glazevault_saved_v1";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SavedProvider>{children}</SavedProvider>
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("SavedContext", () => {
  it("toggles a piece on and off and persists after hydration", async () => {
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.togglePieceSaved("piece-1"));
    expect(result.current.isPieceSaved("piece-1")).toBe(true);

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(JSON.parse(raw ?? "{}").pieces).toContain("piece-1");
    });

    act(() => result.current.togglePieceSaved("piece-1"));
    expect(result.current.isPieceSaved("piece-1")).toBe(false);
  });

  it("preserves stored saves AND a pre-hydration toggle (hydration union)", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pieces: ["stored-piece"], collections: [], artists: [], following: [] }),
    );

    const { result } = renderHook(() => useSaved(), { wrapper });

    // Tap Save BEFORE hydration resolves — the union must keep both items.
    act(() => result.current.togglePieceSaved("pending-piece"));

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.isPieceSaved("stored-piece")).toBe(true);
    expect(result.current.isPieceSaved("pending-piece")).toBe(true);
  });

  it("follows and unfollows an artist by slug", async () => {
    const { result } = renderHook(() => useSaved(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.toggleFollowing({ slug: "ada-clay", name: "Ada Clay" }));
    expect(result.current.isFollowing("ada-clay")).toBe(true);

    act(() => result.current.toggleFollowing({ slug: "ada-clay", name: "Ada Clay" }));
    expect(result.current.isFollowing("ada-clay")).toBe(false);
  });
});
