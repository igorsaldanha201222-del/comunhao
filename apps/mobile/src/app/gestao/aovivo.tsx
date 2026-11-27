import { Stack } from 'expo-router';
import { Radio } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, C, Card, F, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

/** Ligar/desligar a transmissão ao vivo (aparece no app e no site). */
export default function GestaoAoVivo() {
  const { church, color } = useChurch();
  const { data, reload } = useData(async () => {
    const { data: c } = await supabase.from('churches').select('live_on, live_url, live_title, youtube_channel').eq('id', church.id).maybeSingle();
    return c;
  }, null as { live_on: boolean; live_url: string | null; live_title: string | null; youtube_channel: string | null } | null, `glive:${church.id}`);
  const [edit, setEdit] = useState<{ url?: string; title?: string }>({});
  const url = edit.url ?? data?.live_url ?? '';
  const title = edit.title ?? data?.live_title ?? '';
  const setUrl = (v: string) => setEdit((o) => ({ ...o, url: v }));
  const setTitle = (v: string) => setEdit((o) => ({ ...o, title: v }));
  const [busy, setBusy] = useState(false);

  async function set(on: boolean) {
    if (on && !url.trim()) return Alert.alert('Link da live', 'Cole o link do YouTube da transmissão.');
    setBusy(true);
    const { error } = await supabase.rpc('set_live', { p_church: church.id, p_on: on, p_url: url.trim() || null, p_title: title });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    reload();
  }

  const on = !!data?.live_on;
  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Ao vivo' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? '#d92d20' : C.card, borderRadius: 20, borderWidth: on ? 0 : 1, borderColor: C.border, padding: 18 }}>
        <Radio size={26} color={on ? '#fff' : C.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.extrabold, fontSize: 18, color: on ? '#fff' : C.text }}>{on ? 'Estamos ao vivo' : 'Transmissão desligada'}</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: on ? 'rgba(255,255,255,0.85)' : C.muted }}>
            {on ? 'O app e o site mostram o player para todos.' : 'Ligue quando o culto começar.'}
          </Text>
        </View>
      </View>
      <Card>
        <Input label="Link do YouTube da live" value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://youtube.com/live/…" />
        <Input label="Título (opcional)" value={title} onChangeText={setTitle} placeholder="Culto de Celebração" />
        {on
          ? <><Button title="Atualizar link e título" variant="outline" color={color} loading={busy} onPress={() => set(true)} /><Button title="Encerrar transmissão" color={C.danger} loading={busy} onPress={() => set(false)} /></>
          : <Button title="Estamos ao vivo agora" color="#d92d20" loading={busy} onPress={() => set(true)} />}
      </Card>
      {data?.youtube_channel ? <Muted>Canal da igreja: {data.youtube_channel}</Muted> : null}
    </Screen>
  );
}
