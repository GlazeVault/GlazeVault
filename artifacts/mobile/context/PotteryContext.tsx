import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  DEFAULT_PUBLIC_DATA_SETTINGS,
  PublicDataSettings,
  Visibility,
} from "@/constants/privacy";

export interface PotteryPiece {
  id: string;
  title: string;
  notes: string;
  clay: string;
  glaze: string;
  firing: string;
  cone: string;
  firingEnvironment: string;
  dimensions: string;
  imageUri: string;
  createdAt: string;
  isFavorite: boolean;
  visibility: Visibility;
  publicDataSettings: PublicDataSettings;
  collectionId?: string;
}

interface PotteryContextType {
  pieces: PotteryPiece[];
  addPiece: (
    piece: Omit<
      PotteryPiece,
      "id" | "createdAt" | "isFavorite" | "visibility" | "publicDataSettings"
    >
  ) => Promise<void>;
  updatePiece: (id: string, updates: Partial<PotteryPiece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;
  removePieceFromCollection: (collectionId: string, pieceId: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getPiece: (id: string) => PotteryPiece | undefined;
}

const PotteryContext = createContext<PotteryContextType | undefined>(undefined);

const STORAGE_KEY = "@glazevault_pieces_v2";

// The seed piece originally shipped with a fabricated, AI-style description in
// its `notes`. We no longer seed prose, and any already-stored copy of this
// exact text is cleared on load (see normalizePiece) so it never masquerades as
// the user's own notes. Matched verbatim so genuine user notes are never touched.
const LEGACY_SEED_DEMO_NOTES =
  "A quiet morning piece. The turquoise matt glaze pools gently at the foot, revealing the warm stoneware body beneath. Thrown on the wheel in a single session.";

const SEED_PIECES: PotteryPiece[] = [
  {
    id: "seed-blue-mug",
    title: "Blue Mug",
    notes: "",
    clay: "Stoneware",
    glaze: "Turquoise Matt",
    firing: "Gas Reduction",
    cone: "Cone 6",
    firingEnvironment: "Gas Reduction",
    dimensions: "9 cm H × 8 cm W",
    imageUri: "@seed/blue-mug",
    createdAt: new Date("2026-05-12").toISOString(),
    isFavorite: false,
    visibility: "private",
    publicDataSettings: { ...DEFAULT_PUBLIC_DATA_SETTINGS },
  },
];

function normalizePiece(
  p: Partial<PotteryPiece> & { isPublic?: boolean } & Pick<PotteryPiece, "id">
): PotteryPiece {
  const { isPublic, ...rest } = p;
  const base = {
    notes: "",
    clay: "",
    glaze: "",
    firing: "",
    cone: "",
    firingEnvironment: "",
    dimensions: "",
    imageUri: "",
    createdAt: new Date().toISOString(),
    isFavorite: false,
    visibility: "private" as Visibility,
    ...rest,
  } as PotteryPiece;
  if (!base.firingEnvironment && base.firing) {
    base.firingEnvironment = base.firing;
  }
  // One-time cleanup: drop the legacy seeded demo description so it no longer
  // surfaces as if it were the user's own notes. Scoped to the untouched seed
  // piece (original id + photo) AND a verbatim text match, so genuine
  // user-entered notes are never cleared.
  if (
    base.id === "seed-blue-mug" &&
    base.imageUri === "@seed/blue-mug" &&
    base.notes === LEGACY_SEED_DEMO_NOTES
  ) {
    base.notes = "";
  }
  // Backward compat: migrate legacy `isPublic` flag → `visibility`.
  if (rest.visibility == null && isPublic != null) {
    base.visibility = isPublic ? "public" : "private";
  }
  base.publicDataSettings = {
    ...DEFAULT_PUBLIC_DATA_SETTINGS,
    ...(rest.publicDataSettings ?? {}),
  };
  return base;
}

export function PotteryProvider({ children }: { children: React.ReactNode }) {
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);
  const piecesRef = useRef<PotteryPiece[]>([]);
  // Serializes AsyncStorage writes so rapid successive saves commit in order and
  // an older snapshot can never overwrite a newer one.
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data) as Array<Partial<PotteryPiece> & Pick<PotteryPiece, "id">>;
          const normalized = parsed.map(normalizePiece);
          piecesRef.current = normalized;
          setPieces(normalized);
          console.log("Loaded pieces", normalized.length);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PIECES));
          piecesRef.current = SEED_PIECES;
          setPieces(SEED_PIECES);
          console.log("Loaded pieces", SEED_PIECES.length, "(seeded)");
        }
      } catch (e) {
        console.warn("Failed to load pieces", e);
        piecesRef.current = SEED_PIECES;
        setPieces(SEED_PIECES);
      }
    })();
  }, []);

  const persist = useCallback(async (updated: PotteryPiece[]) => {
    piecesRef.current = updated;
    setPieces(updated);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved pieces", updated.length);
  }, []);

  const addPiece = useCallback(
    async (
      piece: Omit<
        PotteryPiece,
        "id" | "createdAt" | "isFavorite" | "visibility" | "publicDataSettings"
      >
    ) => {
      const current = piecesRef.current;
      const firingEnvironment = piece.firingEnvironment || piece.firing || "";
      const newPiece: PotteryPiece = {
        ...piece,
        firingEnvironment,
        firing: firingEnvironment,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
        isFavorite: false,
        visibility: "private",
        publicDataSettings: { ...DEFAULT_PUBLIC_DATA_SETTINGS },
      };
      await persist([newPiece, ...current]);
    },
    [persist]
  );

  const updatePiece = useCallback(
    async (id: string, updates: Partial<PotteryPiece>) => {
      await persist(
        piecesRef.current.map((p) => {
          if (p.id !== id) return p;
          const merged = { ...p, ...updates };
          if (updates.firingEnvironment !== undefined || updates.firing !== undefined) {
            const firingEnvironment = merged.firingEnvironment || merged.firing || "";
            merged.firingEnvironment = firingEnvironment;
            merged.firing = firingEnvironment;
          }
          return merged;
        })
      );
    },
    [persist]
  );

  const deletePiece = useCallback(
    async (id: string) => {
      await persist(piecesRef.current.filter((p) => p.id !== id));
    },
    [persist]
  );

  const removePieceFromCollection = useCallback(
    async (collectionId: string, pieceId: string) => {
      await persist(
        piecesRef.current.map((p) =>
          p.id === pieceId && p.collectionId === collectionId
            ? { ...p, collectionId: undefined }
            : p
        )
      );
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
    <PotteryContext.Provider value={{ pieces, addPiece, updatePiece, deletePiece, removePieceFromCollection, toggleFavorite, getPiece }}>
      {children}
    </PotteryContext.Provider>
  );
}

export function usePottery() {
  const ctx = useContext(PotteryContext);
  if (!ctx) throw new Error("usePottery must be used within PotteryProvider");
  return ctx;
}
