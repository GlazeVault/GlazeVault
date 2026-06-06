import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { Collection } from "@/context/CollectionsContext";
import { DEFAULT_PUBLIC_SITE, type ArtistProfile } from "@/context/ProfileContext";
import type { PotteryPiece } from "@/context/PotteryContext";
import {
  loadPublicCollectionsForUser,
  loadPublicPiecesForUser,
  loadPublicProfileBySlug,
} from "@/services/dataService";
import { isSupabaseConfigured } from "@/services/supabase";

/**
 * Drives the LIVE public exhibition pages (`/[slug]/*`). Unlike the owner-scoped
 * data contexts (Pottery/Collections/Profile), this fetches ANOTHER artist's
 * public archive by slug, so a different signed-in artist — or a fully anonymous
 * visitor arriving by link — sees only that artist's publicly-visible work. The
 * shared public screens (`public-site`, `piece/[id]`) read from this when it is
 * mounted, falling back to the local owner contexts otherwise (the owner's own
 * in-app preview).
 */
export type PublicArtistStatus = "loading" | "ready" | "missing";

interface PublicArtistValue {
  status: PublicArtistStatus;
  profile: ArtistProfile;
  pieces: PotteryPiece[];
  collections: Collection[];
}

const EMPTY_PROFILE: ArtistProfile = {
  name: "",
  tagline: "",
  bio: "",
  statement: "",
  website: "",
  instagram: "",
  avatarUri: undefined,
  publicSite: DEFAULT_PUBLIC_SITE,
};

const PublicArtistContext = createContext<PublicArtistValue | null>(null);

/** Returns the public-artist data when on a live public page, else null. */
export function usePublicArtistOptional(): PublicArtistValue | null {
  return useContext(PublicArtistContext);
}

/** Like the above but asserts a provider is present (for the slug routes). */
export function usePublicArtist(): PublicArtistValue {
  const ctx = useContext(PublicArtistContext);
  if (!ctx) {
    throw new Error("usePublicArtist must be used within a PublicArtistProvider");
  }
  return ctx;
}

export function PublicArtistProvider({
  slug,
  children,
}: {
  slug: string | undefined;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<PublicArtistStatus>("loading");
  const [profile, setProfile] = useState<ArtistProfile>(EMPTY_PROFILE);
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      // The public pages are remote-only; without Supabase there is nothing to
      // resolve a stranger's archive against, so a link simply isn't on view.
      if (!isSupabaseConfigured || !slug) {
        if (!cancelled) setStatus("missing");
        return;
      }
      try {
        const found = await loadPublicProfileBySlug(slug);
        if (!found) {
          if (!cancelled) setStatus("missing");
          return;
        }
        const [remotePieces, remoteCollections] = await Promise.all([
          loadPublicPiecesForUser(found.userId),
          loadPublicCollectionsForUser(found.userId),
        ]);
        if (cancelled) return;
        setProfile({
          ...EMPTY_PROFILE,
          ...found.profile,
          publicSite: found.profile.publicSite ?? DEFAULT_PUBLIC_SITE,
        });
        setPieces(remotePieces);
        setCollections(remoteCollections);
        setStatus("ready");
      } catch {
        // A failed remote load reads as "not on view" rather than leaking an
        // error — the public surface stays quiet and non-committal.
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <PublicArtistContext.Provider
      value={{ status, profile, pieces, collections }}
    >
      {children}
    </PublicArtistContext.Provider>
  );
}
