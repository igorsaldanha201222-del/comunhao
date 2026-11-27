import { Stack, router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { C, Card, Chips, Empty, F, Screen, Section, fmtBRL } from '@/components/ui';
import { fmtDay, todayBR, type EntryType } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type E = { id: string; type: EntryType; status: string; entry_date: string; amount_cents: number; description: string; category: { name: string } | null };
const monthName = (ym: string) => { const s = new Date(ym + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
const shift = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

/** Relatório do mês: entradas e saídas pagas, por categoria, e todos os lançamentos (toque para editar). */
export default function Relatorio() {
  const { church, color } = useChurch();
  const [ym, setYm] = useState(todayBR().slice(0, 7));
  const [view, setView] = useState<'todos' | EntryType>('todos');
  const { data, refresh } = useData(async () => {
    const end = shift(ym, 1) + '-01';
    const { data: rows } = await supabase.from('finance_entries')
      .select('id, type, status, entry_date, amount_cents, description, category:finance_categories(name)')
      .eq('church_id', church.id).gte('entry_date', ym + '-01').lt('entry_date', end).order('entry_date', { ascending: false }).limit(500);
    return (rows ?? []) as unknown as E[];
  }, [] as E[], `finrel:${church.id}:${ym}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const paid = data.filter((e) => e.status === 'pago');
  const sum = (t: EntryType) => paid.filter((e) => e.type === t).reduce((a, e) => a + Number(e.amount_cents), 0);
  const income = sum('entrada'), expense = sum('saida');
  const byCat = (t: EntryType) => {
    const m = new Map<string, number>();
    for (const e of paid.filter((x) => x.type === t)) m.set(e.category?.name ?? 'Sem categoria', (m.get(e.category?.name ?? 'Sem categoria') ?? 0) + Number(e.amount_cents));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const list = data.filter((e) => view === 'todos' || e.type === view);

  function share() {
    const lines = [
      `${church.name} · ${monthName(ym)}`, '',
      `Entradas: ${fmtBRL(income)}`, ...byCat('entrada').map(([n, v]) => `  ${n}: ${fmtBRL(v)}`), '',
      `Saídas: ${fmtBRL(expense)}`, ...byCat('saida').map(([n, v]) => `  ${n}: ${fmtBRL(v)}`), '',
      `Resultado do mês: ${fmtBRL(income - expense)}`,
    ];
    Share.share({ message: lines.join('\n') });
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Relatório do mês', headerRight: () => (
        <Pressable onPress={share} hitSlop={10} accessibilityLabel="Compartilhar relatório" style={{ paddingHorizontal: 8 }}><Share2 size={20} color={C.text} /></Pressable>
      ) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setYm(shift(ym, -1))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: 8 }}><ChevronLeft size={22} color={C.text} /></Pressable>
        <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{monthName(ym)}</Text>
        <Pressable onPress={() => setYm(shift(ym, 1))} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: 8 }}><ChevronRight size={22} color={C.text} /></Pressable>
      </View>

      <View style={{ backgroundColor: C.dark, borderRadius: 22, padding: 18, gap: 10 }}>
        <Line label="Entradas" value={income} tone="#7fd8a4" />
        <Line label="Saídas" value={-expense} tone="#f2b27a" />
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <Line label="Resultado" value={income - expense} tone="#fff" big />
      </View>

      {(['entrada', 'saida'] as EntryType[]).map((t) => {
        const rows = byCat(t);
        if (!rows.length) return null;
        const total = t === 'entrada' ? income : expense;
        return (
          <Section key={t} title={t === 'entrada' ? 'Entradas por categoria' : 'Saídas por categoria'}>
            <Card>
              {rows.map(([name, v]) => (
                <View key={name} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text }}>{name}</Text>
                    <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{fmtBRL(v)}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: C.bg }}>
                    <View style={{ width: `${Math.max(2, (v / total) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: t === 'entrada' ? C.ok : C.danger }} />
                  </View>
                </View>
              ))}
            </Card>
          </Section>
        );
      })}

      <Section title={`Lançamentos (${data.length})`}>
        <Chips color={color} value={view} onChange={setView} options={[{ value: 'todos', label: 'Todos' }, { value: 'entrada', label: 'Entradas' }, { value: 'saida', label: 'Saídas' }]} />
        {list.length === 0 ? <Empty>Nada lançado neste mês.</Empty> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {list.map((e, i) => (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/financeiro/novo', params: { id: e.id } })} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }} numberOfLines={1}>{e.description}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }} numberOfLines={1}>
                    {[fmtDay(e.entry_date), e.category?.name, e.status === 'pendente' && 'pendente'].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: e.type === 'entrada' ? C.ok : C.danger }}>{e.type === 'entrada' ? '+' : '−'} {fmtBRL(Number(e.amount_cents))}</Text>
              </Pressable>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

function Line({ label, value, tone, big }: { label: string; value: number; tone: string; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: F.medium, fontSize: big ? 15 : 14, color: 'rgba(255,255,255,0.8)' }}>{label}</Text>
      <Text style={{ fontFamily: F.extrabold, fontSize: big ? 24 : 17, color: tone }}>{fmtBRL(value)}</Text>
    </View>
  );
}
