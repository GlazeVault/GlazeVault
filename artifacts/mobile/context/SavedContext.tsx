import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

/**
 * "Save to Inspiration" + "Follow Artist" — the first, deliberately quiet
 * network features. These are PRIVATE to the person browsing: there are no
 * public counts, no popularity, no engagement metrics. Because the app has no
 * viewer identity/auth, saves and follows live entirely on-device
 * (AsyncStorage, which is localStorage-backed on web). They are viewer-side
 * curation, separate from the artist's archive (which is the Supabase
 * source-of-truth) — so they intentionally never sync to a shared backend.
 */
export type SavedArtist = { slug: string; name: string };

type SavedState = {
  /** Saved artwork (piece) ids. */
  pieces: string[];
  /** Saved collection ids. */
  collections: string[];
  /** Saved artist references (kept for the Inspiration shelf). */
  artists: SavedArtist[];
  /** Artists the viewer follows (to quietly revisit their archive). */
  following: SavedArtist[];
};

const EMPTY: SavedState = { pieces: [], collections: [], artists: [], following: [] };

// Saves/follows are private to the browsing user and namespaced per account so
// switching accounts shows that account's own Inspiration shelf.
const STORAGE_PREFIX = "@glazevault_saved_v1";
const cacheKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

type SavedContextValue = {
  hydrated: boolean;
  saved: SavedState;
  isPieceSaved: (id: string) => boolean;
  togglePieceSaved: (id: string) => void;
  isCollectionSaved: (id: string) => boolean;
  toggleCollectionSaved: (id: string) => void;
  isArtistSaved: (slug: string) => boolean;
  toggleArtistSaved: (artist: SavedArtist) => void;
  isFollowing: (slug: string) => boolean;
  toggleFollowing: (artist: SavedArtist) => void;
};

const SavedContext = createContext<SavedContextValue | undefined>(undefined);

/** Add/remove a string id from a list (toggle). */
function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Add/remove an artist (by slug) from a list (toggle), refreshing its name. */
function toggleArtist(list: SavedArtist[], artist: SavedArtist): SavedArtist[] {
  return list.some((a) => a.slug === artist.slug)
    ? list.filter((a) => a.slug !== artist.slug)
    : [...list, artist];
}

/** Union of two id lists, preserving order (stored first, then new). */
function unionIds(stored: string[], pending: string[]): string[] {
  return [...stored, ...pending.filter((id) => !stored.includes(id))];
}

/** Union of two artist lists by slug (stored first, then new). */
function unionArtists(stored: SavedArtist[], pending: SavedArtist[]): SavedArtist[] {
  return [...stored, ...pending.filter((a) => !stored.some((s) => s.slug === a.slug))];
}

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { userId, authReady } = useAuth();
  const [saved, setSaved] = useState<SavedState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Serialize AsyncStorage writes so rapid toggles can't interleave and clobber
  // each other (mirrors the writeChain pattern used by the archive contexts).
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  // Hydrate the signed-in user's shelf; reset to empty when signed out / between
  // accounts so one account's saves never bleed into another's.
  useEffect(() => {
    let cancelled = false;
    if (!userId || !authReady) {
      setSaved(EMPTY);
      setHydrated(false);
      return;
    }
    const key = cacheKey(userId);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<SavedState>;
          // Merge (union) rather than overwrite: if the user tapped Save/Follow
          // before this initial read resolved, `prev` holds that action and we
          // must not drop it. State starts empty, so any pre-hydrate change can
          // only be an add — a union preserves both stored and pending items.
          setSaved((prev) => ({
            pieces: unionIds(parsed.pieces ?? [], prev.pieces),
            collections: unionIds(parsed.collections ?? [], prev.collections),
            artists: unionArtists(parsed.artists ?? [], prev.artists),
            following: unionArtists(parsed.following ?? [], prev.following),
          }));
        }
      } catch {
        // A corrupt cache should never block the app; start from empty.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authReady]);

  // Persist whenever the state changes, but only after the initial hydrate so we
  // never overwrite stored data with the empty default on first mount.
  useEffect(() => {
    if (!hydrated || !userId) return;
    const key = cacheKey(userId);
    writeChain.current = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(saved)))
      .catch(() => {});
  }, [saved, hydrated, userId]);

  const isPieceSaved = useCallback((id: string) => saved.pieces.includes(id), [saved.pieces]);
  const togglePieceSaved = useCallback(
    (id: string) => setSaved((s) => ({ ...s, pieces: toggleId(s.pieces, id) })),
    [],
  );

  const isCollectionSaved = useCallback(
    (id: string) => saved.collections.includes(id),
    [saved.collections],
  );
  const toggleCollectionSaved = useCallback(
    (id: string) => setSaved((s) => ({ ...s, collections: toggleId(s.collections, id) })),
    [],
  );

  const isArtistSaved = useCallback(
    (slug: string) => saved.artists.some((a) => a.slug === slug),
    [saved.artists],
  );
  const toggleArtistSaved = useCallback(
    (artist: SavedArtist) => setSaved((s) => ({ ...s, artists: toggleArtist(s.artists, artist) })),
    [],
  );

  const isFollowing = useCallback(
    (slug: string) => saved.following.some((a) => a.slug === slug),
    [saved.following],
  );
  const toggleFollowing = useCallback(
    (artist: SavedArtist) =>
      setSaved((s) => ({ ...s, following: toggleArtist(s.following, artist) })),
    [],
  );

  return (
    <SavedContext.Provider
      value={{
        hydrated,
        saved,
        isPieceSaved,
        togglePieceSaved,
        isCollectionSaved,
        toggleCollectionSaved,
        isArtistSaved,
        toggleArtistSaved,
        isFollowing,
        toggleFollowing,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within a SavedProvider");
  return ctx;
}
