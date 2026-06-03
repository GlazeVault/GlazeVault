// Supabase client for GlazeVault.
//
// Supabase is the source of truth for pieces, collections, and the artist
// profile. AsyncStorage is only an offline cache (see the context providers).
//
// ── Required environment variables ──────────────────────────────────────────
// The app reads these at bundle time. In Replit they are stored as Secrets and
// injected into the Expo process; Expo inlines any `EXPO_PUBLIC_*` var into the
// client bundle. After setting/changing them you MUST restart the
// `artifacts/mobile: expo` workflow so the new values are picked up.
//
//   EXPO_PUBLIC_SUPABASE_URL       e.g. https://abcdefgh.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY  the project's public anon/publishable key
//
// Find both in your Supabase dashboard under: Project Settings → API.
// See `supabase/SETUP.md` for the full one-time setup (tables + storage bucket).
//
// If either var is missing the app still runs fully offline against the
// AsyncStorage cache — `isSupabaseConfigured` is false and every remote call is
// skipped, so nothing crashes.

import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * True only when both credentials are present and look like a real Supabase
 * project URL. Callers gate every remote operation on this so a missing or
 * placeholder config degrades to offline-only behaviour instead of throwing.
 */
export const isSupabaseConfigured: boolean =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 0;

/** Storage bucket that holds piece / collection / avatar images. */
export const IMAGE_BUCKET = "images";

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Not configured — running offline against the local cache only.\n" +
      "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (then restart\n" +
      "the expo workflow) to sync to Supabase. See artifacts/mobile/supabase/SETUP.md.",
  );
} else {
  console.log("[supabase] Configured for", SUPABASE_URL);
}

/**
 * The shared client, or `null` when not configured. Prefer importing the typed
 * data-service functions in `dataService.ts` over using this directly.
 *
 * Auth session persistence is disabled: GlazeVault has no user auth yet, so we
 * never need to store a session and we avoid pulling in an AsyncStorage auth
 * adapter.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
