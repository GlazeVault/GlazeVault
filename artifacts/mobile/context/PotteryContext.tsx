import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  DEFAULT_PUBLIC_DATA_SETTINGS,
  PublicDataSettings,
  Visibility,
} from "@/constants/privacy";
import { isSupabaseConfigured } from "@/services/supabase";
import {
  deletePiece as deletePieceRemote,
  loadPieces as loadPiecesRemote,
  savePiece as savePieceRemote,
} from "@/services/dataService";

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

  // Writes to the AsyncStorage cache only. Supabase is the source of truth when
  // configured; the cache exists for instant first paint and offline use.
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

  // Pushes a single piece to Supabase. On success the returned record carries
  // any freshly-uploaded image URL, which we fold back into the cache so the
  // same local image is never re-uploaded on later edits. Failures are kept in
  // the cache (offline buffer) and logged.
  const pushPieceRemote = useCallback(
    async (piece: PotteryPiece) => {
      if (!isSupabaseConfigured) return;
      try {
        const saved = await savePieceRemote(piece);
        if (saved.imageUri !== piece.imageUri) {
          await persist(
            piecesRef.current.map((p) =>
              p.id === saved.id ? { ...p, imageUri: saved.imageUri } : p
            )
          );
        }
      } catch (e) {
        console.warn("[supabase] savePiece failed (kept in local cache)", e);
      }
    },
    [persist]
  );

  const removePieceRemote = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      await deletePieceRemote(id);
    } catch (e) {
      console.warn("[supabase] deletePiece failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // 1. Local cache first — instant paint + offline fallback.
      let cached: PotteryPiece[] = [];
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data) as Array<Partial<PotteryPiece> & Pick<PotteryPiece, "id">>;
          cached = parsed.map(normalizePiece);
          piecesRef.current = cached;
          setPieces(cached);
          console.log("Loaded pieces", cached.length);
        } else if (!isSupabaseConfigured) {
          // Only seed when there is no backend to be the source of truth.
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PIECES));
          cached = SEED_PIECES;
          piecesRef.current = SEED_PIECES;
          setPieces(SEED_PIECES);
          console.log("Loaded pieces", SEED_PIECES.length, "(seeded)");
        } else {
          console.log("Loaded pieces", 0);
        }
      } catch (e) {
        console.warn("Failed to load pieces", e);
        if (!isSupabaseConfigured) {
          cached = SEED_PIECES;
          piecesRef.current = SEED_PIECES;
          setPieces(SEED_PIECES);
        }
      }

      // 2. Supabase is the source of truth when configured + reachable.
      //    Conflicts resolve remote-wins, but records that exist only in the
      //    cache (created offline, never pushed) are preserved and synced up so
      //    a freshly-added piece can't vanish on the next launch. NOTE: offline
      //    *edits* to an existing piece and offline *deletes* still follow
      //    remote-wins — full offline conflict/delete sync is a future step.
      if (isSupabaseConfigured) {
        try {
          const remote = await loadPiecesRemote();
          if (remote.length > 0) {
            const remoteIds = new Set(remote.map((p) => p.id));
            const localOnly = cached.filter((p) => !remoteIds.has(p.id));
            const merged = [...localOnly, ...remote].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            await persist(merged);
            console.log(
              "[supabase] loaded pieces",
              remote.length,
              localOnly.length ? `(+${localOnly.length} local unsynced)` : ""
            );
            await Promise.all(localOnly.map((p) => pushPieceRemote(p)));
          } else if (cached.length > 0) {
            // First connect with an empty cloud DB: migrate local data up and
            // fold the returned image URLs back into the cache.
            console.log("[supabase] migrating", cached.length, "local pieces");
            const migrated = await Promise.all(
              cached.map((p) =>
                savePieceRemote(p).catch((e) => {
                  console.warn("[supabase] migrate piece failed", e);
                  return p;
                })
              )
            );
            await persist(migrated);
          }
        } catch (e) {
          console.warn("[supabase] loadPieces failed, using local cache", e);
        }
      }
    })();
  }, [persist, pushPieceRemote]);

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
      await pushPieceRemote(newPiece);
    },
    [persist, pushPieceRemote]
  );

  const updatePiece = useCallback(
    async (id: string, updates: Partial<PotteryPiece>) => {
      let merged: PotteryPiece | undefined;
      await persist(
        piecesRef.current.map((p) => {
          if (p.id !== id) return p;
          merged = { ...p, ...updates };
          if (updates.firingEnvironment !== undefined || updates.firing !== undefined) {
            const firingEnvironment = merged.firingEnvironment || merged.firing || "";
            merged.firingEnvironment = firingEnvironment;
            merged.firing = firingEnvironment;
          }
          if (updates.visibility !== undefined) {
            console.log("Saved piece visibility:", merged.id, merged.visibility);
          }
          return merged;
        })
      );
      if (merged) await pushPieceRemote(merged);
    },
    [persist, pushPieceRemote]
  );

  const deletePiece = useCallback(
    async (id: string) => {
      await persist(piecesRef.current.filter((p) => p.id !== id));
      await removePieceRemote(id);
    },
    [persist, removePieceRemote]
  );

  const removePieceFromCollection = useCallback(
    async (collectionId: string, pieceId: string) => {
      let changed: PotteryPiece | undefined;
      await persist(
        piecesRef.current.map((p) => {
          if (p.id === pieceId && p.collectionId === collectionId) {
            changed = { ...p, collectionId: undefined };
            return changed;
          }
          return p;
        })
      );
      if (changed) await pushPieceRemote(changed);
    },
    [persist, pushPieceRemote]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      let changed: PotteryPiece | undefined;
      await persist(
        piecesRef.current.map((p) => {
          if (p.id === id) {
            changed = { ...p, isFavorite: !p.isFavorite };
            return changed;
          }
          return p;
        })
      );
      if (changed) await pushPieceRemote(changed);
    },
    [persist, pushPieceRemote]
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
