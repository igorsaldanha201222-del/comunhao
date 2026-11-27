import { router, useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarClock, Plus, Settings2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { HubItem } from '@/components/admin';
import { C, Card, Empty, F, Screen, Section, fmtBRL } from '@/components/ui';
import { type Entry, fmtDay, loadFinance } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const EMPTY = { ok: true, accounts: [], total: 0, income: 0, expense: 0, due: [], incoming: [], last: [], categories: [], today: '' };

export default function Financeiro() {
  const { church, color, user } = useChurch();
  const { data, refresh, refreshing } = useData(() => loadFinance(church.id), EMPTY as Awaited<ReturnType<typeof loadFinance>>, `fin:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const openEntry = (e: Entry) => router.push({ pathname: '/financeiro/novo', params: { id: e.id } });

  function pay(e: Entry) {
    Alert.alert('Marcar como pago?', `${e.description}
${fmtBRL(Number(e.amount_cents))} · pago hoje`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Paguei', onPress: async () => {
          const { error } = await supabase.from('finance_entries').update({ status: 'pago', entry_date: data.today, updated_by: user.id }).eq('id', e.id);
          if (error) Alert.alert('Não deu para salvar', error.message); else refresh();
        },
      },
    ]);
  }

  function confirmIn(e: Entry) {
    Alert.alert('Confirmar entrada?', `${e.description}
${fmtBRL(Number(e.amount_cents))}

Confira se o valor caiu no extrato do banco.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Caiu na conta', onPress: async () => {
          const { error } = await supabase.from('finance_entries').update({ status: 'pago', updated_by: user.id }).eq('id', e.id);
          if (error) Alert.alert('Não deu para salvar', error.message); else refresh();
        },
      },
    ]);
  }

  if (!data.ok) {
    return <Screen title="Financeiro"><Empty>O financeiro é visto só pelo pastor, administração e tesouraria.</Empty></Screen>;
  }

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 22, gap: 6 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Saldo em todas as contas</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 34, color: '#fff', letterSpacing: -0.5 }}>{fmtBRL(data.total)}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
          <MonthBox label="Entradas no mês" value={data.income} icon="in" />
          <MonthBox label="Saídas no mês" value={data.expense} icon="out" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <BigButton label="Lançar entrada" solid color={color} onPress={() => router.push({ pathname: '/financeiro/novo', params: { tipo: 'entrada' } })} />
        <BigButton label="Lançar saída" color={color} onPress={() => router.push({ pathname: '/financeiro/novo', params: { tipo: 'saida' } })} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <HubItem icon={BarChart3} label="Relatório do mês" sub="Lançamentos por categoria" color={color} onPress={() => router.push('/financeiro/relatorio')} />
        <HubItem icon={Settings2} label="Categorias e contas" sub="Cadastrar e ajustar" color={color} onPress={() => router.push('/financeiro/cadastros')} />
      </View>

      {data.incoming.length > 0 && (
        <Section title="Pix para conferir">
          <Card style={{ padding: 0, gap: 0 }}>
            {data.incoming.map((e, i) => <Row key={e.id} e={e} first={i === 0} today={data.today} onPay={() => confirmIn(e)} payLabel="Confirmar" onOpen={() => openEntry(e)} />)}
          </Card>
        </Section>
      )}

      <Section title="Contas a pagar">
        {data.due.length === 0 ? <Empty>Nada vencendo nos próximos 15 dias.</Empty> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {data.due.map((e, i) => <Row key={e.id} e={e} first={i === 0} due today={data.today} onPay={() => pay(e)} onOpen={() => openEntry(e)} />)}
          </Card>
        )}
      </Section>

      <Section title="Últimos lançamentos">
        {data.last.length === 0 ? <Empty>Nenhum lançamento ainda.</Empty> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {data.last.map((e, i) => <Row key={e.id} e={e} first={i === 0} today={data.today} onOpen={() => openEntry(e)} />)}
          </Card>
        )}
      </Section>

      {data.accounts.length > 0 && (
        <Section title="Contas">
          <Card style={{ padding: 0, gap: 0 }}>
            {data.accounts.map((a, i) => (
              <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text, flex: 1 }} numberOfLines={1}>{a.name}</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: a.balance < 0 ? C.danger : C.text }}>{fmtBRL(a.balance)}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  );
}

function MonthBox({ label, value, icon }: { label: string; value: number; icon: 'in' | 'out' }) {
  const Icon = icon === 'in' ? ArrowDownLeft : ArrowUpRight;
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={icon === 'in' ? '#7fd8a4' : '#f2b27a'} strokeWidth={2.2} />
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 16, color: '#fff' }}>{fmtBRL(value)}</Text>
    </View>
  );
}

function BigButton({ label, solid, color, onPress }: { label: string; solid?: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: solid ? color : C.card, borderWidth: solid ? 0 : 1, borderColor: C.line, opacity: pressed ? 0.85 : 1,
      })}>
      <Plus size={18} color={solid ? '#fff' : C.text} strokeWidth={2.2} />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: solid ? '#fff' : C.text }}>{label}</Text>
    </Pressable>
  );
}

function Row({ e, first, due, today, onPay, onOpen, payLabel = 'Marcar pago' }: { e: Entry; first: boolean; due?: boolean; today: string; onPay?: () => void; onOpen?: () => void; payLabel?: string }) {
  const inc = e.type === 'entrada';
  const late = due && e.due_date && e.due_date < today;
  const date = due ? e.due_date ?? e.entry_date : e.entry_date;
  return (
    <Pressable onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: first ? 0 : 1, borderTopColor: '#eef1ed' }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: due ? C.accentTint : inc ? C.tint : '#f6ecec' }}>
        {due ? <CalendarClock size={18} color={C.accentText} strokeWidth={2} />
          : inc ? <ArrowDownLeft size={18} color={C.ok} strokeWidth={2.2} /> : <ArrowUpRight size={18} color={C.danger} strokeWidth={2.2} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }} numberOfLines={1}>{e.description}</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 12, color: late ? C.danger : C.muted }} numberOfLines={1}>
          {[late ? `Venceu ${fmtDay(date)}` : due ? `Vence ${fmtDay(date)}` : fmtDay(date), e.category?.name].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: due ? C.text : inc ? C.ok : C.danger }}>{inc ? '+' : '−'} {fmtBRL(Number(e.amount_cents))}</Text>
        {onPay && (
          <Pressable onPress={onPay} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ok }}>{payLabel}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
