import { Text, View } from 'react-native';

import { C, Card, Empty, F, Muted, Screen, fmtBRL } from '@/components/ui';
import { fmtDay } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Row = { id: string; entry_date: string; amount_cents: number; description: string; category: string | null; status: 'pago' | 'pendente' };

/** Histórico de contribuições do próprio membro. */
export default function Contribuicoes() {
  const { church, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const { data: rows } = await supabase.rpc('my_contributions', { p_church: church.id });
    return (rows ?? []) as Row[];
  }, [] as Row[], `contrib:${church.id}`);
  const year = new Date().getFullYear().toString();
  const total = data.filter((r) => r.status === 'pago' && r.entry_date.startsWith(year)).reduce((a, r) => a + Number(r.amount_cents), 0);

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20, gap: 2 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Confirmado em {year}</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff' }}>{fmtBRL(total)}</Text>
      </View>
      {data.length === 0 ? <Empty>Nenhuma contribuição registrada ainda.</Empty> : (
        <Card style={{ padding: 0, gap: 0 }}>
          {data.map((r, i) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{r.category ?? 'Contribuição'}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: r.status === 'pago' ? C.muted : C.accentText }}>
                  {fmtDay(r.entry_date)} · {r.status === 'pago' ? 'confirmado' : 'aguardando a tesouraria'}
                </Text>
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{fmtBRL(Number(r.amount_cents))}</Text>
            </View>
          ))}
        </Card>
      )}
      <Muted>Precisa de um comprovante para o imposto de renda? Peça à tesouraria da igreja.</Muted>
    </Screen>
  );
}
