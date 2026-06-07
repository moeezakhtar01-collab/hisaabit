import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ActivityIndicator, View, Platform } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider, useColors } from "@/lib/theme-context";
import { initSmsListener, teardownSmsListener } from "@/lib/sms-processor";
import { initNotificationListener, teardownNotificationListener } from "@/lib/notification-listener";
import { SMS_ENABLED, NOTIFICATION_LISTENER_ENABLED, V2_PASSIVE_MODE } from "@/lib/feature-flags";
import * as Notifications from "expo-notifications";
import { ensureReportNotifications } from "@/lib/report-notifications";

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return;

    if (V2_PASSIVE_MODE) {
      // No login screen. While the anonymous session is still being established
      // (user null), stay put — bootstrap handles it.
      if (!user) return;
      const seg0 = segments[0];
      // Redirect the old entry points (root "/", legacy auth, tabs, demo) into
      // the v2 shell. Modals (weekly-report, settings, …) pass through untouched.
      const onLegacyEntry =
        !seg0 || seg0 === "login" || seg0 === "register" ||
        seg0 === "forgot-password" || seg0 === "(tabs)" || seg0 === "quick-demo";
      if (onLegacyEntry) router.replace("/dashboard" as any);
      return;
    }

    const inAuth = segments[0] === "login" || segments[0] === "register" || segments[0] === "forgot-password";
    const onDemo = segments[0] === "quick-demo";

    if (!user && !inAuth) {
      router.replace("/login");
    } else if (user && inAuth) {
      router.replace(user.hasSeenDemo ? "/" : "/quick-demo");
    } else if (user && !user.hasSeenDemo && !onDemo && !inAuth) {
      router.replace("/quick-demo");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, segments]);

  // Start real-time SMS listener (Android only, flagged off for v1)
  useEffect(() => {
    if (!SMS_ENABLED) return;
    if (!user || Platform.OS !== 'android') return;

    initSmsListener().catch(() => {});

    return () => teardownSmsListener();
  }, [user]);

  // Start real-time notification listener (Android only, flagged off for v1 — v1.1 scaffold)
  useEffect(() => {
    if (!NOTIFICATION_LISTENER_ENABLED) return;
    if (!user || Platform.OS !== 'android') return;

    initNotificationListener().catch(() => {});

    return () => teardownNotificationListener();
  }, [user]);

  // v2: (re)schedule the weekly + monthly report notifications once signed in.
  useEffect(() => {
    if (!V2_PASSIVE_MODE || !user) return;
    ensureReportNotifications();
  }, [user]);

  // Deep-link a tapped report notification to the weekly report.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = (response.notification.request.content.data as any)?.target;
      if (typeof target === "string") router.push(target as any);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2: quiet spinner while connecting (no anon session yet) or while about to
  // redirect a legacy entry route into the shell — avoids flashing the old tab
  // UI on cold start.
  const v2Connecting = V2_PASSIVE_MODE && (!user || (segments.length as number) === 0);
  if (isLoading || v2Connecting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back", contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="account-detail" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-expense"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="voice-expense"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="help-faq"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="sms-expenses"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="sms-settings"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="notification-settings"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="notif-debug"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="subscription"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="period-expenses"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="weekly-report"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="quick-demo"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <AuthGate />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
