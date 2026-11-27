import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { List, Row } from '@/components/admin';
import { C, Chips, Empty, F, Input, Screen } from '@/components/ui';
import { useMe } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type P = { id: string; user_id: string | null; full_name: string; status: string; baptized_at: string | null };
type R = P & { serves: boolean; events: number; cultos: number; giveMonths: number; score: number; group: 'engajado' | 'participa' | 'afastado' };
const FILTERS = [
  { value: '', label: 'Todos' }, { value: 'engajado', label: 'Engajados' }, { value: 'participa', label: 'Participam' }, { value: 'afastado', label: 'Afastados' },
  { value: 'nao_serve', label: 'Não servem' }, { value: 'nao_culto', label: 'Sem culto' }, { value: 'nao_batizado', label: 'Não batizados' },
];

/** Quem serve, vai aos cultos, participa de eventos e contribui (mesma conta do painel). */
export default function Engajamento() {
  const { church, color } = useChurch();
  const me = useMe();
  const [months, setMonths] = useState('6');
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const { data } = useData(async () => {
    const since = new Date(Date.now() - Number(months) * 30.4 * 864e5).toISOString();
    const nowIso = new Date().toISOString();
    const [pp, mm, sa, regs, gifts, satt] = await Promise.all([
      supabase.from('people').select('id, user_id, full_name, status, baptized_at').eq('church_id', church.id).order('full_name'),
      supabase.from('ministry_members').select('person_id').eq('church_id', church.id),
      supabase.from('schedule_assignments').select('person_id, schedules!inner(starts_at)').eq('church_id', church.id).neq('status', 'recusado').gte('schedules.starts_at', since).lte('schedules.starts_at', nowIso),
      supabase.from('registrations').select('user_id').eq('church_id', church.id).neq('status', 'cancelada').gte('created_at', since).not('user_id', 'is', null),
      me.canFinance
        ? supabase.from('finance_entries').select('person_id, entry_date').eq('church_id', church.id).eq('type', 'entrada').eq('status', 'pago').gte('entry_date', since.slice(0, 10)).not('person_id', 'is', null)
        : Promise.resolve({ data: [] as { person_id: string; entry_date: string }[] }),
      supabase.from('service_attendance').select('person_id, services!inner(service_date)').eq('church_id', church.id).gte('services.service_date', since.slice(0, 10)),
    ]);
    const tally = (rows: { [k: string]: unknown }[] | null, key: string) => { const m = new Map<string, number>(); for (const r of rows ?? []) { const k = r[key] as string | null; if (k) m.set(k, (m.get(k) ?? 0) + 1); } return m; };
    const min = tally(mm.data, 'person_id'), esc = tally(sa.data, 'person_id'), ev = tally(regs.data, 'user_id'), cul = tally(satt.data, 'person_id');
    const give = new Map<string, Set<string>>();
    for (const g of (gifts.data ?? []) as { person_id: string; entry_date: string }[]) { if (!give.has(g.person_id)) give.set(g.person_id, new Set()); give.get(g.person_id)!.add(g.entry_date.slice(0, 7)); }
    return ((pp.data ?? []) as P[]).filter((p) => p.status !== 'inativo' && p.status !== 'visitante').map((p): R => {
      const serves = (min.get(p.id) ?? 0) > 0 || (esc.get(p.id) ?? 0) > 0;
      const events = p.user_id ? ev.get(p.user_id) ?? 0 : 0;
      const cultos = cul.get(p.id) ?? 0;
      const giveMonths = give.get(p.id)?.size ?? 0;
      const score = (serves ? 1 : 0) + (events ? 1 : 0) + (giveMonths ? 1 : 0) + (cultos ? 1 : 0);
      return { ...p, serves, events, cultos, giveMonths, score, group: score >= 2 ? 'engajado' : score === 1 ? 'participa' : 'afastado' };
    });
  }, [] as R[], `eng:${church.id}:${months}:${me.canFinance}`);

  const shown = data.filter((r) => {
    if (q && !r.full_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'nao_batizado') return !r.baptized_at;
    if (filter === 'nao_serve') return !r.serves;
    if (filter === 'nao_culto') return r.cultos === 0;
    return !filter || r.group === filter;
  });
  const pct = (n: number) => (data.length ? `${Math.round((n / data.length) * 100)}%` : '—');
  const stats = [
    ['Servem', data.filter((r) => r.serves).length], ['Vão ao culto', data.filter((r) => r.cultos).length],
    ['Em eventos', data.filter((r) => r.events).length], ['Batizados', data.filter((r) => r.baptized_at).length],
    ...(me.canFinance ? [['Contribuem', data.filter((r) => r.giveMonths).length] as [string, number]] : []),
    ['Afastados', data.filter((r) => r.group === 'afastado').length],
  ] as [string, number][];

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Engajamento' }} />
      <Chips color={color} value={months} onChange={setMonths} options={[{ value: '3', label: '3 meses' }, { value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map(([label, n]) => (
          <View key={label} style={{ width: '31%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12, gap: 2 }}>
            <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: label === 'Afastados' ? C.danger : C.text }}>{n}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{label} · {pct(n)}</Text>
          </View>
        ))}
      </View>
      <Chips color={color} value={filter} onChange={setFilter} options={FILTERS} />
      <Input label="Buscar" value={q} onChangeText={setQ} placeholder="Nome" />
      {shown.length === 0 ? <Empty>Ninguém neste filtro.</Empty> : (
        <List>
          {shown.map((r, i) => (
            <Row key={r.id} first={i === 0} title={r.full_name}
              sub={[r.serves && 'serve', r.cultos && `${r.cultos} culto${r.cultos === 1 ? '' : 's'}`, r.events && `${r.events} evento${r.events === 1 ? '' : 's'}`, me.canFinance && r.giveMonths && `contribuiu ${r.giveMonths} ${r.giveMonths === 1 ? 'mês' : 'meses'}`].filter(Boolean).join(' · ') || 'sem participação no período'}
              right={<Text style={{ fontFamily: F.bold, fontSize: 12, color: r.group === 'afastado' ? C.danger : r.group === 'engajado' ? C.ok : C.accentText }}>{r.group}</Text>}
              onPress={() => router.push({ pathname: '/pessoas/[id]', params: { id: r.id } })} />
          ))}
        </List>
      )}
    </Screen>
  );
}
