import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { C, Card, Empty, H2, Muted, Screen, fmtBRL, fmtDateTime } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Ev = { id: string; title: string; starts_at: string; location: string | null; price_cents: number; cover_url: string | null };

export default function Agenda() {
  const { church, user, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const [e, r] = await Promise.all([
      supabase.from('events').select('id, title, starts_at, location, price_cents, cover_url').eq('church_id', church.id)
        .gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('registrations').select('event_id, status').eq('church_id', church.id).eq('user_id', user.id).neq('status', 'cancelada'),
    ]);
    return {
      events: (e.data ?? []) as Ev[],
      mine: Object.fromEntries((r.data ?? []).map((x) => [x.event_id, x.status])) as Record<string, string>,
    };
  }, { events: [], mine: {} }, `${church.id}:${user.id}`);
  const { events, mine } = data;

  return (
    <Screen title="Agenda" subtitle="Eventos e inscrições" color={color} refreshing={refreshing} onRefresh={refresh}>
      {events.length === 0 && <Empty>Nenhum evento programado.</Empty>}
      {events.map((e) => (
        <Link key={e.id} href={{ pathname: '/evento/[id]', params: { id: e.id } }} asChild>
          <Pressable>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {e.cover_url && <Image source={e.cover_url} style={{ width: '100%', aspectRatio: 16 / 9 }} />}
              <View style={{ padding: 14, gap: 2 }}>
                <H2>{e.title}</H2>
                <Muted>{fmtDateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</Muted>
                <Muted>
                  {e.price_cents ? fmtBRL(e.price_cents) : 'Gratuito'}
                  {mine[e.id] === 'confirmada' ? '  ·  ✓ Inscrito' : mine[e.id] === 'pendente' ? '  ·  Aguardando pagamento' : ''}
                </Muted>
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}
      <View style={{ height: 1, backgroundColor: C.border }} />
    </Screen>
  );
}
