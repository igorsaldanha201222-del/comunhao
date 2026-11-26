import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, C, Card, Empty, H2, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Checkin = { id: string; status: 'pre' | 'presente' | 'retirado' | 'cancelado'; security_code: string; room_id: string | null; service_date: string; checked_in_at: string | null; checked_out_at: string | null };
type Kid = { id: string; full_name: string; birth_date: string | null; allergies: string | null; today?: Checkin };
type Lesson = { id: string; lesson_date: string; title: string; bible_verse: string | null; home_activity: string | null; room_id: string | null; attachments: { name: string; url: string }[] };
type Data = { kids: Kid[]; rooms: Record<string, { name: string; color: string }>; lessons: Lesson[] };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const hhmm = (v: string | null) => (v ? new Date(v).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '');
const age = (b: string | null) => {
  if (!b) return '';
  const d = new Date(b + 'T12:00:00'); const n = new Date();
  let y = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) y--;
  return y < 2 ? 'bebê' : `${y} anos`;
};
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function Kids() {
  const { church, user, color } = useChurch();
  const [busy, setBusy] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  const { data, reload, refresh, refreshing } = useData<Data>(async () => {
    const { data: g } = await supabase.from('kids_guardians').select('child_id').eq('user_id', user.id).eq('church_id', church.id);
    const ids = (g ?? []).map((x) => x.child_id);
    const [{ data: kids }, { data: checks }, { data: rooms }, { data: lessons }] = await Promise.all([
      ids.length ? supabase.from('kids_children').select('id, full_name, birth_date, allergies').in('id', ids).order('full_name') : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('kids_checkins').select('id, child_id, status, security_code, room_id, service_date, checked_in_at, checked_out_at')
        .in('child_id', ids).eq('service_date', today()).neq('status', 'cancelado') : Promise.resolve({ data: [] }),
      supabase.from('kids_rooms').select('id, name, color').eq('church_id', church.id),
      supabase.from('kids_lessons').select('id, lesson_date, title, bible_verse, home_activity, room_id, attachments')
        .eq('church_id', church.id).order('lesson_date', { ascending: false }).limit(10),
    ]);
    const byChild = new Map(((checks ?? []) as (Checkin & { child_id: string })[]).map((c) => [c.child_id, c]));
    return {
      kids: ((kids ?? []) as Kid[]).map((k) => ({ ...k, today: byChild.get(k.id) })),
      rooms: Object.fromEntries((rooms ?? []).map((r) => [r.id, { name: r.name, color: r.color }])),
      lessons: (lessons ?? []) as Lesson[],
    };
  }, { kids: [], rooms: {}, lessons: [] }, `${church.id}:${user.id}`);

  async function precheckin(k: Kid) {
    setBusy(k.id);
    const { error } = await supabase.rpc('kids_precheckin', { p_child: k.id });
    setBusy(null);
    if (error) return Alert.alert('Ops', error.message);
    reload();
  }

  return (
    <Screen title="Kids" subtitle={church.name} color={color} refreshing={refreshing} onRefresh={refresh}>
      <H2>Meus filhos</H2>
      {data.kids.length === 0 && <Empty>Cadastre seus filhos para fazer o check-in no Kids pelo celular.</Empty>}
      {data.kids.map((k) => {
        const t = k.today;
        const room = t?.room_id ? data.rooms[t.room_id] : undefined;
        return (
          <Card key={k.id} style={room ? { borderLeftWidth: 6, borderLeftColor: room.color } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{k.full_name}</Text>
              <Muted>{age(k.birth_date)}</Muted>
            </View>
            {k.allergies ? <Text style={{ color: C.danger, fontWeight: '600' }}>⚠ {k.allergies}</Text> : null}

            {!t && (
              <>
                <Muted>Vai ao culto hoje? Faça o pré-check-in e mostre o código na porta da sala.</Muted>
                <Button title="Fazer pré-check-in" color={color} loading={busy === k.id} onPress={() => precheckin(k)} />
              </>
            )}
            {t && t.status !== 'retirado' && (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 4 }}>
                <Text style={{ color: t.status === 'presente' ? C.ok : C.warn, fontWeight: '700' }}>
                  {t.status === 'presente' ? `✅ Na sala ${room?.name ?? ''} desde ${hhmm(t.checked_in_at)}` : `⏳ Aguardando entrada · ${room?.name ?? ''}`}
                </Text>
                <Muted>Código de retirada</Muted>
                <Text selectable style={{ fontSize: 44, fontWeight: '800', letterSpacing: 10, color: C.text, fontVariant: ['tabular-nums'] }}>{t.security_code}</Text>
                <Muted>A criança só é entregue com este código.</Muted>
              </View>
            )}
            {t?.status === 'retirado' && <Text style={{ color: C.muted }}>👋 Retirada hoje às {hhmm(t.checked_out_at)}</Text>}
          </Card>
        );
      })}
      <Button title="+ Cadastrar filho" variant="outline" color={color} onPress={() => router.push('/kids/novo')} />

      <H2>Aulas e atividades</H2>
      {data.lessons.length === 0 && <Empty>As aulas do Kids aparecem aqui quando a equipe publicar.</Empty>}
      {data.lessons.map((l) => {
        const open = openLesson === l.id;
        const room = l.room_id ? data.rooms[l.room_id] : undefined;
        return (
          <Pressable key={l.id} onPress={() => setOpenLesson(open ? null : l.id)}>
            <Card>
              <Muted>{fmtDate(l.lesson_date)} · {room?.name ?? 'Todas as turmas'}</Muted>
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{l.title}</Text>
              {l.bible_verse ? <Text style={{ fontStyle: 'italic', color: C.muted }}>{l.bible_verse}</Text> : null}
              {open && l.home_activity ? (
                <View style={{ backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#92400e' }}>🏠 Para fazer em casa</Text>
                  <Text style={{ color: '#78350f' }}>{l.home_activity}</Text>
                </View>
              ) : null}
              {open && l.attachments.map((a) => (
                <Pressable key={a.url} onPress={() => WebBrowser.openBrowserAsync(a.url)}>
                  <Text style={{ color, fontWeight: '600' }}>📎 {a.name}</Text>
                </Pressable>
              ))}
              {!open && (l.home_activity || l.attachments.length > 0) ? <Muted>Toque para ver a atividade{l.attachments.length ? ` e ${l.attachments.length} anexo(s)` : ''}</Muted> : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
