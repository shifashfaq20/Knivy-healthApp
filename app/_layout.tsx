import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk';
import { Newsreader_400Regular, Newsreader_500Medium, useFonts } from '@expo-google-fonts/newsreader';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/database';
import { configureNotifications } from '../src/services/notifications';
import { queryClient } from '../src/services/queryClient';
import { useProfileHydrated } from '../src/stores/profileStore';
import { colors, fonts } from '../src/theme/tokens';
import '../src/utils/webAlert';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const hydrated = useProfileHydrated();

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e: unknown) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Fonts failing to load shouldn't block the app; system fonts are used instead.
  const ready = (fontsLoaded || !!fontError) && dbReady && hydrated;

  useEffect(() => {
    if (ready || dbError) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, dbError]);

  if (dbError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory, justifyContent: 'center', padding: 32, gap: 12 }}>
        <Text style={{ fontSize: 22, color: colors.ink, fontWeight: '600' }}>Knivy couldn’t open its storage</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>
          Your data hasn’t been changed. Close and reopen the app. If this keeps happening, free up some space on your phone.
        </Text>
        <Text style={{ fontSize: 12, color: colors.taupe }}>{dbError}</Text>
      </View>
    );
  }

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.ivory },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: fonts.bodyStrong, fontSize: 17 },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.ivory },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
