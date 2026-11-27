import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { AddButton, List, Row } from '@/components/admin';
import { Empty, Screen, fmtBRL } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Emp = { id: string; full_name: string; job_title: string; salary_cents: number; active: boolean; punch_required: boolean };

/** Funcionários da igreja: cadastro, salário (vai para Contas a pagar) e ponto. */
export default function Funcionarios() {
  const { church, color } = useChurch();
  const { data, refresh } = useData(async () => {
    await supabase.rpc('payroll_generate', { p_church: church.id });
    const { data: rows } = await supabase.from('employees').select('id, full_name, job_title, salary_cents, active, punch_required')
      .eq('church_id', church.id).order('active', { ascending: false }).order('full_name');
    return (rows ?? []) as Emp[];
  }, [] as Emp[], `emps:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Funcionários' }} />
      <AddButton label="Novo funcionário" color={color} onPress={() => router.push({ pathname: '/gestao/funcionario/[id]', params: { id: 'novo' } })} />
      {data.length === 0 ? <Empty>Nenhum funcionário cadastrado.</Empty> : (
        <List>
          {data.map((e, i) => (
            <Row key={e.id} first={i === 0} title={e.full_name + (e.active ? '' : ' (desligado)')}
              sub={[e.job_title, fmtBRL(Number(e.salary_cents)), e.punch_required ? 'bate ponto' : null].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/gestao/funcionario/[id]', params: { id: e.id } })} />
          ))}
        </List>
      )}
    </Screen>
  );
}
