import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { brToISO, DeleteButton, goBack, isoToBR, todayISO, Toggle } from '@/components/admin';
import { Button, C, Card, Chips, F, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type L = { id?: string; title: string; lesson_date: string; room_id: string | null; bible_verse: string | null; plan: string | null; home_activity: string | null; materials: string | null; published: boolean };

/** Aula do Kids (id = "novo"): roteiro para a equipe e atividade de casa para os pais. */
export default function Aula() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church } = useChurch();
  const { data } = useData(async () => {
    const { data: rooms } = await supabase.from('kids_rooms').select('id, name').eq('church_id', church.id).eq('active', true).order('position');
    if (id === 'novo') return { l: { title: '', lesson_date: todayISO(), room_id: null, bible_verse: null, plan: null, home_activity: null, materials: null, published: true } as L, rooms: rooms ?? [] };
    const { data: l } = await supabase.from('kids_lessons').select('id, title, lesson_date, room_id, bible_verse, plan, home_activity, materials, published').eq('id', id).maybeSingle();
    return { l: l as L | null, rooms: rooms ?? [] };
  }, null as { l: L | null; rooms: { id: string; name: string }[] } | null, `aula:${id}`);
  if (!data?.l) return <Screen><Muted>Carregando…</Muted></Screen>;
  return <Form initial={data.l} rooms={data.rooms} />;
}

function Form({ initial, rooms }: { initial: L; rooms: { id: string; name: string }[] }) {
  const { church, color } = useChurch();
  const editing = !!initial.id;
  const [f, setF] = useState({
    title: initial.title, date: isoToBR(initial.lesson_date), verse: initial.bible_verse ?? '', plan: initial.plan ?? '', home: initial.home_activity ?? '', materials: initial.materials ?? '',
  });
  const [room, setRoom] = useState(initial.room_id ?? '');
  const [published, setPublished] = useState(initial.published);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    if (f.title.trim().length < 3) return Alert.alert('Título', 'Dê um título para a aula.');
    const d = brToISO(f.date);
    if (!d) return Alert.alert('Data', 'Use dd/mm/aaaa.');
    setBusy(true);
    const row = {
      church_id: church.id, title: f.title.trim(), lesson_date: d, room_id: room || null, bible_verse: f.verse.trim() || null, plan: f.plan.trim() || null,
      home_activity: f.home.trim() || null, materials: f.materials.trim() || null, published, updated_at: new Date().toISOString(),
    };
    const { error } = editing ? await supabase.from('kids_lessons').update(row).eq('id', initial.id!) : await supabase.from('kids_lessons').insert(row);
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    if (editing) goBack('/gestao/kids'); else if (router.canGoBack()) router.back(); else router.replace('/gestao/kids');
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: editing ? 'Aula' : 'Nova aula' }} />
      <Card>
        <Input label="Título" value={f.title} onChangeText={set('title')} placeholder="ex.: Davi e Golias" />
        <Input label="Data" value={f.date} onChangeText={set('date')} placeholder="dd/mm/aaaa" />
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Turma</Text>
        <Chips color={color} value={room} onChange={setRoom} options={[{ value: '', label: 'Todas' }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]} />
        <Input label="Versículo" value={f.verse} onChangeText={set('verse')} />
        <Input label="Roteiro da aula (equipe)" value={f.plan} onChangeText={set('plan')} multiline />
        <Input label="Materiais" value={f.materials} onChangeText={set('materials')} multiline />
        <Input label="Atividade para fazer em casa (pais veem)" value={f.home} onChangeText={set('home')} multiline />
        <Toggle label="Publicar para os pais" value={published} onChange={setPublished} color={color} hint="Desligado, a aula fica como rascunho." />
      </Card>
      <Button title={editing ? 'Salvar' : 'Criar aula'} color={color} loading={busy} onPress={save} />
      {editing && <DeleteButton what="aula" fallback="/gestao/kids" onDelete={async () => supabase.from('kids_lessons').delete().eq('id', initial.id!)} />}
    </Screen>
  );
}
