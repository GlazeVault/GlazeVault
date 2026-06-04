import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { coalesceImages } from "@/constants/imageStorage";
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
  year: string;
  // Cover/primary photo. Stays the single accessor every curated surface reads,
  // so adding `images` below was fully backward compatible.
  imageUri: string;
  // Ordered set of all photos for the piece. Always includes `imageUri` (the
  // cover). Kept consistent with the cover via `coalesceImages`.
  images: string[];
  createdAt: string;
  isFavorite: boolean;
  // Organization: a piece can live in zero or more collections.
  collectionIds: string[];
  // Curation: hand-picked for the public Portfolio (a subset of public pieces).
  featuredInPortfolio: boolean;
  // Discovery: viewable on public, non-owner surfaces at all.
  isPublic: boolean;
  // Soft-retired: kept in the owner's archive, hidden from every public surface.
  archived: boolean;
}

interface PotteryContextType {
  pieces: PotteryPiece[];
  addPiece: (
    piece: Omit<
      PotteryPiece,
      | "id"
      | "createdAt"
      | "isFavorite"
      | "images"
      | "collectionIds"
      | "featuredInPortfolio"
      | "isPublic"
      | "archived"
    > &
      Partial<
        Pick<
          PotteryPiece,
          "images" | "collectionIds" | "featuredInPortfolio" | "isPublic" | "archived"
        >
      >
  ) => Promise<PotteryPiece>;
  updatePiece: (id: string, updates: Partial<PotteryPiece>) => Promise<void>;
  deletePiece: (id: string) => Promise<void>;
  addPieceToCollection: (collectionId: string, pieceId: string) => Promise<void>;
  removePieceFromCollection: (collectionId: string, pieceId: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getPiece: (id: string) => PotteryPiece | undefined;
}

const PotteryContext = createContext<PotteryContextType | undefined>(undefined);

const STORAGE_KEY = "@glazevault_pieces_v2";

// GlazeVault originally shipped with one demo "Blue Mug" seed piece
// (id "seed-blue-mug", a bundled `@seed/blue-mug` image). We no longer seed any
// demo data. Any lingering copy of that demo — in the local cache OR pushed up
// to Supabase by an earlier version — is stripped on load (see isDemoSeedPiece)
// so it can never reappear or overwrite a real piece. We match only the
// untouched demo image, so a real photo the user attached to this record is
// preserved and never dropped.
const DEMO_SEED_ID = "seed-blue-mug";
// The one demo image that escaped into Supabase (now deleted) lived at this
// storage object; this marker lets us purge any cached copy of it too.
const DEMO_IMAGE_MARKER = "1780452984113-h6pjefo";

// True only for the *untouched* demo seed: the reserved demo id paired with the
// bundled demo ref, the (deleted) demo storage object, or no image at all. A
// real image the user attached to this record — a `data:` URI on web, a
// `pieces/...` relative path on native, or any other uploaded URL — is NOT
// matched, so genuine user photos are preserved and allowed to sync.
function isDemoSeedPiece(p: Pick<PotteryPiece, "id" | "imageUri">): boolean {
  if (p.id !== DEMO_SEED_ID) return false;
  const uri = p.imageUri ?? "";
  return uri === "" || uri.startsWith("@seed/") || uri.includes(DEMO_IMAGE_MARKER);
}

function normalizePiece(
  p: Partial<PotteryPiece> & {
    // Legacy fields from older cached/remote rows.
    visibility?: unknown;
    publicDataSettings?: unknown;
    // Pre-multi-collection rows stored a single optional collection id.
    collectionId?: string;
  } & Pick<PotteryPiece, "id">
): PotteryPiece {
  const { visibility, publicDataSettings, collectionId, ...rest } = p;
  const base = {
    notes: "",
    clay: "",
    glaze: "",
    firing: "",
    cone: "",
    firingEnvironment: "",
    dimensions: "",
    year: "",
    imageUri: "",
    images: [],
    createdAt: new Date().toISOString(),
    isFavorite: false,
    collectionIds: [],
    featuredInPortfolio: false,
    isPublic: false,
    archived: false,
    ...rest,
  } as PotteryPiece;
  // Migrate single `collectionId` → `collectionIds[]` when the array is absent.
  if (!Array.isArray(base.collectionIds) || base.collectionIds.length === 0) {
    base.collectionIds = collectionId ? [collectionId] : [];
  }
  if (!base.firingEnvironment && base.firing) {
    base.firingEnvironment = base.firing;
  }
  // Keep the cover and the full photo set consistent (older rows had only the
  // single `imageUri`; this seeds `images` from it).
  const reconciled = coalesceImages(base.imageUri, base.images);
  base.imageUri = reconciled.imageUri;
  base.images = reconciled.images;
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
      console.log("Saving piece images:", piece.id, piece.imageUri);
      if (!isSupabaseConfigured) return;
      try {
        const saved = await savePieceRemote(piece);
        const imagesChanged =
          saved.images.length !== piece.images.length ||
          saved.images.some((uri, i) => uri !== piece.images[i]);
        if (saved.imageUri !== piece.imageUri || imagesChanged) {
          await persist(
            piecesRef.current.map((p) =>
              p.id === saved.id
                ? { ...p, imageUri: saved.imageUri, images: saved.images }
                : p
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
      // 1. Local cache first — instant paint + offline fallback. No demo data is
      //    ever seeded; the retired demo seed piece is stripped here so it never
      //    repaints or gets re-synced up to Supabase.
      let cached: PotteryPiece[] = [];
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data) as Array<Partial<PotteryPiece> & Pick<PotteryPiece, "id">>;
          cached = parsed.map(normalizePiece).filter((p) => !isDemoSeedPiece(p));
          piecesRef.current = cached;
          setPieces(cached);
          console.log("Loaded pieces", cached.length);
          cached.forEach((p) => console.log("Loaded piece images:", p.id, p.imageUri));
        } else {
          console.log("Loaded pieces", 0);
        }
      } catch (e) {
        console.warn("Failed to load pieces", e);
      }

      // 2. Supabase is the source of truth when configured + reachable.
      //    Conflicts resolve remote-wins, but records that exist only in the
      //    cache (created offline, never pushed) are preserved and synced up so
      //    a freshly-added piece can't vanish on the next launch. NOTE: offline
      //    *edits* to an existing piece and offline *deletes* still follow
      //    remote-wins — full offline conflict/delete sync is a future step.
      if (isSupabaseConfigured) {
        try {
          // Defensively strip the demo seed from remote too, so an old copy
          // pushed up by a previous version can't repaint or be re-synced.
          const remote = (await loadPiecesRemote()).filter((p) => !isDemoSeedPiece(p));
          remote.forEach((p) => console.log("Loaded piece images:", p.id, p.imageUri));
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
        | "id"
        | "createdAt"
        | "isFavorite"
        | "images"
        | "collectionIds"
        | "featuredInPortfolio"
        | "isPublic"
        | "archived"
      > &
        Partial<
          Pick<
            PotteryPiece,
            "images" | "collectionIds" | "featuredInPortfolio" | "isPublic" | "archived"
          >
        >
    ) => {
      const current = piecesRef.current;
      const firingEnvironment = piece.firingEnvironment || piece.firing || "";
      const { imageUri, images } = coalesceImages(piece.imageUri, piece.images);
      const newPiece: PotteryPiece = {
        collectionIds: [],
        featuredInPortfolio: false,
        isPublic: false,
        archived: false,
        ...piece,
        imageUri,
        images,
        firingEnvironment,
        firing: firingEnvironment,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
        isFavorite: false,
      };
      await persist([newPiece, ...current]);
      await pushPieceRemote(newPiece);
      return newPiece;
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

  const addPieceToCollection = useCallback(
    async (collectionId: string, pieceId: string) => {
      let changed: PotteryPiece | undefined;
      await persist(
        piecesRef.current.map((p) => {
          if (p.id === pieceId && !p.collectionIds.includes(collectionId)) {
            changed = { ...p, collectionIds: [...p.collectionIds, collectionId] };
            return changed;
          }
          return p;
        })
      );
      if (changed) await pushPieceRemote(changed);
    },
    [persist, pushPieceRemote]
  );

  const removePieceFromCollection = useCallback(
    async (collectionId: string, pieceId: string) => {
      let changed: PotteryPiece | undefined;
      await persist(
        piecesRef.current.map((p) => {
          if (p.id === pieceId && p.collectionIds.includes(collectionId)) {
            changed = {
              ...p,
              collectionIds: p.collectionIds.filter((id) => id !== collectionId),
            };
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
    <PotteryContext.Provider value={{ pieces, addPiece, updatePiece, deletePiece, addPieceToCollection, removePieceFromCollection, toggleFavorite, getPiece }}>
      {children}
    </PotteryContext.Provider>
  );
}

export function usePottery() {
  const ctx = useContext(PotteryContext);
  if (!ctx) throw new Error("usePottery must be used within PotteryProvider");
  return ctx;
}
