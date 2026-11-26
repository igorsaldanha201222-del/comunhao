import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#f6f6f7',
  card: '#ffffff',
  text: '#18181b',
  muted: '#6b7280',
  border: '#e4e4e7',
  danger: '#b91c1c',
  ok: '#047857',
  warn: '#b45309',
};

export function Screen({
  title, subtitle, children, refreshing, onRefresh, color,
}: {
  title: string; subtitle?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; color?: string;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color} /> : undefined}>
        <View style={{ marginBottom: 4 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={s.h2}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}

export function Button({
  title, onPress, color = '#18181b', variant = 'solid', loading, disabled,
}: {
  title: string; onPress: () => void; color?: string; variant?: 'solid' | 'outline'; loading?: boolean; disabled?: boolean;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        solid ? { backgroundColor: color } : { borderWidth: 1, borderColor: color },
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={solid ? '#fff' : color} /> : (
        <Text style={{ color: solid ? '#fff' : color, fontWeight: '600', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#a1a1aa" style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]} {...props} />
    </View>
  );
}

export function Chips<T extends string>({
  options, value, onChange, color,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; color: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)}
            style={[s.chip, on && { backgroundColor: color, borderColor: color }]}>
            <Text style={{ color: on ? '#fff' : C.text, fontWeight: '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={[s.card, { alignItems: 'center', borderStyle: 'dashed' }]}>
      <Text style={s.muted}>{children}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  h2: { fontSize: 17, fontWeight: '600', color: C.text },
  muted: { fontSize: 14, color: C.muted },
  label: { fontSize: 13, fontWeight: '500', color: C.muted },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, gap: 8 },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: C.text },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
});

export const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
