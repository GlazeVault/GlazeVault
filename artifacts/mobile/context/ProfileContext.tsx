import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured } from "@/services/supabase";
import {
  loadProfile as loadProfileRemote,
  saveProfile as saveProfileRemote,
} from "@/services/dataService";

export type HomepageLayout = "grid" | "editorial" | "masonry";

export interface PublicSiteSettings {
  enabled: boolean;
  homepageLayout: HomepageLayout;
  contactEmail: string;
  etsy: string;
  shopify: string;
}

export const DEFAULT_PUBLIC_SITE: PublicSiteSettings = {
  enabled: false,
  homepageLayout: "grid",
  contactEmail: "",
  etsy: "",
  shopify: "",
};

export const HOMEPAGE_LAYOUTS: { key: HomepageLayout; label: string; hint: string }[] = [
  { key: "grid", label: "Grid", hint: "Even three-column gallery" },
  { key: "editorial", label: "Editorial", hint: "Large stacked features" },
  { key: "masonry", label: "Masonry", hint: "Staggered two-column flow" },
];

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
  updateProfile: (updates: Partial<ArtistProfile>) => Promise<void>;
  updatePublicSite: (updates: Partial<PublicSiteSettings>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
const STORAGE_KEY = "@glazevault_profile_v1";

function normalizeProfile(raw: Partial<ArtistProfile>): ArtistProfile {
  // Whitelist publicSite to the current schema so legacy keys (e.g. the old
  // profile-side `featuredCollectionIds`, now replaced by per-collection
  // `featuredOnSite`) are dropped and never re-persisted.
  const rawSite = (raw.publicSite ?? {}) as Partial<PublicSiteSettings>;
  const publicSite: PublicSiteSettings = {
    enabled: rawSite.enabled ?? DEFAULT_PUBLIC_SITE.enabled,
    homepageLayout: rawSite.homepageLayout ?? DEFAULT_PUBLIC_SITE.homepageLayout,
    contactEmail: rawSite.contactEmail ?? DEFAULT_PUBLIC_SITE.contactEmail,
    etsy: rawSite.etsy ?? DEFAULT_PUBLIC_SITE.etsy,
    shopify: rawSite.shopify ?? DEFAULT_PUBLIC_SITE.shopify,
  };
  return { ...DEFAULT_PROFILE, ...raw, publicSite };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ArtistProfile>(DEFAULT_PROFILE);
  // Mirror of the latest profile so concurrent updates merge against fresh
  // state instead of a stale render closure (prevents rapid toggle/selector
  // saves from clobbering each other).
  const profileRef = useRef(profile);
  profileRef.current = profile;
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

  // Writes to the AsyncStorage cache only.
  const persistCache = useCallback(async (updated: ArtistProfile) => {
    profileRef.current = updated;
    setProfile(updated);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved profile", updated.name || "(unnamed)");
  }, []);

  useEffect(() => {
    (async () => {
      // 1. Local cache first.
      let cached: ArtistProfile = DEFAULT_PROFILE;
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
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
          const remote = await loadProfileRemote();
          if (remote) {
            const next = normalizeProfile({ ...cached, ...remote });
            profileRef.current = next;
            setProfile(next);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            console.log("[supabase] loaded profile", next.name || "(unnamed)");
          } else if (hasContent(cached)) {
            console.log("[supabase] migrating local profile");
            await saveProfileRemote(cached).catch((e) =>
              console.warn("[supabase] migrate profile failed", e)
            );
          }
        } catch (e) {
          console.warn("[supabase] loadProfile failed, using local cache", e);
        }
      }
    })();
  }, [hasContent]);

  const updateProfile = useCallback(
    async (updates: Partial<ArtistProfile>) => {
      const updated = { ...profileRef.current, ...updates };
      await persistCache(updated);
      if (isSupabaseConfigured) {
        try {
          const saved = await saveProfileRemote(updated);
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
    <ProfileContext.Provider value={{ profile, updateProfile, updatePublicSite }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

/**
 * Derives the public-facing URL slug from the artist name. Falls back to a
 * neutral placeholder so the URL preview is never empty.
 */
export function publicSiteSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "your-studio";
}

export const PUBLIC_SITE_DOMAIN = "glazevault.art";
