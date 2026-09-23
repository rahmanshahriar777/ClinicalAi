import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { Button, Card, s } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const CONSENTS: Array<{ type: 'AI_PROCESSING' | 'MESSAGING' | 'RESEARCH'; label: string; hint: string }> = [
  { type: 'AI_PROCESSING', label: 'AI assistance', hint: 'AI helps your care team draft notes and replies. A clinician reviews everything before it reaches you.' },
  { type: 'MESSAGING', label: 'Secure messaging', hint: 'Message your care team from this app.' },
  { type: 'RESEARCH', label: 'Research', hint: 'Use de-identified data for quality improvement.' },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const [consents, setConsents] = useState<Record<string, string>>({});
  const load = () => api().patients.myConsents().then((rows) => {
    const latest: Record<string, string> = {};
    for (const r of rows) if (!latest[r.type]) latest[r.type] = r.status;
    setConsents(latest);
  });
  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView style={s.screen}>
      <Card title="Account">
        <Text style={s.body}>{user?.firstName} {user?.lastName}</Text>
        <Text style={s.muted}>{user?.email}</Text>
      </Card>
      <Card title="Privacy & consent">
        {CONSENTS.map((c) => (
          <View key={c.type} style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, paddingRight: 12 }}><Text style={s.body}>{c.label}</Text><Text style={s.muted}>{c.hint}</Text></View>
            <Switch value={consents[c.type] === 'GRANTED'} onValueChange={(v) => api().patients.recordConsent({ type: c.type, status: v ? 'GRANTED' : 'REVOKED', version: '2026-09' }).then(load)} />
          </View>
        ))}
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => void logout()} />
    </ScrollView>
  );
}
