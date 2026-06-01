import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface PotteryPiece {
  id: string;
  title: string;
  description: string;
  technique: string;
  materials: string;
  glaze: string;
  dimensions: string;
  imageUri: string;
  createdAt: string;
  isFavorite: boolean;
}

interface PotteryContextType {
  pieces: PotteryPiece[];
  addPiece: (piece: Omit<PotteryPiece, "id" | "createdAt" | "isFavorite">) => Promise<void>;
  updatePiece: (id: string, updates: Partial<PotteryPiece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getPiece: (id: string) => PotteryPiece | undefined;
}

const PotteryContext = createContext<PotteryContextType | undefined>(undefined);

const STORAGE_KEY = "@pottery_pieces";

export function PotteryProvider({ children }: { children: React.ReactNode }) {
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setPieces(JSON.parse(data));
        } catch {
          setPieces([]);
        }
      }
    });
  }, []);

  const persist = useCallback(async (updated: PotteryPiece[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPieces(updated);
  }, []);

  const addPiece = useCallback(
    async (piece: Omit<PotteryPiece, "id" | "createdAt" | "isFavorite">) => {
      const newPiece: PotteryPiece = {
        ...piece,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        isFavorite: false,
      };
      await persist([newPiece, ...pieces]);
    },
    [pieces, persist]
  );

  const updatePiece = useCallback(
    async (id: string, updates: Partial<PotteryPiece>) => {
      const updated = pieces.map((p) => (p.id === id ? { ...p, ...updates } : p));
      await persist(updated);
    },
    [pieces, persist]
  );

  const deletePiece = useCallback(
    async (id: string) => {
      await persist(pieces.filter((p) => p.id !== id));
    },
    [pieces, persist]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const updated = pieces.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      );
      await persist(updated);
    },
    [pieces, persist]
  );

  const getPiece = useCallback(
    (id: string) => pieces.find((p) => p.id === id),
    [pieces]
  );

  return (
    <PotteryContext.Provider value={{ pieces, addPiece, updatePiece, deletePiece, toggleFavorite, getPiece }}>
      {children}
    </PotteryContext.Provider>
  );
}

export function usePottery() {
  const ctx = useContext(PotteryContext);
  if (!ctx) throw new Error("usePottery must be used within PotteryProvider");
  return ctx;
}
