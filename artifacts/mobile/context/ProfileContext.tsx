import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/services/supabase";
import {
  loadProfile as loadProfileRemote,
  saveProfile as saveProfileRemote,
} from "@/services/dataService";
import { normalizePublicHandle, publicSiteSlug } from "@/constants/slug";

export interface PublicSiteSettings {
  enabled: boolean;
  handle: string;
  contactEmail: string;
  showContactEmail: boolean;
  etsy: string;
  shopify: string;
}

export const DEFAULT_PUBLIC_SITE: PublicSiteSettings = {
  enabled: false,
  handle: "",
  contactEmail: "",
  showContactEmail: false,
  etsy: "",
  shopify: "",
};

export interface ArtistProfile {
  name: string;
  /**
   * Optional single-line identity shown under the artist name on the public
   * landing page — a studio name, short motto, nickname, or one-line statement.
   * Empty = nothing rendered.
   */
  tagline: string;
  bio: string;
  statement: string;
  website: string;
  instagram: string;
  /** Small round profile photo. SEPARATE from the hero image. */
  avatarUri?: string;
  /**
   * Large landing/portfolio hero image. Independent of `avatarUri` — changing
   * one never changes the other. Empty/undefined renders the calm placeholder.
   */
  heroImageUri?: string;
  /**
   * Vertical focal point (0 = top, 1 = bottom) used only when the hero image is
   * taller than its display frame. Lets the artist reposition without distorting
   * proportions or aggressively cropping. Defaults to centered.
   */
  heroFocalY?: number;
  /**
   * Horizontal focal point (0 = left, 1 = right). Only meaningful when the hero
   * is zoomed in (otherwise there is no horizontal overflow). Defaults centered.
   */
  heroFocalX?: number;
  /**
   * Hero zoom factor (>= 1). 1 shows the image at its natural frame size; higher
   * values scale it up so the focal point can crop/reposition within the frame.
   */
  heroZoom?: number;
  publicSite: PublicSiteSettings;
}

