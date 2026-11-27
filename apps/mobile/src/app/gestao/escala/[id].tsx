import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Music, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { brDateTimeToISO, DeleteButton, List, Row } from '@/components/admin';
import { Button, C, Card, Chips, F, Input, Muted, Screen, Section } from '@/components/ui';
import { KEYS } from '@/lib/ministries';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Assign = { id: string; status: string; people: { full_name: string } | null; ministry_positions: { name: string } | null };
type Data = {
  s: { title: string; starts_at: string; notes: string | null; ministry_id: string; ministries: { name: string; kind: string; color: string } } | null;
  team: Assign[];
  members: { person_id: string; people: { full_name: string } | null }[];
  positions: { id: string; name: string }[];
  songs: { song_id: string; song_key: string | null; songs: { title: string; artist: string | null } | null }[];
  repertoire: { id: string; title: string; song_key: string | null }[];
};
const STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'aguardando resposta', color: C.accentText }, confirmado: { label: 'confirmou', color: C.ok }, recusado: { label: 'não pode', color: C.danger },
};
const when = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Montar a escala: quem serve e em qual função; no louvor, as músicas e o tom. id = "novo" com ?m=<ministério>. */
export default function GestaoEscala() {
  const { id, m } = useLocalSearchParams<{ id: string; m?: string }>();
  const { church, color } = useChurch();
  if (id === 'novo') return <NovaEscala ministryId={m ?? ''} churchId={church.id} color={color} />;
  return <Equipe id={id} churchId={church.id} color={color} />;
}

function NovaEscala({ ministryId, churchId, color }: { ministryId: string; churchId: string; color: string }) {
  const [title, setTitle] = useState('Culto de domingo');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    const starts = brDateTimeToISO(date, time);
    if (!starts) return Alert.alert('Data', 'Preencha a data (dd/mm/aaaa) e a hora.');
    setBusy(true);
    const { data, error } = await supabase.from('schedules').insert({ ministry_id: ministryId, church_id: churchId, title: title.trim() || 'Culto', starts_at: starts, notes: notes.trim() || null }).select('id').single();
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    router.replace({ pathname: '/gestao/escala/[id]', params: { id: data.id } });
  }
  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Nova escala' }} />
      <Card>
        <Input label="Para qual culto/evento" value={title} onChangeText={setTitle} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 3 }}><Input label="Data" value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" /></View>
          <View style={{ flex: 2 }}><Input label="Hora" value={time} onChangeText={setTime} placeholder="18:00" /></View>
        </View>
        <Input label="Recado para a equipe (opcional)" value={notes} onChangeText={setNotes} multiline />
        <Button title="Criar e escalar pessoas" color={color} loading={busy} onPress={create} />
      </Card>
    </Screen>
  );
}

