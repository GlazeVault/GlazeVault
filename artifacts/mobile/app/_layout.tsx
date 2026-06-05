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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ActionSheetHost } from "@/components/ActionSheetHost";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastHost } from "@/components/ToastHost";
import { CollectionsProvider } from "@/context/CollectionsContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { PotteryProvider } from "@/context/PotteryContext";
import { SavedProvider } from "@/context/SavedContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
          <PotteryProvider>
            <CollectionsProvider>
              <ProfileProvider>
                <SavedProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
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
                      {/* Live public web exhibition routes (served by the expo
                          web build at the artist's slug). */}
                      <Stack.Screen name="[slug]/index" />
                      <Stack.Screen name="[slug]/piece/[id]" />
                      <Stack.Screen name="[slug]/collection/[id]" />
                    </Stack>
                    <ToastHost />
                    <ActionSheetHost />
                  </KeyboardProvider>
                </GestureHandlerRootView>
                </SavedProvider>
              </ProfileProvider>
            </CollectionsProvider>
          </PotteryProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
