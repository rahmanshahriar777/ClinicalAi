import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Banner, Card, s } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Array<Record<string, any>>>([]);
  const [notes, setNotes] = useState<Array<Record<string, any>>>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, n] = await Promise.all([api().appointments.list({ status: 'SCHEDULED', pageSize: 3 }), api().notifications.list({ unreadOnly: true, pageSize: 5 })]);
      setAppts(a.items);
      setNotes(n.items);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
      <Text style={s.h1}>Hello, {user?.firstName}</Text>
      <Banner tone="info" text="Messages are reviewed by your care team. This app is not for emergencies." />
      <Card title="Upcoming appointments">
        {appts.length ? appts.map((a) => (
          <View key={a.id} style={s.row}>
            <View><Text style={s.body}>{new Date(a.scheduledAt).toLocaleString()}</Text><Text style={s.muted}>{a.clinician ? `Dr ${a.clinician.user.lastName}` : 'Clinician to be confirmed'}</Text></View>
            <Badge label={`intake ${String(a.intakeForm?.status ?? '').toLowerCase()}`} tone={a.intakeForm?.status === 'PENDING' ? 'HIGH' : 'LOW'} />
          </View>
        )) : <Text style={s.muted}>No upcoming appointments.</Text>}
      </Card>
      <Card title="Notifications">
        {notes.length ? notes.map((n) => <View key={n.id} style={s.row}><View style={{ flex: 1 }}><Text style={s.body}>{n.title}</Text><Text style={s.muted}>{n.body}</Text></View></View>) : <Text style={s.muted}>You are all caught up.</Text>}
      </Card>
    </ScrollView>
  );
}
