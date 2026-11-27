import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Cores do app (identidade Gileade: verde das folhas + laranja dourado). */
export const C = {
  bg: '#f5f6f3',
  card: '#ffffff',
  text: '#14201a',
  body: '#4d5a53',
  muted: '#5b6660',
  border: '#e3e7e2',
  line: '#d7ddd6',
  tint: '#e6f3eb',
  accent: '#e48838',
  accentText: '#a8571a',
  accentTint: '#fbefe3',
  dark: '#0b3d24',
  danger: '#b91c1c',
  ok: '#047857',
  warn: '#b45309',
};

/** Fonte Plus Jakarta Sans por peso (carregada no layout raiz). */
export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export function Screen({
  title, subtitle, children, refreshing, onRefresh, color, header,
}: {
  title?: string; subtitle?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; color?: string;
  /** Cabeçalho próprio (ex.: capa do Início); substitui título/subtítulo. */
  header?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={header ? [] : ['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color} /> : undefined}>
        {header}
        <View style={{ padding: 20, paddingTop: header ? 0 : 20, gap: 14 }}>
          {!header && title ? (
            <View style={{ marginBottom: 6, gap: 2 }}>
              <Text style={s.title}>{title}</Text>
              {subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </View>
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

/** Título de seção com link opcional à direita ("Ver todos"). */
export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: 12, marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={s.section}>{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Atalho quadrado com ícone (grade do Início). */
export function Tile({ icon: Icon, label, onPress, color }: { icon: LucideIcon; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: '25%', alignItems: 'center', gap: 8, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={color} strokeWidth={1.8} />
      </View>
      <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.text }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title, onPress, color = C.text, variant = 'solid', loading, disabled,
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
        solid ? { backgroundColor: color } : { borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={solid ? '#fff' : color} /> : (
        <Text style={{ color: solid ? '#fff' : C.text, fontFamily: F.bold, fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#8a948e" style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }]} {...props} />
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
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[s.chip, on && { backgroundColor: color, borderColor: color }]}>
            <Text style={{ color: on ? '#fff' : C.text, fontFamily: F.semibold, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={[s.card, { alignItems: 'center', borderStyle: 'dashed', borderColor: C.line }]}>
      <Text style={s.muted}>{children}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: 28, fontFamily: F.extrabold, color: C.text, letterSpacing: -0.4 },
  section: { fontSize: 18, fontFamily: F.extrabold, color: C.text },
  h2: { fontSize: 17, fontFamily: F.bold, color: C.text },
  muted: { fontSize: 14, color: C.muted, fontFamily: F.regular, lineHeight: 20 },
  label: { fontSize: 13, fontFamily: F.semibold, color: C.body },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, gap: 10 },
  btn: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: C.text, fontFamily: F.regular },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
});

export const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtBRL = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
