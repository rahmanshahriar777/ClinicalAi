import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { Banner, Button, Card, Input, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) await verifyMfa(mfaToken, code);
      else {
        const r = await login(email.trim(), password);
        if (r.mfaRequired && r.mfaToken) setMfaToken(r.mfaToken);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.screen, { justifyContent: 'center' }]}>
        <Text style={[s.h1, { textAlign: 'center' }]}>Clinical AI</Text>
        <Card title={mfaToken ? 'Enter your code' : 'Sign in'}>
          {error ? <Banner tone="danger" text={error} /> : null}
          {mfaToken ? (
            <Input label="6-digit code" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
          ) : (
            <>
              <Input label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
              <Input label="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
            </>
          )}
          <Button title={mfaToken ? 'Verify' : 'Sign in'} onPress={() => void submit()} loading={busy} />
        </Card>
        <Text style={[s.muted, { textAlign: 'center' }]}>In an emergency, call your local emergency number.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
