import { Stack, useLocalSearchParams } from 'expo-router';
import { Music, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { AddButton, List, Row } from '@/components/admin';
import { Button, C, Card, Chips, Empty, F, Input, Screen } from '@/components/ui';
import { KEYS } from '@/lib/ministries';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Song = { id: string; title: string; artist: string | null; song_key: string | null; bpm: number | null; link_url: string | null };
const EMPTY = { title: '', artist: '', key: '', bpm: '', link: '', lyrics: '' };

/** Repertório do ministério (id = ministério). */
export default function Repertorio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, color } = useChurch();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('songs').select('id, title, artist, song_key, bpm, link_url').eq('church_id', church.id).eq('ministry_id', id).order('title');
    return (rows ?? []) as Song[];
  }, [] as Song[], `rep:${id}`);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('songs').insert({
      church_id: church.id, ministry_id: id, title: f.title.trim(), artist: f.artist.trim() || null, song_key: f.key || null,
      bpm: f.bpm ? Number(f.bpm) : null, link_url: f.link.trim() || null, lyrics: f.lyrics.trim() || null,
    });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    setF(EMPTY); setOpen(false); reload();
  }
  function remove(s: Song) {
    Alert.alert('Tirar do repertório?', s.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Tirar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('songs').delete().eq('id', s.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Repertório' }} />
      {open ? (
        <Card>
          <Input label="Música" value={f.title} onChangeText={set('title')} />
          <Input label="Artista / ministério" value={f.artist} onChangeText={set('artist')} />
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Tom</Text>
          <Chips color={color} value={f.key} onChange={set('key')} options={KEYS.map((k) => ({ value: k, label: k }))} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="BPM" value={f.bpm} onChangeText={set('bpm')} keyboardType="number-pad" /></View>
            <View style={{ flex: 3 }}><Input label="Link (YouTube/Spotify)" value={f.link} onChangeText={set('link')} autoCapitalize="none" /></View>
          </View>
          <Input label="Letra / cifra (opcional)" value={f.lyrics} onChangeText={set('lyrics')} multiline />
          <Button title="Adicionar ao repertório" color={color} loading={busy} disabled={f.title.trim().length < 2} onPress={save} />
          <Button title="Cancelar" variant="outline" onPress={() => setOpen(false)} />
        </Card>
      ) : <AddButton label="Nova música" color={color} onPress={() => setOpen(true)} />}
      {data.length === 0 ? <Empty>Nenhuma música cadastrada.</Empty> : (
        <List>
          {data.map((s, i) => (
            <Row key={s.id} first={i === 0} left={<Music size={18} color={color} />} title={s.title}
              sub={[s.artist, s.song_key && `tom ${s.song_key}`, s.bpm && `${s.bpm} bpm`].filter(Boolean).join(' · ')}
              onPress={s.link_url ? () => Linking.openURL(s.link_url!) : undefined}
              right={<Pressable onPress={() => remove(s)} hitSlop={8} accessibilityLabel={`Tirar ${s.title}`}><Trash2 size={18} color={C.danger} /></Pressable>} />
          ))}
        </List>
      )}
    </Screen>
  );
}
