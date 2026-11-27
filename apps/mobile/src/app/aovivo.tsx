import { Image } from 'expo-image';
import { Play, Radio } from 'lucide-react-native';
import { createElement, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { C, Card, Empty, F, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Sermon = { id: string; title: string; preacher: string | null; preached_at: string | null; video_url: string };
type Live = { live_on: boolean; live_url: string | null; live_title: string | null; youtube_channel: string | null };

const ytId = (url: string | null | undefined) => url?.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
function embedUrl(url: string | null | undefined, autoplay = true) {
  const id = ytId(url);
  if (id) return `https://www.youtube.com/embed/${id}?rel=0${autoplay ? '&autoplay=1' : ''}`;
  const ch = url?.match(/youtube\.com\/channel\/(UC[\w-]{20,})/)?.[1];
  return ch ? `https://www.youtube.com/embed/live_stream?channel=${ch}&autoplay=1` : null;
}

/** Player dentro do app (web: iframe do YouTube; celular: abre o YouTube). */
function Player({ url }: { url: string }) {
  const src = embedUrl(url);
  if (Platform.OS === 'web' && src) {
    return (
      <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        {createElement('iframe', { src, title: 'Vídeo', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true, style: { border: 0, width: '100%', height: '100%' } })}
      </View>
    );
  }
  const id = ytId(url);
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="button" style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      {id ? <Image source={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}><Play size={30} color="#fff" fill="#fff" /></View>
    </Pressable>
  );
}

export default function AoVivo() {
  const { church, color } = useChurch();
  const [playing, setPlaying] = useState<Sermon | null>(null);
  const { data, refresh, refreshing } = useData(async () => {
    const [c, s] = await Promise.all([
      supabase.from('churches').select('live_on, live_url, live_title, youtube_channel').eq('id', church.id).maybeSingle(),
      supabase.from('sermons').select('id, title, preacher, preached_at, video_url').eq('church_id', church.id).not('video_url', 'is', null)
        .order('preached_at', { ascending: false }).limit(20),
    ]);
    return { live: c.data as Live | null, sermons: (s.data ?? []) as Sermon[] };
  }, { live: null, sermons: [] }, `live:${church.id}`);
  const live = data.live;
  const day = (v: string | null) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '');

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      {live?.live_on && live.live_url && !playing ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#d92d20', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Radio size={14} color="#fff" />
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: '#fff' }}>AO VIVO AGORA</Text>
          </View>
          <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: C.text }}>{live.live_title ?? 'Culto ao vivo'}</Text>
          <Player url={live.live_url} />
        </View>
      ) : playing ? (
        <View style={{ gap: 10 }}>
          <Player url={playing.video_url} />
          <Text style={{ fontFamily: F.extrabold, fontSize: 20, color: C.text }}>{playing.title}</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }}>{[playing.preacher, day(playing.preached_at)].filter(Boolean).join(' · ')}</Text>
        </View>
      ) : (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
          <Radio size={28} color={C.muted} />
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Nenhuma transmissão agora</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center' }}>Quando o culto estiver ao vivo, ele aparece aqui. Enquanto isso, assista às pregações.</Text>
        </Card>
      )}

      <Section title="Pregações">
        {data.sermons.length === 0 && <Empty>Nenhuma pregação publicada ainda.</Empty>}
        {data.sermons.map((s) => {
          const id = ytId(s.video_url);
          const on = playing?.id === s.id;
          return (
            <Pressable key={s.id} onPress={() => setPlaying(s)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: on ? color : C.border, padding: 10, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 112, aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' }}>
                {id ? <Image source={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
                <Play size={20} color="#fff" fill="#fff" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }} numberOfLines={2}>{s.title}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{[s.preacher, day(s.preached_at)].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
          );
        })}
      </Section>
    </Screen>
  );
}
