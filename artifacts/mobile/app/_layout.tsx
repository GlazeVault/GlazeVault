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
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ActionSheetHost } from "@/components/ActionSheetHost";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastHost } from "@/components/ToastHost";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CollectionsProvider } from "@/context/CollectionsContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { PotteryProvider } from "@/context/PotteryContext";
import { SavedProvider } from "@/context/SavedContext";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * The private studio app's route roots. Everything here requires a signed-in
 * owner. Any other first segment is treated as a live public exhibition page
 * (the dynamic `[slug]` routes), which is intentionally viewable by link without
 * a session.
 */
const PRIVATE_ROOTS = new Set([
  "(tabs)",
  "piece",
  "collection",
  "public-site",
  "archive",
  "auth",
  "+not-found",
]);

/**
 * A route reachable WITHOUT a session: the auth flow itself, or a live public
 * exhibition page (the dynamic `[slug]` root — anything not in PRIVATE_ROOTS).
 * Everything else is the private studio and requires a signed-in user.
 */
function isPublicRoute(first: string | undefined): boolean {
  if (first === "auth") return true;
  return !!first && !PRIVATE_ROOTS.has(first);
}

/**
 * Deterministic landing redirect. `Stack.Protected` (below) is the real gate —
 * it removes the private studio screens from the navigator entirely whenever the
 * user is not authenticated, so private content is never mounted or reachable by
 * URL. This effect just picks the right destination once auth is known: a
 * signed-out visitor on a private route lands on the welcome/auth screen, and a
 * signed-in user who somehow lands on the auth flow is sent into the studio.
 * Public `[slug]` exhibition routes are never redirected.
 */
function AuthGate() {
  const { loading, userId, isConfigured } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  const first = segments[0];
  const inAuthGroup = first === "auth";
  const publicRoute = isPublicRoute(first);

  useEffect(() => {
    if (loading) return;
    // Offline mode: single local user, never gate.
    if (!isConfigured) return;
    const signedIn = !!userId;
    if (!signedIn && !publicRoute) {
      router.replace("/auth");
    } else if (signedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
    // pathname is included so the guard re-evaluates on every navigation.
  }, [loading, userId, isConfigured, inAuthGroup, publicRoute, pathname, router]);

  return null;
}

/**
 * The auth-aware root navigator. This is the heart of the entry architecture:
 *
 *  1. On launch it holds a calm blank screen until the Supabase session has been
 *     resolved, so we never flash the wrong stack before we know who the user is.
 *  2. It then renders exactly one of two stacks via `Stack.Protected`:
 *       - signed in  → the private Studio stack (tabs, archive, collections,
 *         portfolio, piece/collection detail + editors).
 *       - signed out → only the Auth stack (welcome / create account / log in).
 *     The locked stack's screens are not part of the navigator at all, so an
 *     unauthenticated visitor can never mount or deep-link into the studio.
 *  3. Public `[slug]` exhibition routes sit outside both guards — they stay
 *     viewable by anyone with the link, signed in or not.
 *
 * Offline mode (Supabase unconfigured) runs as a single local user, so the
 * studio is always unlocked.
 */
function RootNavigator() {
  const { loading, userId, isConfigured } = useAuth();
  const colors = useColors();

  if (isConfigured && loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const studioUnlocked = !isConfigured || !!userId;

  return (
    <>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Private Studio — only mounted for an authenticated owner. */}
        <Stack.Protected guard={studioUnlocked}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="piece/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="piece/edit/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="collection/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="collection/new" options={{ presentation: "modal" }} />
          <Stack.Screen name="public-site" options={{ presentation: "card" }} />
          <Stack.Screen name="archive" options={{ presentation: "card" }} />
        </Stack.Protected>

        {/* Auth stack — the only thing a signed-out visitor can reach (besides
            the public exhibition routes below). */}
        <Stack.Protected guard={!studioUnlocked}>
          <Stack.Screen name="auth" />
        </Stack.Protected>

        {/* Live public web exhibition routes (served by the expo web build at the
            artist's slug). Intentionally open to anyone with the link — never
            gated. The slug root is the public foyer; portfolio/collections/
            archive are its doorways. */}
        <Stack.Screen name="[slug]/index" />
        <Stack.Screen name="[slug]/portfolio" />
        <Stack.Screen name="[slug]/collections" />
        <Stack.Screen name="[slug]/archive" />
        <Stack.Screen name="[slug]/piece/[id]" />
        <Stack.Screen name="[slug]/collection/[id]" />
      </Stack>
      <ToastHost />
      <ActionSheetHost />
    </>
  );
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
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <RootNavigator />
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
