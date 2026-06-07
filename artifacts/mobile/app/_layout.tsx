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
import { StyleSheet, View } from "react-native";
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
  "settings",
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

  const first = segments[0];
  const inAuthGroup = first === "auth";
  const publicRoute = isPublicRoute(first);

  useEffect(() => {
    if (loading) return;
    // Offline mode: never gate.
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
 * Anti-flash gate. The AuthGate redirect above runs in an effect, i.e. AFTER the
 * target screen has already mounted and painted — so a signed-out (or still-
 * resolving) visitor would briefly SEE a private studio screen before being
 * bounced to /auth. This opaque cover sits on top of the Stack and blanks the
 * private screen during that window, so an unauthenticated user never visibly
 * enters the app: they only ever see the calm welcome/auth screen.
 *
 * It only covers private routes; the auth flow and live public exhibition
 * (`[slug]`) pages are never covered. In offline mode (Supabase unconfigured)
 * it's a no-op, matching AuthGate.
 */
function RouteGuardCover() {
  const { loading, userId, isConfigured } = useAuth();
  const segments = useSegments();
  const colors = useColors();
  if (!isConfigured) return null;
  if (isPublicRoute(segments[0])) return null;
  const blocked = loading || !userId;
  if (!blocked) return null;
  return (
    <View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.background, zIndex: 50 },
      ]}
    />
  );
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
                      <RouteGuardCover />
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
