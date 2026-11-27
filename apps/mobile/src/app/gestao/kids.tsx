import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AddButton, List, Row, todayISO } from '@/components/admin';
import { Button, C, Card, Chips, Empty, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Tab = 'hoje' | 'criancas' | 'turmas' | 'aulas';
type Room = { id: string; name: string; color: string; min_age: number; max_age: number; active: boolean };
type Child = { id: string; full_name: string; birth_date: string | null; allergies: string | null };
type Check = { id: string; child_id: string; room_id: string | null; status: 'pre' | 'presente' | 'retirado' | 'cancelado'; security_code: string; kids_children: { full_name: string; allergies: string | null } | null };
type Lesson = { id: string; title: string; lesson_date: string; published: boolean; room_id: string | null };
const ST: Record<Check['status'], string> = { pre: 'pré-check-in (ainda não chegou)', presente: 'na sala', retirado: 'já foi embora', cancelado: 'cancelado' };
const age = (b: string | null) => { if (!b) return null; const d = new Date(b + 'T12:00:00'); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

/** Kids para a equipe: entrada e saída de hoje, crianças, turmas e aulas. */
export default function GestaoKids() {
  const { church, color } = useChurch();
  const [tab, setTab] = useState<Tab>('hoje');
  const { data, refresh } = useData(async () => {
    const [r, c, k, l] = await Promise.all([
      supabase.from('kids_rooms').select('id, name, color, min_age, max_age, active').eq('church_id', church.id).order('position').order('name'),
      supabase.from('kids_children').select('id, full_name, birth_date, allergies').eq('church_id', church.id).order('full_name'),
      supabase.from('kids_checkins').select('id, child_id, room_id, status, security_code, kids_children(full_name, allergies)').eq('church_id', church.id).eq('service_date', todayISO()).order('created_at'),
      supabase.from('kids_lessons').select('id, title, lesson_date, published, room_id').eq('church_id', church.id).order('lesson_date', { ascending: false }).limit(40),
    ]);
    return { rooms: (r.data ?? []) as Room[], children: (c.data ?? []) as Child[], checks: (k.data ?? []) as unknown as Check[], lessons: (l.data ?? []) as Lesson[] };
  }, { rooms: [] as Room[], children: [] as Child[], checks: [] as Check[], lessons: [] as Lesson[] }, `gkids:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const present = data.checks.filter((x) => x.status === 'presente').length;

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Kids' }} />
      <Chips color={color} value={tab} onChange={setTab} options={[
        { value: 'hoje', label: `Hoje ${present}` }, { value: 'criancas', label: `Crianças ${data.children.length}` },
        { value: 'turmas', label: 'Turmas' }, { value: 'aulas', label: 'Aulas' },
      ]} />
      {tab === 'hoje' && <Hoje rooms={data.rooms} kids={data.children} checks={data.checks} color={color} reload={refresh} />}
      {tab === 'criancas' && <Criancas kids={data.children} color={color} />}
      {tab === 'turmas' && <Turmas rooms={data.rooms} churchId={church.id} color={color} reload={refresh} />}
      {tab === 'aulas' && (
        <>
          <AddButton label="Nova aula" color={color} onPress={() => router.push({ pathname: '/gestao/aula/[id]', params: { id: 'novo' } })} />
          {data.lessons.length === 0 ? <Empty>Nenhuma aula cadastrada.</Empty> : (
            <List>
              {data.lessons.map((l, i) => (
                <Row key={l.id} first={i === 0} title={l.title}
                  sub={[l.lesson_date.split('-').reverse().join('/'), data.rooms.find((r) => r.id === l.room_id)?.name ?? 'Todas as turmas', !l.published && 'rascunho'].filter(Boolean).join(' · ')}
                  onPress={() => router.push({ pathname: '/gestao/aula/[id]', params: { id: l.id } })} />
              ))}
            </List>
          )}
        </>
      )}
    </Screen>
  );
}

function Hoje({ rooms, kids, checks, color, reload }: { rooms: Room[]; kids: Child[]; checks: Check[]; color: string; reload: () => void }) {
  const [q, setQ] = useState('');
  const [child, setChild] = useState<Child | null>(null);
  const [room, setRoom] = useState('');
  const [out, setOut] = useState<{ id: string; code: string; who: string } | null>(null);
  const active = rooms.filter((r) => r.active);
  const busyIds = new Set(checks.filter((c) => c.status === 'presente' || c.status === 'pre').map((c) => c.child_id));
  const matches = q.trim().length >= 2 ? kids.filter((c) => c.full_name.toLowerCase().includes(q.toLowerCase()) && !busyIds.has(c.id)).slice(0, 6) : [];
  const suggest = (c: Child) => { const a = age(c.birth_date); return active.find((r) => a != null && a >= r.min_age && a <= r.max_age)?.id ?? ''; };

  async function checkIn(childId: string, roomId: string) {
    const { data, error } = await supabase.rpc('kids_checkin', { p_child: childId, p_room: roomId || null });
    if (error) return Alert.alert('Não deu', error.message);
    Alert.alert('Entrada feita', `Código de retirada: ${(data as { security_code: string }).security_code}`);
    setChild(null); setQ(''); setRoom(''); reload();
  }
  async function checkOut() {
    if (!out) return;
    const { error } = await supabase.rpc('kids_checkout', { p_checkin: out.id, p_code: out.code.trim(), p_picked_up_by: out.who.trim() || null });
    if (error) return Alert.alert('Não deu', error.message.includes('código') ? 'O código não confere.' : error.message);
    setOut(null); reload();
  }
  function cancel(c: Check) {
    Alert.alert('Cancelar entrada?', c.kids_children?.full_name ?? '', [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar entrada', style: 'destructive', onPress: async () => {
      const { error } = await supabase.rpc('kids_cancel', { p_checkin: c.id });
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }

  return (
    <>
      <Card>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Fazer entrada</Text>
        {child ? (
          <>
            <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{child.full_name}{age(child.birth_date) != null ? ` · ${age(child.birth_date)} anos` : ''}</Text>
            {child.allergies ? <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.danger }}>Alergia: {child.allergies}</Text> : null}
            <Chips color={color} value={room || suggest(child)} onChange={setRoom} options={active.map((r) => ({ value: r.id, label: r.name }))} />
            <Button title="Confirmar entrada" color={color} onPress={() => checkIn(child.id, room || suggest(child))} />
            <Button title="Trocar criança" variant="outline" onPress={() => setChild(null)} />
          </>
        ) : (
          <>
            <Input label="Buscar criança" value={q} onChangeText={setQ} placeholder="Nome" />
            {matches.map((c) => (
              <Pressable key={c.id} onPress={() => setChild(c)} style={{ paddingVertical: 8 }} accessibilityRole="button">
                <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text }}>{c.full_name}</Text>
              </Pressable>
            ))}
            {q.trim().length >= 2 && matches.length === 0 && <Muted>Ninguém encontrado (ou já está na sala). Cadastre na aba Crianças.</Muted>}
          </>
        )}
      </Card>

      <Section title={`Hoje (${checks.length})`}>
        {checks.length === 0 ? <Empty>Nenhuma criança hoje ainda.</Empty> : checks.map((c) => (
          <Card key={c.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{c.kids_children?.full_name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{[rooms.find((r) => r.id === c.room_id)?.name, ST[c.status], `código ${c.security_code}`].filter(Boolean).join(' · ')}</Text>
                {c.kids_children?.allergies ? <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.danger }}>Alergia: {c.kids_children.allergies}</Text> : null}
              </View>
            </View>
            {c.status === 'pre' && <Button title="Chegou: confirmar entrada" color={color} onPress={() => checkIn(c.child_id, c.room_id ?? '')} />}
            {c.status === 'presente' && (out?.id === c.id ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={out.code} onChangeText={(v) => setOut({ ...out, code: v })} placeholder="Código" placeholderTextColor="#8a948e" autoCapitalize="characters"
                    style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.bold, fontSize: 16, color: C.text }} />
                  <TextInput value={out.who} onChangeText={(v) => setOut({ ...out, who: v })} placeholder="Quem buscou" placeholderTextColor="#8a948e"
                    style={{ flex: 2, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15, color: C.text }} />
                </View>
                <Button title="Confirmar retirada" color={color} disabled={!out.code.trim()} onPress={checkOut} />
              </>
            ) : <Button title="Retirar" variant="outline" color={color} onPress={() => setOut({ id: c.id, code: '', who: '' })} />)}
            {(c.status === 'pre' || c.status === 'presente') && (
              <Pressable onPress={() => cancel(c)} style={{ alignItems: 'center', padding: 4 }}><Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.danger }}>Cancelar</Text></Pressable>
            )}
          </Card>
        ))}
      </Section>
    </>
  );
}

function Criancas({ kids, color }: { kids: Child[]; color: string }) {
  const [q, setQ] = useState('');
  const list = kids.filter((c) => !q || c.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <AddButton label="Nova criança" color={color} onPress={() => router.push({ pathname: '/gestao/crianca/[id]', params: { id: 'novo' } })} />
      <Input label="Buscar" value={q} onChangeText={setQ} placeholder="Nome" />
      {list.length === 0 ? <Empty>Nenhuma criança.</Empty> : (
        <List>
          {list.map((c, i) => (
            <Row key={c.id} first={i === 0} title={c.full_name} sub={[age(c.birth_date) != null && `${age(c.birth_date)} anos`, c.allergies && `alergia: ${c.allergies}`].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/gestao/crianca/[id]', params: { id: c.id } })} />
          ))}
        </List>
      )}
    </>
  );
}

function Turmas({ rooms, churchId, color, reload }: { rooms: Room[]; churchId: string; color: string; reload: () => void }) {
  const [f, setF] = useState({ name: '', min: '0', max: '12' });
  async function add() {
    const { error } = await supabase.from('kids_rooms').insert({ church_id: churchId, name: f.name.trim(), min_age: Number(f.min) || 0, max_age: Number(f.max) || 12, position: 99 });
    if (error) return Alert.alert('Não deu', error.message);
    setF({ name: '', min: '0', max: '12' }); reload();
  }
  async function toggle(r: Room) {
    const { error } = await supabase.from('kids_rooms').update({ active: !r.active }).eq('id', r.id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }
  return (
    <>
      <Card>
        {rooms.length === 0 && <Muted>Nenhuma turma ainda.</Muted>}
        {rooms.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.color }} />
            <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: r.active ? C.text : C.muted }}>{r.name} · {r.min_age} a {r.max_age} anos{r.active ? '' : ' (desativada)'}</Text>
            <Pressable onPress={() => toggle(r)} hitSlop={8}><Text style={{ fontFamily: F.bold, fontSize: 13, color: r.active ? C.muted : color }}>{r.active ? 'Desativar' : 'Ativar'}</Text></Pressable>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>Nova turma</Text>
        <Input label="Nome" value={f.name} onChangeText={(v) => setF((o) => ({ ...o, name: v }))} placeholder="ex.: Maternal" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Input label="Idade de" value={f.min} onChangeText={(v) => setF((o) => ({ ...o, min: v }))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Input label="até" value={f.max} onChangeText={(v) => setF((o) => ({ ...o, max: v }))} keyboardType="number-pad" /></View>
        </View>
        <Button title="Criar turma" color={color} disabled={f.name.trim().length < 2} onPress={add} />
      </Card>
    </>
  );
}
