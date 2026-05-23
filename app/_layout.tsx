import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect, useState } from 'react';
import { getSession, isUserOnboarded } from '@/lib/local-store';
import { View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RootLayout() {
  useFrameworkReady();
  const [isReady, setIsReady] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSession();

        if (session?.user?.id) {
          setIsOnboarded(await isUserOnboarded(session.user.id));
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      }
      setIsReady(true);
    };
    init();
  }, []);

  if (!isReady) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FBBF24" size="large" />
        <StatusBar style="light" />
      </LinearGradient>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          <Stack.Screen name="onboarding" options={{ headerShown: false, animationEnabled: false }} />
        ) : (
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animationEnabled: false }} />
        )}
        <Stack.Screen name="weekly-result" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
