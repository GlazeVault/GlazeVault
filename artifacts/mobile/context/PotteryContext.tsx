import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface PotteryPiece {
  id: string;
  title: string;
  notes: string;
  clay: string;
  glaze: string;
  firing: string;
  dimensions: string;
  imageUri: string;
  createdAt: string;
  isFavorite: boolean;
  isPublic: boolean;
  collectionId?: string;
}

interface PotteryContextType {
  pieces: PotteryPiece[];
  addPiece: (piece: Omit<PotteryPiece, "id" | "createdAt" | "isFavorite" | "isPublic">) => Promise<void>;
  updatePiece: (id: string, updates: Partial<PotteryPiece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getPiece: (id: string) => PotteryPiece | undefined;
}

const PotteryContext = createContext<PotteryContextType | undefined>(undefined);

const STORAGE_KEY = "@glazevault_pieces_v2";

const SEED_PIECES: PotteryPiece[] = [
  {
    id: "seed-blue-mug",
    title: "Blue Mug",
    notes:
      "A quiet morning piece. The turquoise matt glaze pools gently at the foot, revealing the warm stoneware body beneath. Thrown on the wheel in a single session.",
    clay: "Stoneware",
    glaze: "Turquoise Matt",
    firing: "Gas Reduction",
    dimensions: "9 cm H × 8 cm W",
    imageUri: "@seed/blue-mug",
    createdAt: new Date("2026-05-12").toISOString(),
    isFavorite: false,
    isPublic: false,
  },
];

function normalizePiece(p: Partial<PotteryPiece> & Pick<PotteryPiece, "id">): PotteryPiece {
  return {
    notes: "",
    clay: "",
    glaze: "",
    firing: "",
    dimensions: "",
    imageUri: "",
    createdAt: new Date().toISOString(),
    isFavorite: false,
    isPublic: false,
    ...p,
  } as PotteryPiece;
}

export function PotteryProvider({ children }: { children: React.ReactNode }) {
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data) as Array<Partial<PotteryPiece> & Pick<PotteryPiece, "id">>;
          setPieces(parsed.map(normalizePiece));
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PIECES));
          setPieces(SEED_PIECES);
        }
      } catch {
        setPieces(SEED_PIECES);
      }
    })();
  }, []);

  const persist = useCallback(async (updated: PotteryPiece[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPieces(updated);
  }, []);

  const addPiece = useCallback(
    async (piece: Omit<PotteryPiece, "id" | "createdAt" | "isFavorite" | "isPublic">) => {
      const newPiece: PotteryPiece = {
        ...piece,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
        isFavorite: false,
        isPublic: false,
      };
      await persist([newPiece, ...pieces]);
    },
    [pieces, persist]
  );

  const updatePiece = useCallback(
    async (id: string, updates: Partial<PotteryPiece>) => {
      await persist(pieces.map((p) => (p.id === id ? { ...p, ...updates } : p)));
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
      await persist(pieces.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)));
    },
    [pieces, persist]
  );

  const getPiece = useCallback((id: string) => pieces.find((p) => p.id === id), [pieces]);

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
