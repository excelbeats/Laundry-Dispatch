import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
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

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const inAuthGroup = seg0 === "(auth)";

    if (!isAuthenticated) {
      const seg = seg0 as string;
      const isPublic = inAuthGroup || seg === "forgot-password" || seg === "reset-password";
      if (!isPublic) router.replace("/(auth)/login");
      return;
    }

    // Wait until the profile (role) is loaded before routing.
    if (role == null) return;

    const homeFor =
      role === "admin" ? "/admin-dashboard" : role === "driver" ? "/driver-dashboard" : "/(tabs)/(home)";

    // Just signed in (still on the auth screens) → send to the role's home.
    if (inAuthGroup) {
      router.replace(homeFor);
      return;
    }

    // Keep each role inside its own area — bounce out of another role's section.
    const inWrongSection =
      (seg0 === "(tabs)" && role !== "customer") ||
      (seg0 === "driver-dashboard" && role !== "driver") ||
      (seg0 === "admin-dashboard" && role !== "admin");
    if (inWrongSection) router.replace(homeFor);
  }, [loading, isAuthenticated, role, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="schedule-pickup" options={{ ...headerScreen("Schedule Pickup"), presentation: "modal" }} />
      <Stack.Screen name="add-address" options={{ ...headerScreen("Add Address"), presentation: "modal" }} />
      <Stack.Screen name="order-details" options={headerScreen("Order Details")} />
      <Stack.Screen name="order-tracking" options={headerScreen("Live Tracking")} />
      <Stack.Screen name="notifications" options={headerScreen("Notifications")} />
      <Stack.Screen name="membership" options={headerScreen("Membership")} />
      <Stack.Screen name="forgot-password" options={headerScreen("Reset Password")} />
      <Stack.Screen name="reset-password" options={headerScreen("New Password")} />
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
