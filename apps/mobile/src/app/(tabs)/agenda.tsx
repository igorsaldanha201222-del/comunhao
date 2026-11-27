import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CalendarDays, Check, MapPin } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { C, Empty, F, Screen, fmtBRL } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Ev = { id: string; title: string; starts_at: string; location: string | null; price_cents: number; cover_url: string | null };
const TZ = 'America/Sao_Paulo';
const monthKey = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: TZ, month: 'long', year: 'numeric' });
const day = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit' });
const wk = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'short' }).replace('.', '');
const hour = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace(':00', 'h');

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

  const groups: [string, Ev[]][] = [];
  for (const e of events) {
    const k = monthKey(e.starts_at);
    const g = groups.find(([m]) => m === k);
    if (g) g[1].push(e); else groups.push([k, [e]]);
  }

  return (
    <Screen title="Agenda" subtitle="Eventos e inscrições" color={color} refreshing={refreshing} onRefresh={refresh}>
      {events.length === 0 && <Empty>Nenhum evento programado.</Empty>}
      {groups.map(([m, list]) => (
        <View key={m} style={{ gap: 12 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 }}>{m}</Text>
          {list.map((e) => {
            const st = mine[e.id];
            return (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: e.id } })} accessibilityRole="button"
                style={({ pressed }) => ({ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden', opacity: pressed ? 0.9 : 1 })}>
                {e.cover_url ? <Image source={e.cover_url} style={{ width: '100%', aspectRatio: 16 / 8 }} contentFit="cover" /> : null}
                <View style={{ flexDirection: 'row', gap: 14, padding: 14, alignItems: 'center' }}>
                  <View style={{ width: 56, paddingVertical: 8, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.extrabold, fontSize: 22, color }}>{day(e.starts_at)}</Text>
                    <Text style={{ fontFamily: F.semibold, fontSize: 11, color, textTransform: 'uppercase' }}>{wk(e.starts_at)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={2}>{e.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CalendarDays size={13} color={C.muted} />
                      <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }}>{hour(e.starts_at)}{e.price_cents ? ` · ${fmtBRL(e.price_cents)}` : ' · Gratuito'}</Text>
                    </View>
                    {e.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} color={C.muted} />
                        <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }} numberOfLines={1}>{e.location}</Text>
                      </View>
                    ) : null}
                  </View>
                  {st ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: st === 'confirmada' ? C.tint : C.accentTint }}>
                      {st === 'confirmada' ? <Check size={12} color={C.ok} strokeWidth={3} /> : null}
                      <Text style={{ fontFamily: F.bold, fontSize: 11, color: st === 'confirmada' ? C.ok : C.accentText }}>{st === 'confirmada' ? 'Inscrito' : 'Pagar'}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
