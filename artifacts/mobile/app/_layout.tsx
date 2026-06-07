import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  useFonts as usePoppinsFonts,
} from "@expo-google-fonts/poppins";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_400Regular_Italic,
  useFonts as usePlayfairFonts,
} from "@expo-google-fonts/playfair-display";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccountButton } from "@/components/AccountButton";
import { ActionSheetHost } from "@/components/ActionSheetHost";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastHost } from "@/components/ToastHost";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CollectionsProvider } from "@/context/CollectionsContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { PotteryProvider } from "@/context/PotteryContext";
import { SavedProvider } from "@/context/SavedContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Redirects based on auth state. Two route groups are always public and never
 * require a session:
 *  - `auth/*`   — the sign-in / sign-up flow itself.
 *  - `[slug]/*` — live public exhibition pages, viewable by link (incl. anon).
 * Everything else (the private studio archive) requires a signed-in user.
 *
 * When Supabase isn't configured the app runs as a single local offline user
 * (userId is always set), so the guard is effectively a no-op and the archive
 * is reachable without any sign-in.
 */
function AuthGate() {
  const { loading, userId, isConfigured } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  const inAuthGroup = segments[0] === "auth";
  // Public exhibition routes live at the artist slug, i.e. the first segment is
  // a dynamic `[slug]` (anything that isn't one of our known private groups).
  const PRIVATE_ROOTS = new Set([
    "(tabs)",
    "piece",
    "collection",
    "public-site",
    "archive",
    "settings",
    "auth",
    "+not-found",
  ]);
  const first = segments[0];
  const isPublicSlugRoute = !!first && !PRIVATE_ROOTS.has(first);

  useEffect(() => {
    if (loading) return;
    // Offline mode: never gate.
    if (!isConfigured) return;
    const signedIn = !!userId;
    if (!signedIn && !inAuthGroup && !isPublicSlugRoute) {
      router.replace("/auth");
    } else if (signedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
    // pathname is included so the guard re-evaluates on every navigation.
  }, [loading, userId, isConfigured, inAuthGroup, isPublicSlugRoute, pathname, router]);

  return null;
}

/**
 * The always-visible Account / Settings affordance. Rendered once at the root so
 * it floats over every MAIN private surface — the tab screens AND the standalone
 * Archive Stack screen — giving a signed-in artist a single, discoverable way to
 * reach their email + log out without hunting through tabs or hidden routes.
 *
 * Scoped to the home-base surfaces only: the tabs (Home/Collections/Saved/
 * Profile) and Archive. Deliberately NOT shown on the auth flow, public
 * exhibition pages, drill-in detail/modal screens, the settings screen itself,
 * or Portfolio (`public-site`) — Portfolio already has its own floating
 * top-right share control, so the account button would collide there; it stays
 * reachable from the foyer one step back.
 */
function GlobalAccountAccess() {
  const { userId, isConfigured } = useAuth();
  const segments = useSegments();
  if (!isConfigured || !userId) return null;
  const root = segments[0];
  const MAIN_ROOTS = new Set(["(tabs)", "archive"]);
  if (!root || !MAIN_ROOTS.has(root)) return null;
  return <AccountButton />;
}

export default function RootLayout() {
  const [poppinsLoaded, poppinsError] = usePoppinsFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [playfairLoaded, playfairError] = usePlayfairFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_400Regular_Italic,
  });

  const ready = (poppinsLoaded || poppinsError) && (playfairLoaded || playfairError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PotteryProvider>
              <CollectionsProvider>
                <ProfileProvider>
                  <SavedProvider>
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <AuthGate />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="auth" />
                        <Stack.Screen
                          name="piece/[id]"
                          options={{ presentation: "card" }}
                        />
                        <Stack.Screen
                          name="piece/edit/[id]"
                          options={{ presentation: "modal" }}
                        />
                        <Stack.Screen
                          name="collection/[id]"
                          options={{ presentation: "card" }}
                        />
                        <Stack.Screen
                          name="collection/new"
                          options={{ presentation: "modal" }}
                        />
                        <Stack.Screen
                          name="public-site"
                          options={{ presentation: "card" }}
                        />
                        <Stack.Screen
                          name="archive"
                          options={{ presentation: "card" }}
                        />
                        <Stack.Screen
                          name="settings"
                          options={{ presentation: "card" }}
                        />
                        {/* Live public web exhibition routes (served by the expo
                            web build at the artist's slug). The slug root is the
                            public foyer; portfolio/collections/archive are its
                            three doorways. */}
                        <Stack.Screen name="[slug]/index" />
                        <Stack.Screen name="[slug]/portfolio" />
                        <Stack.Screen name="[slug]/collections" />
                        <Stack.Screen name="[slug]/archive" />
                        <Stack.Screen name="[slug]/piece/[id]" />
                        <Stack.Screen name="[slug]/collection/[id]" />
                      </Stack>
                      <GlobalAccountAccess />
                      <ToastHost />
                      <ActionSheetHost />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                  </SavedProvider>
                </ProfileProvider>
              </CollectionsProvider>
            </PotteryProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
