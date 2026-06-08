import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/services/supabase";
import {
  deleteCollection as deleteCollectionRemote,
  loadCollections as loadCollectionsRemote,
  saveCollection as saveCollectionRemote,
} from "@/services/dataService";

export interface Collection {
  id: string;
  title: string;
  intro: string;
  createdAt: string;
  // Collections organize work; they may be browsable publicly or kept private.
  // This is independent of the Portfolio (which is curated at the piece level).
  visibility: "public" | "private";
  // Optional artist-chosen cover image (web: base64 data URI, native: relative
  // pieces/ path). When absent, surfaces fall back to a public piece image.
  coverImageUri?: string;
}

interface CollectionsContextType {
  collections: Collection[];
  /** True once the initial cache + Supabase load has settled. */
  hydrated: boolean;
  addCollection: (
    c: Omit<Collection, "id" | "createdAt" | "visibility"> & {
      visibility?: "public" | "private";
    }
  ) => Promise<Collection>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  getCollection: (id: string) => Collection | undefined;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);
// Cache key is namespaced per user (see PotteryContext for the rationale).
const STORAGE_PREFIX = "@glazevault_collections_v1";
const cacheKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const { userId, authReady } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Mirror of the latest collections so rapid successive writes merge against
  // fresh state instead of a stale render closure (prevents toggles/edits from
  // clobbering each other).
  const collectionsRef = useRef<Collection[]>([]);
  // Latest userId for the stable callbacks below.
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  // Serializes AsyncStorage writes so rapid successive saves commit in order and
  // an older snapshot can never overwrite a newer one.
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  // Writes to the per-user AsyncStorage cache only. Supabase is the source of
  // truth when configured; the cache exists for instant first paint and offline
  // use. No-ops when signed out.
  const persist = useCallback(async (updated: Collection[]) => {
    collectionsRef.current = updated;
    setCollections(updated);
    const uid = userIdRef.current;
    if (!uid) return;
    const key = cacheKey(uid);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved collections", updated.length);
  }, []);

  // Pushes a single collection to Supabase, folding any uploaded cover-image URL
  // back into the cache. Failures stay in the cache and are logged.
  const pushCollectionRemote = useCallback(
    async (col: Collection) => {
      const uid = userIdRef.current;
      if (!isSupabaseConfigured || !uid) return;
      try {
        const saved = await saveCollectionRemote(col, uid);
        if (saved.coverImageUri !== col.coverImageUri) {
          await persist(
            collectionsRef.current.map((c) =>
              c.id === saved.id ? { ...c, coverImageUri: saved.coverImageUri } : c
            )
          );
        }
      } catch (e) {
        console.warn("[supabase] saveCollection failed (kept in local cache)", e);
      }
    },
    [persist]
  );

  const removeCollectionRemote = useCallback(async (id: string) => {
    const uid = userIdRef.current;
    if (!isSupabaseConfigured || !uid) return;
    try {
      await deleteCollectionRemote(id);
    } catch (e) {
      console.warn("[supabase] deleteCollection failed", e);
    }
  }, []);

  // Hydrate per signed-in user; gated on authReady (see PotteryContext).
  useEffect(() => {
    let cancelled = false;
    if (!userId || !authReady) {
      collectionsRef.current = [];
      setCollections([]);
      setHydrated(false);
      return;
    }
    const key = cacheKey(userId);
    (async () => {
      // 1. Local cache first.
      let cached: Collection[] = [];
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data) as (Partial<Collection> & {
            featuredOnSite?: boolean;
          })[];
          // Backward compat: collections saved before the public/private toggle
          // default to private. The old `featuredOnSite` flag is dropped.
          cached = parsed.map(({ featuredOnSite: _drop, ...c }) => ({
            ...(c as Collection),
            visibility: c.visibility ?? "private",
          }));
          collectionsRef.current = cached;
          setCollections(cached);
          console.log("Loaded collections", cached.length);
        } else {
          console.log("Loaded collections", 0);
        }
      } catch (e) {
        console.warn("Failed to load collections", e);
      }

      // 2. Supabase is the source of truth when configured + reachable.
      //    Remote-wins on conflicts, but cache-only collections (created offline,
      //    never pushed) are preserved and synced up. Offline edits/deletes to an
      //    existing collection still follow remote-wins (future: full sync).
      if (isSupabaseConfigured) {
        try {
          const remote = await loadCollectionsRemote(userId);
          if (cancelled) return;
          if (remote.length > 0) {
            const remoteIds = new Set(remote.map((c) => c.id));
            const localOnly = cached.filter((c) => !remoteIds.has(c.id));
            await persist([...remote, ...localOnly]);
            console.log(
              "[supabase] loaded collections",
              remote.length,
              localOnly.length ? `(+${localOnly.length} local unsynced)` : ""
            );
            await Promise.all(localOnly.map((c) => pushCollectionRemote(c)));
          } else if (cached.length > 0) {
            console.log("[supabase] migrating", cached.length, "local collections");
            const migrated = await Promise.all(
              cached.map((c) =>
                saveCollectionRemote(c, userId).catch((e) => {
                  console.warn("[supabase] migrate collection failed", e);
                  return c;
                })
              )
            );
            await persist(migrated);
          }
        } catch (e) {
          console.warn("[supabase] loadCollections failed, using local cache", e);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authReady, persist, pushCollectionRemote]);

  const addCollection = useCallback(
    async (
      c: Omit<Collection, "id" | "createdAt" | "visibility"> & {
        visibility?: "public" | "private";
      }
    ): Promise<Collection> => {
      const newCol: Collection = {
        ...c,
        visibility: c.visibility ?? "private",
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
      };
      await persist([...collectionsRef.current, newCol]);
      await pushCollectionRemote(newCol);
      return newCol;
    },
    [persist, pushCollectionRemote]
  );

  const updateCollection = useCallback(
    async (id: string, updates: Partial<Collection>) => {
      let changed: Collection | undefined;
      await persist(
        collectionsRef.current.map((c) => {
          if (c.id !== id) return c;
          changed = { ...c, ...updates };
          return changed;
        })
      );
      if (changed) await pushCollectionRemote(changed);
    },
    [persist, pushCollectionRemote]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await persist(collectionsRef.current.filter((c) => c.id !== id));
      await removeCollectionRemote(id);
    },
    [persist, removeCollectionRemote]
  );

  const getCollection = useCallback(
    (id: string) => collectionsRef.current.find((c) => c.id === id),
    []
  );

  return (
    <CollectionsContext.Provider
      value={{ collections, hydrated, addCollection, updateCollection, deleteCollection, getCollection }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error("useCollections must be used within CollectionsProvider");
  return ctx;
}
