import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Banner, Button, Card, Input, s } from '@/components/ui';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';

export default function Messages() {
  const [threads, setThreads] = useState<Array<Record<string, any>>>([]);
  const [open, setOpen] = useState<Record<string, any> | null>(null);
  const [body, setBody] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setThreads((await api().threads.list({ pageSize: 50 })).items);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const openThread = async (id: string) => {
    setOpen(await api().threads.get(id));
    await api().threads.markRead(id);
  };
  const send = async () => {
    try {
      if (open) {
        await api().threads.send(open.id, { body });
        await openThread(open.id);
      } else {
        const t = await api().threads.create({ body });
        setOpen(t);
      }
      setBody('');
      await load();
    } catch (e) {
      Alert.alert('Could not send', (e as Error).message);
    }
  };

  if (open) {
    return (
      <ScrollView style={s.screen}>
        <Button title="← All conversations" variant="secondary" onPress={() => setOpen(null)} />
        <Text style={[s.h1, { marginTop: 12 }]}>{open.subject ?? 'Conversation'}</Text>
        {open.messages.map((m: Record<string, any>) => (
          <View key={m.id} style={{ alignSelf: m.senderType === 'PATIENT' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: m.senderType === 'PATIENT' ? theme.soft.primary : m.senderType === 'SYSTEM' ? theme.soft.danger : theme.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 8 }}>
            <Text style={[s.muted, { fontSize: 12 }]}>{m.senderType === 'PATIENT' ? 'You' : m.senderType === 'SYSTEM' ? 'Important' : 'Care team'} · {new Date(m.createdAt).toLocaleString()}</Text>
            <Text style={s.body}>{m.body}</Text>
          </View>
        ))}
        {open.status !== 'CLOSED' ? (<><Input label="Reply" multiline value={body} onChangeText={setBody} /><Button title="Send" onPress={() => void send()} disabled={!body.trim()} /></>) : <Text style={s.muted}>This conversation is closed.</Text>}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
      <Banner text="Messaging is not monitored around the clock. For urgent symptoms call your clinic or emergency services." />
      <Card title="New message">
        <Input label="Message" multiline value={body} onChangeText={setBody} placeholder="How can your care team help?" />
        <Button title="Send" onPress={() => void send()} disabled={!body.trim()} />
      </Card>
      {threads.map((t) => (
        <Card key={t.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={s.body}>{t.subject ?? 'Conversation'}</Text><Badge label={String(t.status).replace('_', ' ').toLowerCase()} tone={t.status} /></View>
          <Text style={s.muted} numberOfLines={1}>{t.messages?.[0]?.body}</Text>
          <Button title="Open" variant="secondary" onPress={() => void openThread(t.id)} />
        </Card>
      ))}
    </ScrollView>
  );
}
