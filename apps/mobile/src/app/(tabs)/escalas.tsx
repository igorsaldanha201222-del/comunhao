import { Link } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, C, Card, Empty, H2, Muted, Screen, fmtDateTime } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Row = {
  id: string;
  status: 'pendente' | 'confirmado' | 'recusado';
  ministry_positions: { name: string } | null;
  schedules: { id: string; title: string; starts_at: string; ministries: { name: string; color: string } };
};

const LABEL = { pendente: 'Aguardando sua resposta', confirmado: '✓ Confirmado', recusado: '✕ Recusado' };
const TONE = { pendente: C.warn, confirmado: C.ok, recusado: C.danger };

export default function Escalas() {
  const { personId, color } = useChurch();
  type Data = { rows: Row[]; ministries: { name: string; is_leader: boolean }[] };
  const { data, reload: load, refresh, refreshing } = useData<Data>(async () => {
    if (!personId) return { rows: [], ministries: [] };
    const [a, m] = await Promise.all([
      supabase.from('schedule_assignments')
        .select('id, status, ministry_positions(name), schedules!inner(id, title, starts_at, ministries(name, color))')
        .eq('person_id', personId).gte('schedules.starts_at', new Date(Date.now() - 6 * 3600_000).toISOString()),
      supabase.from('ministry_members').select('is_leader, ministries(name)').eq('person_id', personId),
    ]);
    const list = (a.data ?? []) as unknown as Row[];
    list.sort((x, y) => x.schedules.starts_at.localeCompare(y.schedules.starts_at));
    return {
      rows: list,
      ministries: (m.data ?? []).map((x) => ({ name: (x.ministries as unknown as { name: string }).name, is_leader: x.is_leader })),
    };
  }, { rows: [], ministries: [] }, personId ?? "");
  const { rows, ministries } = data;

  async function respond(id: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_assignment', { p_assignment: id, p_accept: accept });
    if (error) return Alert.alert('Ops', error.message);
    load();
  }

  return (
    <Screen title="Minhas escalas" subtitle={ministries.map((m) => m.name + (m.is_leader ? ' (líder)' : '')).join(' · ') || 'Você ainda não faz parte de um ministério'}
      color={color} refreshing={refreshing} onRefresh={refresh}>
      {rows.length === 0 && <Empty>Nenhuma escala futura.</Empty>}
      {rows.map((r) => (
        <Card key={r.id} style={{ borderLeftWidth: 4, borderLeftColor: r.schedules.ministries.color }}>
          <Link href={{ pathname: '/escala/[id]', params: { id: r.schedules.id } }} asChild>
            <Pressable>
              <Muted>{r.schedules.ministries.name}{r.ministry_positions ? ` · ${r.ministry_positions.name}` : ''}</Muted>
              <H2>{r.schedules.title}</H2>
              <Text>{fmtDateTime(r.schedules.starts_at)}</Text>
              <Text style={{ color: TONE[r.status], fontWeight: '600', marginTop: 4 }}>{LABEL[r.status]}</Text>
            </Pressable>
          </Link>
          {r.status === 'pendente' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Confirmar" color={color} onPress={() => respond(r.id, true)} /></View>
              <View style={{ flex: 1 }}><Button title="Não posso" variant="outline" color={C.danger} onPress={() => respond(r.id, false)} /></View>
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
