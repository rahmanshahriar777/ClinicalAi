import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Button, s } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';

function Gate() {
  const { user, loading, locked, unlock } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(patient)');
  }, [user, loading, segments, router]);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  if (locked) {
    return (
      <View style={[s.screen, { justifyContent: 'center' }]}>
        <Text style={s.h1}>Locked</Text>
        <Text style={s.muted}>Unlock to view your health information.</Text>
        <Button title="Unlock" onPress={() => void unlock()} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}
