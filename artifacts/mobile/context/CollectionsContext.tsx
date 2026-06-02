import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Visibility } from "@/constants/privacy";

export interface Collection {
  id: string;
  title: string;
  intro: string;
  createdAt: string;
  visibility: Visibility;
  featuredOnSite: boolean;
  // Optional artist-chosen cover image (web: base64 data URI, native: relative
  // pieces/ path). When absent, surfaces fall back to a public piece image.
  coverImageUri?: string;
}

interface CollectionsContextType {
  collections: Collection[];
  addCollection: (
    c: Omit<Collection, "id" | "createdAt" | "visibility" | "featuredOnSite"> & {
      visibility?: Visibility;
      featuredOnSite?: boolean;
    }
  ) => Promise<Collection>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  getCollection: (id: string) => Collection | undefined;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);
const STORAGE_KEY = "@glazevault_collections_v1";

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  // Mirror of the latest collections so rapid successive writes merge against
  // fresh state instead of a stale render closure (prevents toggles/edits from
  // clobbering each other).
  const collectionsRef = useRef<Collection[]>([]);
  // Serializes AsyncStorage writes so rapid successive saves commit in order and
  // an older snapshot can never overwrite a newer one.
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (!data) {
          console.log("Loaded collections", 0);
          return;
        }
        const parsed = JSON.parse(data) as Partial<Collection>[];
        // Backward compat: collections saved before privacy default to private,
        // and collections saved before site-featuring default to not featured.
        const normalized = parsed.map((c) => ({
          ...(c as Collection),
          visibility: c.visibility ?? "private",
          featuredOnSite: c.featuredOnSite ?? false,
        }));
        collectionsRef.current = normalized;
        setCollections(normalized);
        console.log("Loaded collections", normalized.length);
      })
      .catch((e) => console.warn("Failed to load collections", e));
  }, []);

  const persist = useCallback(async (updated: Collection[]) => {
    collectionsRef.current = updated;
    setCollections(updated);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved collections", updated.length);
  }, []);

  const addCollection = useCallback(
    async (
      c: Omit<Collection, "id" | "createdAt" | "visibility" | "featuredOnSite"> & {
        visibility?: Visibility;
        featuredOnSite?: boolean;
      }
    ): Promise<Collection> => {
      const newCol: Collection = {
        ...c,
        visibility: c.visibility ?? "private",
        featuredOnSite: c.featuredOnSite ?? false,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
      };
      await persist([...collectionsRef.current, newCol]);
      return newCol;
    },
    [persist]
  );

  const updateCollection = useCallback(
    async (id: string, updates: Partial<Collection>) => {
      await persist(
        collectionsRef.current.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    [persist]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await persist(collectionsRef.current.filter((c) => c.id !== id));
    },
    [persist]
  );

  const getCollection = useCallback(
    (id: string) => collectionsRef.current.find((c) => c.id === id),
    []
  );

  return (
    <CollectionsContext.Provider
      value={{ collections, addCollection, updateCollection, deleteCollection, getCollection }}
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
