import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Button, ErrorText, Screen } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

// Keep the splash screen up until we know who's signed in.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { session, profile, loading, profileError, reloadProfile } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hide();
  }, [loading]);

  // Online-only: if we can't reach Supabase, say so instead of guessing which screen to show.
  if (session && profileError) {
    return (
      <Screen>
        <ErrorText>{profileError}</ErrorText>
        <Button label="Try again" onPress={reloadProfile} />
      </Screen>
    );
  }

  const signedIn = session !== null;
  const hasProfile = profile !== null;

  // Each group is only reachable when its guard is true. When a guard flips
  // (e.g. the code is verified), Expo Router moves the user to the first screen
  // they're allowed to see, in the order listed here.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn && hasProfile}>
        <Stack.Screen name="index" />
        {/* No swipe back: leaving goes through the ✕ and its confirmation. */}
        <Stack.Screen name="practice" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasProfile}>
        <Stack.Screen name="name" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>
    </Stack>
  );
}
