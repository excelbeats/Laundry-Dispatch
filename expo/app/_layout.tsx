import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppStateProvider } from "@/hooks/useAppState";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Colors from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const headerScreen = (title: string) => ({
  title,
  headerStyle: { backgroundColor: Colors.surface },
  headerTintColor: Colors.primary,
});

function RootLayoutNav() {
  const { loading, isAuthenticated, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const didInitialRoute = useRef<boolean>(false);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated) {
      didInitialRoute.current = false;
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    // Authenticated — wait until the profile (role) is loaded before routing.
    if (role == null) return;

    if (inAuthGroup || !didInitialRoute.current) {
      didInitialRoute.current = true;
      if (role === "driver") router.replace("/driver-dashboard");
      else if (role === "admin") router.replace("/admin-dashboard");
      else router.replace("/(tabs)/(home)");
    }
  }, [loading, isAuthenticated, role, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="schedule-pickup" options={{ ...headerScreen("Schedule Pickup"), presentation: "modal" }} />
      <Stack.Screen name="order-details" options={headerScreen("Order Details")} />
      <Stack.Screen name="order-tracking" options={headerScreen("Live Tracking")} />
      <Stack.Screen name="notifications" options={headerScreen("Notifications")} />
      <Stack.Screen name="driver-dashboard" options={headerScreen("Driver Dashboard")} />
      <Stack.Screen name="admin-dashboard" options={headerScreen("Admin Panel")} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppStateProvider>
            <RootLayoutNav />
          </AppStateProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    </QueryClientProvider>
  );
}
