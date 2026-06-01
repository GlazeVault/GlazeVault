import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
  const piecesRef = useRef<PotteryPiece[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data) as Array<Partial<PotteryPiece> & Pick<PotteryPiece, "id">>;
          const normalized = parsed.map(normalizePiece);
          piecesRef.current = normalized;
          setPieces(normalized);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PIECES));
          piecesRef.current = SEED_PIECES;
          setPieces(SEED_PIECES);
        }
      } catch {
        piecesRef.current = SEED_PIECES;
        setPieces(SEED_PIECES);
      }
    })();
  }, []);

  const persist = useCallback(async (updated: PotteryPiece[]) => {
    console.log("[GlazeVault] persist — saving", updated.length, "pieces");
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    piecesRef.current = updated;
    setPieces(updated);
  }, []);

  const addPiece = useCallback(
    async (piece: Omit<PotteryPiece, "id" | "createdAt" | "isFavorite" | "isPublic">) => {
      const current = piecesRef.current;
      const newPiece: PotteryPiece = {
        ...piece,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
        isFavorite: false,
        isPublic: false,
      };
      console.log("[GlazeVault] addPiece — collectionId:", piece.collectionId ?? "none");
      console.log("[GlazeVault] addPiece — newPiece:", JSON.stringify(newPiece));
      await persist([newPiece, ...current]);
    },
    [persist]
  );

  const updatePiece = useCallback(
    async (id: string, updates: Partial<PotteryPiece>) => {
      console.log("[GlazeVault] updatePiece — id:", id, "collectionId:", updates.collectionId ?? "none");
      await persist(piecesRef.current.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    },
    [persist]
  );

  const deletePiece = useCallback(
    async (id: string) => {
      await persist(piecesRef.current.filter((p) => p.id !== id));
    },
    [persist]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      await persist(piecesRef.current.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)));
    },
    [persist]
  );

  const getPiece = useCallback((id: string) => piecesRef.current.find((p) => p.id === id), []);

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
