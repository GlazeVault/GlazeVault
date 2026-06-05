import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/services/supabase";
import {
  loadProfile as loadProfileRemote,
  saveProfile as saveProfileRemote,
} from "@/services/dataService";
import { publicSiteSlug } from "@/constants/slug";

export interface PublicSiteSettings {
  enabled: boolean;
  contactEmail: string;
  etsy: string;
  shopify: string;
}

export const DEFAULT_PUBLIC_SITE: PublicSiteSettings = {
  enabled: false,
  contactEmail: "",
  etsy: "",
  shopify: "",
};

export interface ArtistProfile {
  name: string;
  bio: string;
  statement: string;
  website: string;
  instagram: string;
  avatarUri?: string;
  publicSite: PublicSiteSettings;
}

const DEFAULT_PROFILE: ArtistProfile = {
  name: "",
  bio: "",
  statement: "",
  website: "",
  instagram: "",
  publicSite: DEFAULT_PUBLIC_SITE,
};

interface ProfileContextType {
  profile: ArtistProfile;
  /** True once the initial cache + Supabase load has settled. */
  hydrated: boolean;
  updateProfile: (updates: Partial<ArtistProfile>) => Promise<void>;
  updatePublicSite: (updates: Partial<PublicSiteSettings>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
// Cache key is namespaced per user (see PotteryContext for the rationale).
const STORAGE_PREFIX = "@glazevault_profile_v1";
const cacheKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

function normalizeProfile(raw: Partial<ArtistProfile>): ArtistProfile {
  // Whitelist publicSite to the current schema so legacy keys (e.g. the old
  // profile-side `featuredCollectionIds`, now replaced by per-collection
  // `featuredOnSite`) are dropped and never re-persisted.
  const rawSite = (raw.publicSite ?? {}) as Partial<PublicSiteSettings>;
  const publicSite: PublicSiteSettings = {
    enabled: rawSite.enabled ?? DEFAULT_PUBLIC_SITE.enabled,
    contactEmail: rawSite.contactEmail ?? DEFAULT_PUBLIC_SITE.contactEmail,
    etsy: rawSite.etsy ?? DEFAULT_PUBLIC_SITE.etsy,
    shopify: rawSite.shopify ?? DEFAULT_PUBLIC_SITE.shopify,
  };
  return { ...DEFAULT_PROFILE, ...raw, publicSite };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { userId, authReady } = useAuth();
  const [profile, setProfile] = useState<ArtistProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  // Mirror of the latest profile so concurrent updates merge against fresh
  // state instead of a stale render closure (prevents rapid toggle/selector
  // saves from clobbering each other).
  const profileRef = useRef(profile);
  profileRef.current = profile;
  // Latest userId for the stable callbacks below.
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  // Serializes AsyncStorage writes so rapid successive saves commit in order and
  // an older snapshot can never overwrite a newer one.
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  // Whether the profile holds any user-entered data worth migrating to Supabase
  // on first connect (avoids pushing an empty default row).
  const hasContent = useCallback((p: ArtistProfile): boolean => {
    return Boolean(
      p.name || p.bio || p.statement || p.website || p.instagram || p.avatarUri
    );
  }, []);

  // Writes to the per-user AsyncStorage cache only. No-ops when signed out.
  const persistCache = useCallback(async (updated: ArtistProfile) => {
    profileRef.current = updated;
    setProfile(updated);
    const uid = userIdRef.current;
    if (!uid) return;
    const key = cacheKey(uid);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved profile", updated.name || "(unnamed)");
  }, []);

  // Hydrate per signed-in user; gated on authReady (see PotteryContext). The
  // sign-up bootstrap (AuthContext) has already ensured a remote profile row by
  // the time this runs, so the remote-wins branch loads the artist's profile.
  useEffect(() => {
    let cancelled = false;
    if (!userId || !authReady) {
      profileRef.current = DEFAULT_PROFILE;
      setProfile(DEFAULT_PROFILE);
      setHydrated(false);
      return;
    }
    const key = cacheKey(userId);
    (async () => {
      // 1. Local cache first.
      let cached: ArtistProfile = DEFAULT_PROFILE;
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          cached = normalizeProfile(JSON.parse(data));
          profileRef.current = cached;
          setProfile(cached);
          console.log("Loaded profile", cached.name || "(unnamed)");
          if (cached.avatarUri) console.log("Loaded profile avatar", cached.avatarUri.slice(0, 40));
        } else {
          console.log("Loaded profile", "(none)");
        }
      } catch (e) {
        console.warn("Failed to load profile", e);
      }

      // 2. Supabase is the source of truth when configured + reachable.
      if (isSupabaseConfigured) {
        try {
          const remote = await loadProfileRemote(userId);
          if (cancelled) return;
          if (remote) {
            const next = normalizeProfile({ ...cached, ...remote });
            profileRef.current = next;
            setProfile(next);
            await AsyncStorage.setItem(key, JSON.stringify(next));
            console.log("[supabase] loaded profile", next.name || "(unnamed)");
          } else if (hasContent(cached)) {
            console.log("[supabase] migrating local profile");
            await saveProfileRemote(cached, userId).catch((e) =>
              console.warn("[supabase] migrate profile failed", e)
            );
          }
        } catch (e) {
          console.warn("[supabase] loadProfile failed, using local cache", e);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authReady, hasContent]);

  const updateProfile = useCallback(
    async (updates: Partial<ArtistProfile>) => {
      const updated = { ...profileRef.current, ...updates };
      await persistCache(updated);
      const uid = userIdRef.current;
      if (isSupabaseConfigured && uid) {
        try {
          const saved = await saveProfileRemote(updated, uid);
          // Fold any uploaded avatar URL back into the cache.
          if (saved.avatarUri !== updated.avatarUri) {
            await persistCache({ ...profileRef.current, avatarUri: saved.avatarUri });
          }
        } catch (e) {
          console.warn("[supabase] saveProfile failed (kept in local cache)", e);
        }
      }
    },
    [persistCache]
  );

  const updatePublicSite = useCallback(
    async (updates: Partial<PublicSiteSettings>) => {
      await updateProfile({ publicSite: { ...profileRef.current.publicSite, ...updates } });
    },
    [updateProfile]
  );

  return (
    <ProfileContext.Provider value={{ profile, hydrated, updateProfile, updatePublicSite }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

// The slug derivation lives in a dependency-free module (`@/constants/slug`) so
// the data service can resolve a public artist by slug without importing this
// context (which would be circular). Re-exported here for the many call sites
// that already import it from the profile context.
export { publicSiteSlug };

export const PUBLIC_SITE_DOMAIN = "glazevault.art";

/**
 * Resolves the live origin the public web pages are actually served from, so a
 * shared link RESOLVES today instead of pointing at a domain that isn't wired
 * up yet. The public exhibition pages live as web routes inside this same app,
 * so the running host already serves them. Order of precedence:
 *   1. EXPO_PUBLIC_PUBLIC_SITE_URL — explicit override. Set this to
 *      `https://glazevault.art` once that custom domain is connected at deploy.
 *   2. EXPO_PUBLIC_DOMAIN — the Replit dev/prod host the app runs on (already
 *      set in the expo workflow), so links work immediately.
 *   3. The canonical brand domain as a last resort.
 */
// Last-resort public origin when no env host is injected (e.g. a runtime where
// EXPO_PUBLIC_DOMAIN wasn't set). The current Replit public domain serves the
// public pages today, so links still resolve — unlike the not-yet-connected
// brand domain, which would 404.
const REPLIT_FALLBACK_ORIGIN =
  "https://5f3a3e03-daa6-4dbc-8c84-41a7d9ee3d10-00-1i7gcdnbgsjs7.spock.replit.dev";

function resolvePublicOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    const host = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }
  console.warn(
    "[glazevault] public origin: EXPO_PUBLIC_PUBLIC_SITE_URL / EXPO_PUBLIC_DOMAIN are unset; using Replit fallback origin",
    REPLIT_FALLBACK_ORIGIN,
  );
  return REPLIT_FALLBACK_ORIGIN;
}

/**
 * Canonical, fully-qualified base URL for an artist's public site. Every public
 * share link (portfolio, collection, piece) is built from this single root so a
 * copied or natively-shared link is always well-formed (https, no trailing
 * slash) and points at a host that actually serves the public pages.
 */
export function publicBaseUrl(name: string): string {
  return `${resolvePublicOrigin()}/${publicSiteSlug(name)}`;
}

/** Public link to the artist's portfolio (the public-site root). */
export function portfolioShareUrl(name: string): string {
  return publicBaseUrl(name);
}

/** Public link to a single collection (a mini-exhibition). */
export function collectionShareUrl(name: string, collectionId: string): string {
  return `${publicBaseUrl(name)}/collection/${collectionId}`;
}

/** Public link to a single piece. */
export function pieceShareUrl(name: string, pieceId: string): string {
  return `${publicBaseUrl(name)}/piece/${pieceId}`;
}

/**
 * Display label for a public link: the canonical base URL without its scheme, so
 * previews show the SAME host that Share / Copy actually use — never a stale
 * brand domain that wouldn't resolve yet.
 */
export function publicSiteLabel(name: string): string {
  return publicBaseUrl(name).replace(/^https?:\/\//, "");
}
