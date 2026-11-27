import { Text, View } from 'react-native';

import { C, Card, Empty, F, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { hhmm } from '@/lib/work';

type Row = {
  employee_id: string; full_name: string; job_title: string; start_time: string | null; end_time: string | null;
  works_today: boolean; last_kind: 'entrada' | 'saida' | null; last_at: string | null;
};

/** Para o pastor e a tesouraria: quem está trabalhando agora. */
export default function Equipe() {
  const { church, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const { data: rows } = await supabase.rpc('staff_on_duty', { p_church: church.id });
    return (rows ?? []) as Row[];
  }, [] as Row[], `equipe:${church.id}`);

  const working = data.filter((r) => r.last_kind === 'entrada');

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20, gap: 2 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Trabalhando agora</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff' }}>{working.length} de {data.length}</Text>
      </View>
      {data.length === 0 ? <Empty>Nenhum funcionário cadastrado. Cadastre no painel, em Funcionários.</Empty> : (
        <Card style={{ padding: 0, gap: 0 }}>
          {data.map((r, i) => {
            const on = r.last_kind === 'entrada';
            const status = on ? `Chegou às ${hhmm(r.last_at!)}` : r.last_kind === 'saida' ? `Saiu às ${hhmm(r.last_at!)}` : r.works_today ? 'Ainda não bateu o ponto' : 'Folga hoje';
            const late = !r.last_kind && r.works_today && r.start_time && new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo' }) > r.start_time;
            return (
              <View key={r.employee_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? C.ok : late ? C.accent : C.line }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }} numberOfLines={1}>{r.full_name}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: late ? C.accentText : C.muted }} numberOfLines={1}>{r.job_title} · {status}</Text>
                </View>
                {r.start_time && r.end_time ? <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</Text> : null}
              </View>
            );
          })}
        </Card>
      )}
      <Muted>Cadastro, salário e relatório de ponto do mês ficam no painel, em Funcionários. Salários entram sozinhos em Contas a pagar no Financeiro.</Muted>
    </Screen>
  );
}
