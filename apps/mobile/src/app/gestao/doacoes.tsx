import { Stack } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { C, Card, Empty, F, Screen, Section, fmtBRL, fmtDateTime } from '@/components/ui';
import { todayBR } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type P = { id: string; kind: string; amount_cents: number; method: string | null; status: string; payer_name: string | null; created_at: string; donation_funds: { name: string } | null };
const monthName = (ym: string) => { const s = new Date(ym + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
const shift = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const STATUS: Record<string, string> = { pago: 'pago', pendente: 'aguardando', cancelado: 'cancelado', falhou: 'falhou', estornado: 'estornado' };

/** Doações e inscrições pagas pelo app (cartão/Pix da carteira de pagamentos), por mês. */
export default function Doacoes() {
  const { church, color } = useChurch();
  const [ym, setYm] = useState(todayBR().slice(0, 7));
  const { data } = useData(async () => {
    const [y, m] = ym.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString(), to = new Date(Date.UTC(y, m, 1, 3)).toISOString();
    const { data: rows } = await supabase.from('payments')
      .select('id, kind, amount_cents, method, status, payer_name, created_at, donation_funds(name)')
      .eq('church_id', church.id).gte('created_at', from).lt('created_at', to).order('created_at', { ascending: false });
    return (rows ?? []) as unknown as P[];
  }, [] as P[], `doa:${church.id}:${ym}`);

  const paid = data.filter((p) => p.status === 'pago');
  const total = paid.reduce((s, p) => s + Number(p.amount_cents), 0);
  const by = new Map<string, number>();
  for (const p of paid) {
    const k = p.kind === 'inscricao' ? 'Inscrições' : p.donation_funds?.name ?? 'Outros';
    by.set(k, (by.get(k) ?? 0) + Number(p.amount_cents));
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Doações' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setYm(shift(ym, -1))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: 8 }}><ChevronLeft size={22} color={C.text} /></Pressable>
        <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{monthName(ym)}</Text>
        <Pressable onPress={() => setYm(shift(ym, 1))} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: 8 }}><ChevronRight size={22} color={C.text} /></Pressable>
      </View>
      <View style={{ backgroundColor: C.dark, borderRadius: 22, padding: 18, gap: 8 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Recebido pelo app</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff' }}>{fmtBRL(total)}</Text>
        {[...by.entries()].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{k}</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: '#fff' }}>{fmtBRL(v)}</Text>
          </View>
        ))}
      </View>
      <Section title={`Pagamentos (${data.length})`}>
        {data.length === 0 ? <Empty>Nenhum pagamento neste mês. Os Pix informados pelos membros aparecem no Financeiro, em “Pix para conferir”.</Empty> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {data.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }} numberOfLines={1}>{p.payer_name ?? 'Anônimo'}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }} numberOfLines={1}>
                    {[p.kind === 'inscricao' ? 'Inscrição' : p.donation_funds?.name, p.method, fmtDateTime(p.created_at)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 14, color: p.status === 'pago' ? C.ok : C.muted }}>{fmtBRL(Number(p.amount_cents))}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{STATUS[p.status] ?? p.status}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
