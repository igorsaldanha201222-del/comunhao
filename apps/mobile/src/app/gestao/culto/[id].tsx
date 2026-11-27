import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ClipboardCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { DeleteButton, isoToBR } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

/** Um culto: números, contagem do público e acesso à chamada. */
export default function GestaoCulto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useChurch();
  const [head, setHead] = useState<string | null>(null);
  const { data, reload } = useData(async () => {
    const [s, a] = await Promise.all([
      supabase.from('services').select('title, service_date, headcount').eq('id', id).maybeSingle(),
      supabase.from('service_attendance').select('source, people(status)').eq('service_id', id),
    ]);
    const rows = (a.data ?? []) as unknown as { source: string; people: { status: string } | null }[];
    return { s: s.data, total: rows.length, visitors: rows.filter((r) => r.people?.status === 'visitante').length, app: rows.filter((r) => r.source === 'gps' || r.source === 'qr').length };
  }, { s: null as { title: string; service_date: string; headcount: number | null } | null, total: 0, visitors: 0, app: 0 }, `gcul:${id}`);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!data.s) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;
  const headValue = head ?? (data.s.headcount != null ? String(data.s.headcount) : '');

  async function saveHead() {
    const v = headValue.trim();
    const { error } = await supabase.from('services').update({ headcount: v === '' ? null : Math.max(0, Number(v) || 0) }).eq('id', id);
    if (error) return Alert.alert('Não deu', error.message);
    setHead(null); reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: `${data.s.title} · ${isoToBR(data.s.service_date)}` }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Na lista" value={data.total} />
        <Stat label="Visitantes" value={data.visitors} />
        <Stat label="Pelo celular" value={data.app} />
      </View>
      <Pressable onPress={() => router.push({ pathname: '/chamada', params: { s: id } })} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14, backgroundColor: color, opacity: pressed ? 0.85 : 1 })}>
        <ClipboardCheck size={20} color="#fff" />
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: '#fff' }}>Abrir a chamada deste culto</Text>
      </Pressable>
      <Card>
        <Input label="Contagem do público (todas as pessoas no culto)" value={headValue} onChangeText={setHead} keyboardType="number-pad" placeholder="ex.: 180" />
        <Button title="Salvar contagem" variant="outline" color={color} onPress={saveHead} />
      </Card>
      <DeleteButton what="culto" fallback="/gestao/cultos" onDelete={async () => supabase.from('services').delete().eq('id', id)} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12, gap: 2 }}>
      <Text style={{ fontFamily: F.extrabold, fontSize: 24, color: C.text }}>{value}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{label}</Text>
    </View>
  );
}
