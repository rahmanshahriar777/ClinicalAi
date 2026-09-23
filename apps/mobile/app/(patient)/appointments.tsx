import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Button, Card, Input, s } from '@/components/ui';
import { api } from '@/lib/api';

export default function Appointments() {
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [intakeFor, setIntakeFor] = useState<string | null>(null);
  const [answers, setAnswers] = useState({ chiefComplaint: '', symptomDuration: '', medications: '', allergies: '' });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems((await api().appointments.list({ pageSize: 50 })).items);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submitIntake = async () => {
    if (!intakeFor) return;
    try {
      await api().appointments.submitIntake(intakeFor, { answers: { chiefComplaint: answers.chiefComplaint, symptomDuration: answers.symptomDuration || undefined, medications: answers.medications.split(',').map((x) => x.trim()).filter(Boolean), allergies: answers.allergies.split(',').map((x) => x.trim()).filter(Boolean) } });
      setIntakeFor(null);
      await load();
    } catch (e) {
      Alert.alert('Could not submit', (e as Error).message);
    }
  };

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
      {intakeFor ? (
        <Card title="Pre-visit intake">
          <Text style={[s.muted, { marginBottom: 8 }]}>If you have chest pain, trouble breathing or thoughts of harming yourself, call your local emergency number now.</Text>
          <Input label="What brings you in?" multiline value={answers.chiefComplaint} onChangeText={(v) => setAnswers({ ...answers, chiefComplaint: v })} />
          <Input label="How long?" value={answers.symptomDuration} onChangeText={(v) => setAnswers({ ...answers, symptomDuration: v })} />
          <Input label="Medications (comma separated)" value={answers.medications} onChangeText={(v) => setAnswers({ ...answers, medications: v })} />
          <Input label="Allergies (comma separated)" value={answers.allergies} onChangeText={(v) => setAnswers({ ...answers, allergies: v })} />
          <Button title="Submit" onPress={() => void submitIntake()} />
          <Button title="Cancel" variant="secondary" onPress={() => setIntakeFor(null)} />
        </Card>
      ) : null}
      {items.map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.body}>{new Date(a.scheduledAt).toLocaleString()}</Text>
            <Badge label={String(a.status).replace('_', ' ')} tone={a.status === 'CANCELLED' ? 'EMERGENCY' : 'LOW'} />
          </View>
          <Text style={s.muted}>{a.reason ?? 'General'} · {a.clinician ? `Dr ${a.clinician.user.lastName}` : 'Clinician to be confirmed'}</Text>
          {a.status === 'SCHEDULED' && a.intakeForm?.status === 'PENDING' ? <Button title="Complete intake form" onPress={() => setIntakeFor(a.id)} /> : null}
          {a.status === 'SCHEDULED' ? <Button title="Cancel appointment" variant="secondary" onPress={() => Alert.alert('Cancel appointment?', undefined, [{ text: 'Keep' }, { text: 'Cancel it', style: 'destructive', onPress: () => api().appointments.cancel(a.id).then(load) }])} /> : null}
        </Card>
      ))}
      {!items.length ? <Text style={s.muted}>No appointments.</Text> : null}
    </ScrollView>
  );
}
