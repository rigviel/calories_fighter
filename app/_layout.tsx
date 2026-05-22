import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  useFrameworkReady();
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        setIsOnboarded(!!data);
      } else {
        setIsOnboarded(null);
      }
    };
    checkOnboarding();
  }, []);

  if (isOnboarded === null) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        <Stack.Screen name="weekly-result" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
