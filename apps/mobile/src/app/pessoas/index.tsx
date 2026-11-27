import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Plus, Search, Smartphone } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { C, Chips, Empty, F, Screen } from '@/components/ui';
import { STATUS, type PersonStatus } from '@/lib/people';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type P = { id: string; full_name: string; phone: string | null; status: PersonStatus; user_id: string | null; ministries: { name: string; color: string }[] };
type Filter = 'todos' | PersonStatus;

/** Cadastro de pessoas da igreja (membros, visitantes, novos convertidos) para a equipe. */
export default function Pessoas() {
  const { church, color } = useChurch();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const { data, refresh, refreshing } = useData(async () => {
    const { data: rows } = await supabase.from('people')
      .select('id, full_name, phone, status, user_id, ministry_members(ministries(name, color))')
      .eq('church_id', church.id).order('full_name').limit(2000);
    return (rows ?? []).map((r) => ({
      ...r,
      ministries: (r.ministry_members as unknown as { ministries: { name: string; color: string } | null }[]).map((m) => m.ministries).filter(Boolean),
    })) as unknown as P[];
  }, [] as P[], `people:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const count = (s: Filter) => (s === 'todos' ? data.length : data.filter((p) => p.status === s).length);
  const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const list = data.filter((p) => (filter === 'todos' || p.status === filter) && (!q || norm(p.full_name).includes(norm(q)) || (p.phone ?? '').includes(q)));

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
          <Search size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar nome ou telefone" placeholderTextColor="#8a948e"
            style={{ flex: 1, height: 48, fontFamily: F.regular, fontSize: 15, color: C.text }} />
        </View>
        <Pressable onPress={() => router.push('/pessoas/nova')} accessibilityRole="button" accessibilityLabel="Cadastrar pessoa"
          style={({ pressed }) => ({ width: 50, height: 50, borderRadius: 14, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Plus size={24} color="#fff" />
        </Pressable>
      </View>
      <Chips color={color} value={filter} onChange={setFilter} options={[
        { value: 'todos', label: `Todos ${count('todos')}` },
        { value: 'membro', label: `Membros ${count('membro')}` },
        { value: 'visitante', label: `Visitantes ${count('visitante')}` },
        { value: 'novo_convertido', label: `Novos convertidos ${count('novo_convertido')}` },
        { value: 'inativo', label: `Inativos ${count('inativo')}` },
      ]} />

      {list.length === 0 ? <Empty>Ninguém encontrado.</Empty> : (
        <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          {list.slice(0, 300).map((p, i) => {
            const st = STATUS[p.status];
            return (
              <Pressable key={p.id} onPress={() => router.push({ pathname: '/pessoas/[id]', params: { id: p.id } })} accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed', backgroundColor: pressed ? C.bg : C.card })}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 16, color: st.color }}>{p.full_name.trim()[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text, flexShrink: 1 }} numberOfLines={1}>{p.full_name}</Text>
                    {p.user_id ? <Smartphone size={13} color={C.muted} accessibilityLabel="usa o app" /> : null}
                  </View>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }} numberOfLines={1}>
                    {[st.label, p.ministries.map((m) => m.name).join(', ')].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <ChevronRight size={18} color="#9aa39d" />
              </Pressable>
            );
          })}
        </View>
      )}
      {list.length > 300 && <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center' }}>Mostrando 300 de {list.length}. Use a busca.</Text>}
    </Screen>
  );
}
