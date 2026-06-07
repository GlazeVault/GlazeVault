import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { ensureProfile, type ProfileSeed } from "@/services/dataService";
import { isSupabaseConfigured, supabase } from "@/services/supabase";

/**
 * Auth is the outermost data provider. It owns the Supabase session and exposes
 * the current `userId` that every data context scopes its storage + queries by.
 *
 * `authReady` is the gate the data contexts wait on: it flips true only AFTER
 * the signed-in user's profile row is ensured. Every account — including the
 * very first — starts with a completely empty archive: no anonymous / demo /
 * pre-auth data is ever inherited. Owner data is read strictly by `user_id`
 * (see dataService), so one account can never see another's private archive.
 *
 * When Supabase is not configured the app degrades to a single local offline
 * user so the on-device cache still works without any sign-in.
 */

const LOCAL_OFFLINE_USER_ID = "local-offline";

export type SignUpInput = {
  email: string;
  password: string;
  /**
   * Optional. Signup is deliberately email + password only (zero friction for
   * alpha); the artist fills in their display name and other profile details
   * later from the Profile tab. An empty name renders gracefully ("Your Studio").
   */
  name?: string;
  website?: string;
  instagram?: string;
  avatarUri?: string;
};

export type SignUpResult = {
  /**
   * True when Supabase created the account but withheld a session pending email
   * confirmation. The caller should tell the artist to check their inbox; the
   * profile seed is applied on their first successful login (from user
   * metadata).
   */
  needsConfirmation: boolean;
};

interface AuthContextType {
  /** True while the initial session is being resolved. */
  loading: boolean;
  /** Whether Supabase auth is available (env configured). */
  isConfigured: boolean;
  session: Session | null;
  user: User | null;
  /** The owner id every data context scopes by, or null when signed out. */
  userId: string | null;
  /** True once the signed-in user's profile bootstrap has settled. */
  authReady: boolean;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  return typeof v === "string" ? v : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authReady, setAuthReady] = useState(false);

  // The seed captured at sign-up, applied to the new profile row once the
  // session is established. Cleared after the first bootstrap.
  const pendingSeedRef = useRef<ProfileSeed | null>(null);
  // The userId we have already bootstrapped (ensured profile + claimed), so we
  // don't repeat the work on every auth event for the same user.
  const bootstrappedFor = useRef<string | null>(null);

  const user = session?.user ?? null;
  const userId = isSupabaseConfigured
    ? (user?.id ?? null)
    : LOCAL_OFFLINE_USER_ID;

  // Resolve the initial session and subscribe to changes.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      console.log("[auth] initial session", data.session ? data.session.user.id : "none");
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      console.log("[auth] state change", event, next ? next.user.id : "none");
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Bootstrap: once a user is present, ensure their profile row exists.
  // authReady gates data hydration on this. No anonymous / legacy data is ever
  // claimed — every account starts empty.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Offline single-user mode: nothing to bootstrap, always ready.
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    if (!userId) {
      bootstrappedFor.current = null;
      setAuthReady(false);
      return;
    }
    if (bootstrappedFor.current === userId) return;
    (async () => {
      try {
        const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
        const seed: ProfileSeed = pendingSeedRef.current ?? {
          name: metaString(meta, "name"),
          website: metaString(meta, "website"),
          instagram: metaString(meta, "instagram"),
        };
        await ensureProfile(userId, seed);
      } catch (e) {
        console.warn("[auth] bootstrap failed", e);
      } finally {
        pendingSeedRef.current = null;
        if (!cancelled) {
          bootstrappedFor.current = userId;
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<SignUpResult> => {
      if (!supabase) throw new Error("Supabase is not configured.");
      pendingSeedRef.current = {
        name: input.name ?? "",
        website: input.website,
        instagram: input.instagram,
        avatarUri: input.avatarUri,
      };
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name ?? "",
            website: input.website ?? "",
            instagram: input.instagram ?? "",
          },
        },
      });
      if (error) {
        pendingSeedRef.current = null;
        throw error;
      }
      // No session means email confirmation is required; the seed can't be
      // written yet (no auth), so it will be re-derived from metadata on login.
      return { needsConfirmation: !data.session };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    bootstrappedFor.current = null;
    setAuthReady(false);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        isConfigured: isSupabaseConfigured,
        session,
        user,
        userId,
        authReady,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
