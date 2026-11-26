import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, Empty, H2, Muted, Screen, fmtDateTime } from '@/components/ui';
import { level, loadJourney, maxXp, stepsDone, xp } from '@/lib/journey';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Banner = { id: string; title: string; image_url: string; link_url: string | null };
type Sermon = { id: string; title: string; preacher: string | null; video_url: string | null; audio_url: string | null; preached_at: string };
type Notice = { id: string; title: string; body: string; sent_at: string };

const ytId = (u: string | null) => u?.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/)?.[1] ?? null;

export default function Inicio() {
  const { church, color, user } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const [b, s, n] = await Promise.all([
      supabase.from('banners').select('id, title, image_url, link_url').eq('church_id', church.id).order('position').limit(5),
      supabase.from('sermons').select('id, title, preacher, video_url, audio_url, preached_at').eq('church_id', church.id).order('preached_at', { ascending: false }).limit(10),
      supabase.from('notifications').select('id, title, body, sent_at').eq('church_id', church.id).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(3),
    ]);
    return { banners: (b.data ?? []) as Banner[], sermons: (s.data ?? []) as Sermon[], notices: (n.data ?? []) as Notice[] };
  }, { banners: [], sermons: [], notices: [] }, church.id);
  const { banners, sermons, notices } = data;
  const { data: trail } = useData(() => loadJourney(church.id, user.id),
    { journey: null, isMember: false, phone: '', lessons: [], attended: [] }, `trail:${church.id}:${user.id}`);
  const tj = trail.journey;
  const tPct = tj ? Math.round((xp(tj, trail.attended.length) / maxXp(trail.lessons.length)) * 100) : 0;

  return (
    <Screen title={church.name} subtitle="Bem-vindo!" color={color} refreshing={refreshing} onRefresh={refresh}>
      {banners.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {banners.map((b) => (
            <Pressable key={b.id} onPress={() => b.link_url && WebBrowser.openBrowserAsync(b.link_url)}>
              <Image source={b.image_url} style={{ width: 320, aspectRatio: 16 / 7, borderRadius: 14 }} contentFit="cover" accessibilityLabel={b.title} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!trail.isMember && !tj && (
        <Card style={{ borderColor: color, borderWidth: 2 }}>
          <H2>🙋 Quero ser membro</H2>
          <Muted>Conversa com o pastor, NCC e apresentação à igreja — faça a trilha e ganhe o troféu! 🏆</Muted>
          <Button title="Começar minha jornada" color={color} onPress={() => router.push('/membro')} />
        </Card>
      )}
      {tj && stepsDone(tj) < 4 && (
        <Card>
          <H2>⭐ Sua trilha: {level(tj)}</H2>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
            <View style={{ height: 10, backgroundColor: color, width: `${tPct}%` }} />
          </View>
          <Button title="Ver minha trilha" variant="outline" color={color} onPress={() => router.push('/membro')} />
        </Card>
      )}

      {notices.map((n) => (
        <Card key={n.id} style={{ borderLeftWidth: 4, borderLeftColor: color }}>
          <H2>{n.title}</H2>
          <Text>{n.body}</Text>
          <Muted>{fmtDateTime(n.sent_at)}</Muted>
        </Card>
      ))}

      <H2>Pregações</H2>
      {sermons.length === 0 && <Empty>Nenhuma pregação publicada ainda.</Empty>}
      {sermons.map((s) => {
        const yt = ytId(s.video_url);
        const url = s.video_url ?? s.audio_url;
        return (
          <Pressable key={s.id} onPress={() => url && WebBrowser.openBrowserAsync(url)}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {yt && <Image source={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} style={{ width: '100%', aspectRatio: 16 / 9 }} />}
              <View style={{ padding: 14, gap: 2 }}>
                <H2>{s.title}</H2>
                <Muted>{[s.preacher, new Date(s.preached_at + 'T12:00:00').toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')}</Muted>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
