import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { registerForPush } from '@/lib/notifications';
import { theme } from '@/lib/theme';

export default function PatientTabs() {
  useEffect(() => {
    registerForPush().catch(() => undefined);
  }, []);
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.primary, headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: theme.surface } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