function Equipe({ id, churchId, color }: { id: string; churchId: string; color: string }) {
  const [person, setPerson] = useState('');
  const [position, setPosition] = useState('');
  const [song, setSong] = useState('');
  const [key, setKey] = useState('');
  const { data, reload } = useData<Data>(async () => {
    const { data: s } = await supabase.from('schedules').select('title, starts_at, notes, ministry_id, ministries(name, kind, color)').eq('id', id).maybeSingle();
    if (!s) return { s: null, team: [], members: [], positions: [], songs: [], repertoire: [] };
    const [t, mm, pos, ss, rep] = await Promise.all([
      supabase.from('schedule_assignments').select('id, status, people(full_name), ministry_positions(name)').eq('schedule_id', id),
      supabase.from('ministry_members').select('person_id, people(full_name)').eq('ministry_id', s.ministry_id),
      supabase.from('ministry_positions').select('id, name').eq('ministry_id', s.ministry_id).order('position').order('name'),
      supabase.from('schedule_songs').select('song_id, song_key, songs(title, artist)').eq('schedule_id', id).order('position'),
      supabase.from('songs').select('id, title, song_key').eq('church_id', churchId).or(`ministry_id.eq.${s.ministry_id},ministry_id.is.null`).order('title'),
    ]);
    return {
      s: s as unknown as Data['s'], team: (t.data ?? []) as unknown as Assign[], members: (mm.data ?? []) as unknown as Data['members'],
      positions: pos.data ?? [], songs: (ss.data ?? []) as unknown as Data['songs'], repertoire: rep.data ?? [],
    };
  }, { s: null, team: [], members: [], positions: [], songs: [], repertoire: [] }, `gesc:${id}`);
  const s = data.s;
  if (!s) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;
  const louvor = s.ministries.kind === 'louvor';

  async function assign() {
    if (!person) return;
    const { error } = await supabase.from('schedule_assignments').insert({ schedule_id: id, church_id: churchId, person_id: person, position_id: position || null });
    if (error) return Alert.alert('Não deu', error.code === '23505' ? 'Essa pessoa já está nessa função.' : error.message);
    setPerson(''); setPosition(''); reload();
  }
  async function unassign(a: Assign) {
    const { error } = await supabase.from('schedule_assignments').delete().eq('id', a.id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }
  async function addSong() {
    if (!song) return;
    const { error } = await supabase.from('schedule_songs').upsert({ schedule_id: id, song_id: song, church_id: churchId, song_key: key || null, position: data.songs.length });
    if (error) return Alert.alert('Não deu', error.message);
    setSong(''); setKey(''); reload();
  }
  async function removeSong(songId: string) {
    const { error } = await supabase.from('schedule_songs').delete().eq('schedule_id', id).eq('song_id', songId);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: s.ministries.name }} />
      <View style={{ backgroundColor: s.ministries.color, borderRadius: 22, padding: 18, gap: 4 }}>
        <Text style={{ fontFamily: F.extrabold, fontSize: 21, color: '#fff' }}>{s.title}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{when(s.starts_at)}</Text>
        {s.notes ? <Text style={{ fontFamily: F.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{s.notes}</Text> : null}
      </View>

      <Section title={`Equipe (${data.team.length})`}>
        {data.team.length > 0 && (
          <List>
            {data.team.map((a, i) => (
              <Row key={a.id} first={i === 0} title={a.people?.full_name ?? '—'}
                sub={[a.ministry_positions?.name, STATUS[a.status]?.label].filter(Boolean).join(' · ')}
                right={<Pressable onPress={() => unassign(a)} hitSlop={8} accessibilityLabel={`Tirar ${a.people?.full_name}`}><X size={18} color={C.danger} /></Pressable>} />
            ))}
          </List>
        )}
        <Card>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Escalar quem?</Text>
          {data.members.length === 0 ? <Muted>O ministério ainda não tem pessoas. Adicione na tela do ministério.</Muted> : (
            <Chips color={color} value={person} onChange={setPerson} options={data.members.map((x) => ({ value: x.person_id, label: x.people?.full_name.split(' ').slice(0, 2).join(' ') ?? '—' }))} />
          )}
          {data.positions.length > 0 && (
            <>
              <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Função</Text>
              <Chips color={color} value={position} onChange={setPosition} options={data.positions.map((p) => ({ value: p.id, label: p.name }))} />
            </>
          )}
          <Button title="Escalar" color={color} disabled={!person} onPress={assign} />
        </Card>
      </Section>

      {louvor && (
        <Section title="Músicas">
          {data.songs.length > 0 && (
            <List>
              {data.songs.map((x, i) => (
                <Row key={x.song_id} first={i === 0} left={<Music size={18} color={color} />} title={x.songs?.title ?? '—'}
                  sub={[x.songs?.artist, x.song_key && `tom ${x.song_key}`].filter(Boolean).join(' · ')}
                  right={<Pressable onPress={() => removeSong(x.song_id)} hitSlop={8} accessibilityLabel={`Tirar ${x.songs?.title}`}><X size={18} color={C.danger} /></Pressable>} />
              ))}
            </List>
          )}
          <Card>
            {data.repertoire.length === 0 ? <Muted>O repertório está vazio. Cadastre músicas no repertório do ministério.</Muted> : (
              <>
                <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Música</Text>
                <Chips color={color} value={song} onChange={(v) => { setSong(v); setKey(data.repertoire.find((r) => r.id === v)?.song_key ?? ''); }}
                  options={data.repertoire.filter((r) => !data.songs.some((x) => x.song_id === r.id)).map((r) => ({ value: r.id, label: r.title }))} />
                {song ? (
                  <>
                    <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Tom</Text>
                    <Chips color={color} value={key} onChange={setKey} options={KEYS.map((k) => ({ value: k, label: k }))} />
                  </>
                ) : null}
                <Button title="Adicionar música" color={color} disabled={!song} onPress={addSong} />
              </>
            )}
            <Pressable onPress={() => router.push({ pathname: '/gestao/repertorio/[id]', params: { id: s.ministry_id } })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 }}>
              <Plus size={16} color={color} /><Text style={{ fontFamily: F.bold, fontSize: 14, color }}>Repertório</Text>
            </Pressable>
          </Card>
        </Section>
      )}

      <DeleteButton what="escala" fallback="/ministerios" onDelete={async () => supabase.from('schedules').delete().eq('id', id)} />
    </Screen>
  );
}
