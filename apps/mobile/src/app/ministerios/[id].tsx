import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Crown, Music, Pencil, Plus, Search, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { C, Card, F, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Member = { person_id: string; is_leader: boolean; people: { full_name: string; phone: string | null } | null };
type Data = { m: { name: string; color: string; description: string | null; kind: string } | null; members: Member[]; people: { id: string; full_name: string }[]; next: { id: string; title: string; starts_at: string }[]; positions: { id: string; name: string }[] };

export default function Ministerio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, color } = useChurch();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [newPos, setNewPos] = useState('');
  const { data, reload } = useData<Data>(async () => {
    const [m, mm, pp, sc, pos] = await Promise.all([
      supabase.from('ministries').select('name, color, description, kind').eq('id', id).maybeSingle(),
      supabase.from('ministry_members').select('person_id, is_leader, people(full_name, phone)').eq('ministry_id', id),
      supabase.from('people').select('id, full_name').eq('church_id', church.id).neq('status', 'inativo').order('full_name').limit(2000),
      supabase.from('schedules').select('id, title, starts_at').eq('ministry_id', id).gte('starts_at', new Date(Date.now() - 86400_000).toISOString()).order('starts_at').limit(12),
      supabase.from('ministry_positions').select('id, name').eq('ministry_id', id).order('position').order('name'),
    ]);
    const members = ((mm.data ?? []) as unknown as Member[]).sort((a, b) => Number(b.is_leader) - Number(a.is_leader) || (a.people?.full_name ?? '').localeCompare(b.people?.full_name ?? ''));
    return { m: m.data, members, people: pp.data ?? [], next: sc.data ?? [], positions: pos.data ?? [] };
  }, { m: null, members: [], people: [], next: [], positions: [] }, `min:${id}`);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!data.m) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;

  const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const candidates = data.people.filter((p) => !data.members.some((x) => x.person_id === p.id) && (!q || norm(p.full_name).includes(norm(q)))).slice(0, 12);

  async function add(personId: string) {
    const { error } = await supabase.from('ministry_members').insert({ ministry_id: id, person_id: personId, church_id: church.id });
    if (error) return Alert.alert('Não deu', error.message);
    setQ(''); reload();
  }
  async function leader(x: Member) {
    const { error } = await supabase.from('ministry_members').update({ is_leader: !x.is_leader }).eq('ministry_id', id).eq('person_id', x.person_id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }
  function remove(x: Member) {
    Alert.alert('Tirar do ministério?', `${x.people?.full_name} sai de ${data.m!.name}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('ministry_members').delete().eq('ministry_id', id).eq('person_id', x.person_id);
        if (error) Alert.alert('Não deu', error.message); else reload();
      } },
    ]);
  }
  async function addPos() {
    const { error } = await supabase.from('ministry_positions').insert({ ministry_id: id, church_id: church.id, name: newPos.trim(), position: data.positions.length });
    if (error) return Alert.alert('Não deu', error.code === '23505' ? 'Essa função já existe.' : error.message);
    setNewPos(''); reload();
  }
  function removePos(p: { id: string; name: string }) {
    Alert.alert('Apagar função?', p.name, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('ministry_positions').delete().eq('id', p.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }
  const when = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '');

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: data.m.name, headerRight: () => (
        <Pressable onPress={() => router.push({ pathname: '/gestao/ministerio/[id]', params: { id } })} hitSlop={10} accessibilityLabel="Editar ministério" style={{ paddingHorizontal: 8 }}>
          <Pencil size={20} color={C.text} />
        </Pressable>
      ) }} />
      <View style={{ backgroundColor: data.m.color, borderRadius: 24, padding: 20, gap: 4 }}>
        <Text style={{ fontFamily: F.extrabold, fontSize: 24, color: '#fff' }}>{data.m.name}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
          {data.members.length} {data.members.length === 1 ? 'pessoa' : 'pessoas'}{data.m.description ? ` · ${data.m.description}` : ''}
        </Text>
      </View>

      <Section title="Quem participa">
        <Card style={{ padding: 0, gap: 0 }}>
          {data.members.length === 0 && <Text style={{ padding: 16, fontFamily: F.regular, color: C.muted }}>Ninguém ainda.</Text>}
          {data.members.map((x, i) => (
            <View key={x.person_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/pessoas/[id]', params: { id: x.person_id } })} accessibilityRole="link">
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{x.people?.full_name}</Text>
                {x.people?.phone ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{x.people.phone}</Text> : null}
              </Pressable>
              <Pressable onPress={() => leader(x)} accessibilityRole="button" hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: x.is_leader ? C.accentTint : C.bg }}>
                <Crown size={13} color={x.is_leader ? C.accentText : C.muted} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: x.is_leader ? C.accentText : C.muted }}>{x.is_leader ? 'Líder' : 'Tornar líder'}</Text>
              </Pressable>
              <Pressable onPress={() => remove(x)} accessibilityRole="button" accessibilityLabel={`Tirar ${x.people?.full_name}`} hitSlop={8}>
                <X size={18} color={C.danger} />
              </Pressable>
            </View>
          ))}
          {adding ? (
            <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#eef1ed' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12 }}>
                <Search size={16} color={C.muted} />
                <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Buscar pessoa" placeholderTextColor="#8a948e"
                  style={{ flex: 1, height: 44, fontFamily: F.regular, fontSize: 15, color: C.text }} />
              </View>
              {candidates.map((p) => (
                <Pressable key={p.id} onPress={() => add(p.id)} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
                  <Plus size={16} color={color} />
                  <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text }}>{p.full_name}</Text>
                </Pressable>
              ))}
              {candidates.length === 0 && <Muted>Ninguém encontrado.</Muted>}
            </View>
          ) : (
            <Pressable onPress={() => setAdding(true)} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderTopWidth: 1, borderTopColor: '#eef1ed' }}>
              <Plus size={18} color={color} />
              <Text style={{ fontFamily: F.bold, fontSize: 15, color }}>Adicionar pessoa</Text>
            </Pressable>
          )}
        </Card>
      </Section>

      <Section title="Escalas">
        <Pressable onPress={() => router.push({ pathname: '/gestao/escala/[id]', params: { id: 'novo', m: id } })} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: color, opacity: pressed ? 0.85 : 1 })}>
          <Plus size={20} color="#fff" /><Text style={{ fontFamily: F.bold, fontSize: 15, color: '#fff' }}>Nova escala</Text>
        </Pressable>
        {data.next.length > 0 && (
          <Card style={{ padding: 0, gap: 0 }}>
            {data.next.map((s, i) => (
              <Pressable key={s.id} onPress={() => router.push({ pathname: '/gestao/escala/[id]', params: { id: s.id } })} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <CalendarDays size={18} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{s.title}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{when(s.starts_at)}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </Section>

      <Section title="Funções">
        <Card>
          {data.positions.length === 0 ? <Muted>Ex.: vocal, violão, bateria, som, recepção da porta.</Muted> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.positions.map((p) => (
                <Pressable key={p.id} onPress={() => removePos(p)} accessibilityRole="button" accessibilityLabel={`Apagar função ${p.name}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }}>{p.name}</Text>
                  <X size={14} color={C.muted} />
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={newPos} onChangeText={setNewPos} placeholder="Nova função" placeholderTextColor="#8a948e"
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15, color: C.text }} />
            <Pressable onPress={addPos} disabled={newPos.trim().length < 2} accessibilityRole="button"
              style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: newPos.trim().length < 2 ? 0.4 : 1 }}>
              <Text style={{ fontFamily: F.bold, color: '#fff' }}>Adicionar</Text>
            </Pressable>
          </View>
        </Card>
      </Section>

      {data.m.kind === 'louvor' && (
        <Pressable onPress={() => router.push({ pathname: '/gestao/repertorio/[id]', params: { id } })} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, opacity: pressed ? 0.85 : 1 })}>
          <Music size={20} color={color} />
          <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text }}>Repertório</Text>
        </Pressable>
      )}
    </Screen>
  );
}
