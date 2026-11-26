import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { C, Card, H2, Muted, fmtDateTime, s } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type Schedule = { title: string; starts_at: string; notes: string | null; ministries: { name: string; kind: string } };
type Person = { id: string; status: string; full_name: string; position_name: string | null };
type Song = { song_key: string | null; songs: { title: string; artist: string | null; song_key: string | null; chord_url: string | null; link_url: string | null; audio_url: string | null } };

/** Detalhe da escala: quem serve junto e, no louvor, o setlist com tom, cifra e áudio. */
export default function Escala() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sc, setSc] = useState<Schedule | null>(null);
  const [team, setTeam] = useState<Person[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('schedules').select('title, starts_at, notes, ministries(name, kind)').eq('id', id).single(),
      supabase.rpc('schedule_team', { p_schedule: id }),
      supabase.from('schedule_songs').select('song_key, songs(title, artist, song_key, chord_url, link_url, audio_url)').eq('schedule_id', id).order('position'),
    ]).then(([a, b, c]) => {
      setSc(a.data as unknown as Schedule);
      setTeam((b.data ?? []) as unknown as Person[]);
      setSongs((c.data ?? []) as unknown as Song[]);
    });
  }, [id]);

  if (!sc) return null;
  const open = (u: string | null) => u && WebBrowser.openBrowserAsync(u);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Muted>{sc.ministries.name}</Muted>
      <Text style={s.title}>{sc.title}</Text>
      <Text>{fmtDateTime(sc.starts_at)}</Text>
      {sc.notes && <Muted>{sc.notes}</Muted>}

      <Card>
        <H2>Equipe</H2>
        {team.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text>{p.full_name}</Text>
            <Muted>{p.position_name ?? ''} {p.status === 'confirmado' ? '✓' : p.status === 'recusado' ? '✕' : '…'}</Muted>
          </View>
        ))}
      </Card>

      {songs.length > 0 && (
        <Card>
          <H2>Setlist</H2>
          {songs.map((x, i) => (
            <View key={i} style={{ paddingVertical: 6, gap: 2, borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
              <Text style={{ fontWeight: '600', fontSize: 16 }}>{i + 1}. {x.songs.title} <Text style={{ color: C.muted }}>· tom {x.song_key ?? x.songs.song_key ?? '—'}</Text></Text>
              {x.songs.artist && <Muted>{x.songs.artist}</Muted>}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
                {x.songs.chord_url && <Pressable onPress={() => open(x.songs.chord_url)}><Text style={{ textDecorationLine: 'underline' }}>Cifra</Text></Pressable>}
                {x.songs.audio_url && <Pressable onPress={() => open(x.songs.audio_url)}><Text style={{ textDecorationLine: 'underline' }}>Áudio</Text></Pressable>}
                {x.songs.link_url && <Pressable onPress={() => open(x.songs.link_url)}><Text style={{ textDecorationLine: 'underline' }}>Referência</Text></Pressable>}
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
