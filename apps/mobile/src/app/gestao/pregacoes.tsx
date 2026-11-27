import { Stack } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AddButton, brToISO, isoToBR, List, Row, todayISO } from '@/components/admin';
import { Button, C, Card, Empty, Input, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Sermon = { id: string; title: string; preacher: string | null; series: string | null; preached_at: string; video_url: string | null; audio_url: string | null };

export default function GestaoPregacoes() {
  const { church, color } = useChurch();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', preacher: '', series: '', date: isoToBR(todayISO()), video: '', audio: '', description: '' });
  const [busy, setBusy] = useState(false);
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('sermons').select('id, title, preacher, series, preached_at, video_url, audio_url').eq('church_id', church.id).order('preached_at', { ascending: false }).limit(60);
    return (rows ?? []) as Sermon[];
  }, [] as Sermon[], `gserm:${church.id}`);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    const d = brToISO(f.date);
    if (!d) return Alert.alert('Data', 'Use dia/mês/ano.');
    if (!f.video.trim() && !f.audio.trim()) return Alert.alert('Link', 'Cole o link do vídeo (YouTube) ou do áudio.');
    setBusy(true);
    const { error } = await supabase.from('sermons').insert({
      church_id: church.id, title: f.title.trim(), preacher: f.preacher.trim() || null, series: f.series.trim() || null, preached_at: d,
      video_url: f.video.trim() || null, audio_url: f.audio.trim() || null, description: f.description.trim() || null,
    });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    setF({ title: '', preacher: '', series: '', date: isoToBR(todayISO()), video: '', audio: '', description: '' }); setOpen(false); reload();
  }
  function remove(s: Sermon) {
    Alert.alert('Apagar pregação?', s.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('sermons').delete().eq('id', s.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Pregações' }} />
      {open ? (
        <Card>
          <Input label="Título" value={f.title} onChangeText={set('title')} />
          <Input label="Pregador" value={f.preacher} onChangeText={set('preacher')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Data" value={f.date} onChangeText={set('date')} placeholder="dd/mm/aaaa" /></View>
            <View style={{ flex: 1 }}><Input label="Série (opcional)" value={f.series} onChangeText={set('series')} /></View>
          </View>
          <Input label="Link do vídeo (YouTube)" value={f.video} onChangeText={set('video')} autoCapitalize="none" />
          <Input label="Link do áudio (opcional)" value={f.audio} onChangeText={set('audio')} autoCapitalize="none" />
          <Input label="Resumo (opcional)" value={f.description} onChangeText={set('description')} multiline />
          <Button title="Publicar pregação" color={color} loading={busy} disabled={f.title.trim().length < 3} onPress={save} />
          <Button title="Cancelar" variant="outline" onPress={() => setOpen(false)} />
        </Card>
      ) : <AddButton label="Nova pregação" color={color} onPress={() => setOpen(true)} />}
      {data.length === 0 ? <Empty>Nenhuma pregação ainda.</Empty> : (
        <List>
          {data.map((s, i) => (
            <Row key={s.id} first={i === 0} title={s.title} sub={[s.preacher, isoToBR(s.preached_at), s.series, s.video_url ? 'vídeo' : 'áudio'].filter(Boolean).join(' · ')}
              right={<Pressable onPress={() => remove(s)} hitSlop={8} accessibilityLabel={`Apagar ${s.title}`}><Trash2 size={18} color={C.danger} /></Pressable>} />
          ))}
        </List>
      )}
    </Screen>
  );
}
