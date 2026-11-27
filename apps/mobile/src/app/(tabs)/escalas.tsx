import { router } from 'expo-router';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { Alert, Pressable, Text, View } from 'react-native';

import { C, Empty, F, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Row = {
  id: string;
  status: 'pendente' | 'confirmado' | 'recusado';
  ministry_positions: { name: string } | null;
  schedules: { id: string; title: string; starts_at: string; ministries: { name: string; color: string } };
};

const TZ = 'America/Sao_Paulo';
const when = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
const STATUS = {
  pendente: { label: 'Aguardando sua resposta', color: C.accentText, bg: C.accentTint },
  confirmado: { label: 'Confirmado', color: C.ok, bg: C.tint },
  recusado: { label: 'Você não pode', color: C.danger, bg: '#f6ecec' },
};

export default function Escalas() {
  const { personId, color } = useChurch();
  type Data = { rows: Row[]; ministries: { name: string; is_leader: boolean; color: string }[] };
  const { data, reload: load, refresh, refreshing } = useData<Data>(async () => {
    if (!personId) return { rows: [], ministries: [] };
    const [a, m] = await Promise.all([
      supabase.from('schedule_assignments')
        .select('id, status, ministry_positions(name), schedules!inner(id, title, starts_at, ministries(name, color))')
        .eq('person_id', personId).gte('schedules.starts_at', new Date(Date.now() - 6 * 3600_000).toISOString()),
      supabase.from('ministry_members').select('is_leader, ministries(name, color)').eq('person_id', personId),
    ]);
    const list = (a.data ?? []) as unknown as Row[];
    list.sort((x, y) => x.schedules.starts_at.localeCompare(y.schedules.starts_at));
    return {
      rows: list,
      ministries: (m.data ?? []).map((x) => {
        const mi = x.ministries as unknown as { name: string; color: string };
        return { name: mi.name, color: mi.color, is_leader: x.is_leader };
      }),
    };
  }, { rows: [], ministries: [] }, personId ?? '');
  const { rows, ministries } = data;
  const pending = rows.filter((r) => r.status === 'pendente').length;

  async function respond(id: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_assignment', { p_assignment: id, p_accept: accept });
    if (error) return Alert.alert('Ops', error.message);
    load();
  }

  return (
    <Screen title="Minhas escalas" subtitle={pending ? `${pending} esperando sua resposta` : 'Onde você serve'} color={color} refreshing={refreshing} onRefresh={refresh}>
      {ministries.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ministries.map((m) => (
            <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
              <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}>{m.name}{m.is_leader ? ' · líder' : ''}</Text>
            </View>
          ))}
        </View>
      )}
      {ministries.length === 0 && <Empty>Você ainda não faz parte de um ministério. Fale com a liderança para servir!</Empty>}
      {ministries.length > 0 && rows.length === 0 && <Empty>Nenhuma escala futura.</Empty>}

      {rows.map((r) => {
        const st = STATUS[r.status];
        return (
          <View key={r.id} style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
            <Pressable onPress={() => router.push({ pathname: '/escala/[id]', params: { id: r.schedules.id } })} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: r.schedules.ministries.color }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>
                  {r.schedules.ministries.name}{r.ministry_positions ? ` · ${r.ministry_positions.name}` : ''}
                </Text>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{r.schedules.title}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.body }}>{when(r.schedules.starts_at)}</Text>
                <Text style={{ alignSelf: 'flex-start', marginTop: 4, fontFamily: F.bold, fontSize: 11, color: st.color, backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }}>{st.label}</Text>
              </View>
              <ChevronRight size={18} color="#9aa39d" />
            </Pressable>
            {r.status === 'pendente' && (
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eef1ed' }}>
                <Pressable onPress={() => respond(r.id, true)} accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, height: 50, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.tint : 'transparent' })}>
                  <Check size={18} color={color} strokeWidth={2.4} />
                  <Text style={{ fontFamily: F.bold, fontSize: 15, color }}>Confirmar</Text>
                </Pressable>
                <View style={{ width: 1, backgroundColor: '#eef1ed' }} />
                <Pressable onPress={() => respond(r.id, false)} accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, height: 50, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#f6ecec' : 'transparent' })}>
                  <X size={18} color={C.danger} strokeWidth={2.4} />
                  <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.danger }}>Não posso</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