const DEFAULT_PROFILE: ArtistProfile = {
  name: "",
  tagline: "",
  bio: "",
  statement: "",
  website: "",
  instagram: "",
  heroFocalY: 0.5,
  heroFocalX: 0.5,
  heroZoom: 1,
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

// The AsyncStorage cache is METADATA-ONLY on web (see PotteryContext). Base64
// `data:` avatar/hero payloads overflow localStorage (~5MB); only https Supabase
// URLs and native relative paths are cached. Full-res `data:` URIs stay in memory
// until upload; the remote URL is folded back in after saveProfileRemote.
function isCacheableUri(uri: string | undefined): boolean {
  return !!uri && !uri.startsWith("data:");
}
/** Strips base64 `data:` image URIs before writing profile to AsyncStorage. */
export function toCacheSafeProfile(p: ArtistProfile): ArtistProfile {
  return {
    ...p,
    avatarUri: isCacheableUri(p.avatarUri) ? p.avatarUri : undefined,
    heroImageUri: isCacheableUri(p.heroImageUri) ? p.heroImageUri : undefined,
  };
}

function normalizeProfile(raw: Partial<ArtistProfile>): ArtistProfile {
  // Whitelist publicSite to the current schema so legacy keys (e.g. the old
  // profile-side `featuredCollectionIds`, now replaced by per-collection
  // `featuredOnSite`) are dropped and never re-persisted.
  const rawSite = (raw.publicSite ?? {}) as Partial<PublicSiteSettings>;
  const publicSite: PublicSiteSettings = {
    enabled: rawSite.enabled ?? DEFAULT_PUBLIC_SITE.enabled,
    handle:
      normalizePublicHandle(rawSite.handle ?? "") ||
      publicSiteSlug(raw.name ?? ""),
    contactEmail: rawSite.contactEmail ?? DEFAULT_PUBLIC_SITE.contactEmail,
    showContactEmail: rawSite.showContactEmail ?? DEFAULT_PUBLIC_SITE.showContactEmail,
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
      p.name || p.tagline || p.bio || p.statement || p.website || p.instagram || p.avatarUri
    );
  }, []);

  // Writes to the per-user AsyncStorage cache only. No-ops when signed out.
  const persistCache = useCallback(async (updated: ArtistProfile) => {
    profileRef.current = updated;
    setProfile(updated);
    const uid = userIdRef.current;
    if (!uid) return;
    const key = cacheKey(uid);
    // METADATA-ONLY (toCacheSafeProfile strips base64) + FAIL-SOFT: a cache write
    // error (e.g. localStorage quota) is logged but NEVER thrown, so it can never
    // block the remote Supabase write that follows in updateProfile.
    const snapshot = JSON.stringify(toCacheSafeProfile(updated));
    const write = writeChain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, snapshot))
      .then(() => {
        console.log("Saved profile", updated.name || "(unnamed)");
      })
      .catch((e) => {
        console.warn(
          "[glazevault] profile cache write failed (kept in memory + Supabase)",
          e
        );
      });
    writeChain.current = write;
    await write;
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
            await persistCache(next);
            console.log("[supabase] loaded profile", next.name || "(unnamed)");
          } else if (hasContent(cached)) {
            console.log("[supabase] migrating local profile");
            try {
              const saved = await saveProfileRemote(cached, userId);
              await persistCache(normalizeProfile({ ...cached, ...saved }));
            } catch (e) {
              console.warn("[supabase] migrate profile failed", e);
            }
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
  }, [userId, authReady, hasContent, persistCache]);

  const updateProfile = useCallback(
    async (updates: Partial<ArtistProfile>) => {
      const updated = { ...profileRef.current, ...updates };
      await persistCache(updated);
      const uid = userIdRef.current;
      if (isSupabaseConfigured && uid) {
        try {
          const saved = await saveProfileRemote(updated, uid);
          // Fold any uploaded avatar/hero URLs back into the cache so the local
          // copy matches the post-upload remote URLs (both upload separately).
          if (
            saved.avatarUri !== updated.avatarUri ||
            saved.heroImageUri !== updated.heroImageUri
          ) {
            await persistCache({
              ...profileRef.current,
              avatarUri: saved.avatarUri,
              heroImageUri: saved.heroImageUri,
            });
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

export const PUBLIC_SITE_DOMAIN = "www.glazevault.com";

type PublicIdentity = string | Pick<ArtistProfile, "name" | "publicSite">;

export function publicSiteHandle(identity: PublicIdentity): string {
  if (typeof identity === "string") return publicSiteSlug(identity);
  return normalizePublicHandle(identity.publicSite.handle) || publicSiteSlug(identity.name);
}

/**
 * Resolves the live origin the public web pages are actually served from, so a
 * shared link RESOLVES today instead of pointing at a domain that isn't wired
 * up yet. The public exhibition pages live as web routes inside this same app,
 * so the running host already serves them. Order of precedence:
 *   1. On web, the live origin the page is currently served from
 *      (`window.location.origin`). This is ALWAYS the host that actually serves
 *      the public pages right now, so a copied/shared link resolves without
 *      relying on a hardcoded deployment host. It also keeps localhost links
 *      testable in dev.
 *   2. EXPO_PUBLIC_PUBLIC_SITE_URL — explicit override for native/production
 *      builds, e.g. `https://www.glazevault.com`.
 *   3. EXPO_PUBLIC_DOMAIN — a host injected via env (mainly for native builds,
 *      which have no `window`).
 *   4. The canonical GlazeVault public domain as an absolute last resort.
 */
const FALLBACK_PUBLIC_ORIGIN = `https://${PUBLIC_SITE_DOMAIN}`;

function resolvePublicOrigin(): string {
  // On web the app is already being served from the live public host, so the
  // current origin is exactly the host that serves the public pages right now.
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    return window.location.origin.replace(/\/+$/, "");
  }
  const explicit = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    const host = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }
  console.warn(
    "[glazevault] public origin: no explicit override, web origin, or EXPO_PUBLIC_DOMAIN; using canonical fallback origin",
    FALLBACK_PUBLIC_ORIGIN,
  );
  return FALLBACK_PUBLIC_ORIGIN;
}

/**
 * Canonical, fully-qualified base URL for an artist's public site. Every public
 * share link (portfolio, collection, piece) is built from this single root so a
 * copied or natively-shared link is always well-formed (https, no trailing
 * slash) and points at a host that actually serves the public pages.
 */
export function publicBaseUrl(identity: PublicIdentity): string {
  return `${resolvePublicOrigin()}/${publicSiteHandle(identity)}`;
}

/** Public link to the artist's portfolio (the public-site root). */
export function portfolioShareUrl(identity: PublicIdentity): string {
  return publicBaseUrl(identity);
}

/** Public link to a single collection (a mini-exhibition). */
export function collectionShareUrl(identity: PublicIdentity, collectionId: string): string {
  return `${publicBaseUrl(identity)}/collection/${collectionId}`;
}

/** Public link to a single piece. */
export function pieceShareUrl(identity: PublicIdentity, pieceId: string): string {
  return `${publicBaseUrl(identity)}/piece/${pieceId}`;
}

/**
 * Display label for a public link: the canonical base URL without its scheme, so
 * previews show the SAME host that Share / Copy actually use — never a stale
 * brand domain that wouldn't resolve yet.
 */
export function publicSiteLabel(identity: PublicIdentity): string {
  return publicBaseUrl(identity).replace(/^https?:\/\//, "");
}
