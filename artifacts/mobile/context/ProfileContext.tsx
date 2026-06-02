import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) {
          const next = normalizeProfile(JSON.parse(data));
          profileRef.current = next;
          setProfile(next);
          console.log("Loaded profile", next.name || "(unnamed)");
          if (next.avatarUri) console.log("Loaded profile avatar", next.avatarUri.slice(0, 40));
        } else {
          console.log("Loaded profile", "(none)");
        }
      })
      .catch((e) => console.warn("Failed to load profile", e));
  }, []);

  const updateProfile = useCallback(async (updates: Partial<ArtistProfile>) => {
    const updated = { ...profileRef.current, ...updates };
    profileRef.current = updated;
    setProfile(updated);
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)));
    writeChain.current = write;
    await write;
    console.log("Saved profile", updated.name || "(unnamed)");
  }, []);

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
