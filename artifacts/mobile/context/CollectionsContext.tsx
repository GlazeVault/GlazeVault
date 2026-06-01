import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Collection {
  id: string;
  title: string;
  intro: string;
  createdAt: string;
}

interface CollectionsContextType {
  collections: Collection[];
  addCollection: (c: Omit<Collection, "id" | "createdAt">) => Promise<Collection>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  getCollection: (id: string) => Collection | undefined;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);
const STORAGE_KEY = "@glazevault_collections_v1";

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setCollections(JSON.parse(data));
    });
  }, []);

  const persist = useCallback(async (updated: Collection[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCollections(updated);
  }, []);

  const addCollection = useCallback(
    async (c: Omit<Collection, "id" | "createdAt">): Promise<Collection> => {
      const newCol: Collection = {
        ...c,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
      };
      await persist([...collections, newCol]);
      return newCol;
    },
    [collections, persist]
  );

  const updateCollection = useCallback(
    async (id: string, updates: Partial<Collection>) => {
      await persist(collections.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    },
    [collections, persist]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await persist(collections.filter((c) => c.id !== id));
    },
    [collections, persist]
  );

  const getCollection = useCallback(
    (id: string) => collections.find((c) => c.id === id),
    [collections]
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
