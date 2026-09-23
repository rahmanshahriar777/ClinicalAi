import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { theme } from '@/lib/theme';

export function Button({ title, onPress, variant = 'primary', loading, disabled }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean }) {
  const bg = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : theme.surface;
  const color = variant === 'secondary' ? theme.textPrimary : '#fff';
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [s.button, { backgroundColor: bg, borderWidth: variant === 'secondary' ? 1 : 0, opacity: pressed || disabled ? 0.7 : 1 }]}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[s.buttonText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput {...props} style={[s.input, props.multiline ? { minHeight: 100, textAlignVertical: 'top' } : null]} placeholderTextColor={theme.textSecondary} />
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' | string }) {
  const map: Record<string, { bg: string; fg: string }> = { LOW: { bg: theme.soft.success, fg: theme.success }, MEDIUM: { bg: theme.soft.primary, fg: theme.primary }, HIGH: { bg: theme.soft.warning, fg: theme.warning }, EMERGENCY: { bg: theme.soft.danger, fg: theme.danger }, ESCALATED: { bg: theme.soft.danger, fg: theme.danger } };
  const c = map[tone ?? label] ?? { bg: theme.background, fg: theme.textSecondary };
  return <Text style={[s.badge, { backgroundColor: c.bg, color: c.fg }]}>{label}</Text>;
}

export function Banner({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'danger' | 'info' }) {
  const c = tone === 'danger' ? theme.danger : tone === 'info' ? theme.primary : theme.warning;
  return (
    <View accessibilityRole="alert" style={[s.banner, { borderLeftColor: c, backgroundColor: tone === 'danger' ? theme.soft.danger : tone === 'info' ? theme.soft.primary : theme.soft.warning }]}>
      <Text style={{ color: theme.textPrimary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background, padding: theme.spacing.md },
  h1: { fontSize: 24, fontWeight: '600', color: theme.textPrimary, marginBottom: theme.spacing.md },
  muted: { color: theme.textSecondary, fontSize: 14 },
  body: { color: theme.textPrimary, fontSize: 16, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderColor: theme.line, marginTop: theme.spacing.sm },
  buttonText: { fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.line },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm, color: theme.textPrimary },
  label: { fontSize: 14, fontWeight: '500', color: theme.textPrimary, marginBottom: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius.md, paddingHorizontal: 12, fontSize: 16, backgroundColor: theme.surface, color: theme.textPrimary },
  badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.sm, overflow: 'hidden' },
  banner: { borderLeftWidth: 4, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginBottom: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.line },
});
