import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { AddButton, List, Row } from '@/components/admin';
import { C, Chips, Empty, F, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Ev = { id: string; title: string; starts_at: string; published: boolean; regs: { status: string }[] };

export default function GestaoEventos() {
  const { church, color } = useChurch();
  const [when, setWhen] = useState<'proximos' | 'passados'>('proximos');
  const { data, refresh } = useData(async () => {
    const { data: rows } = await supabase.from('events').select('id, title, starts_at, published, regs:registrations(status)').eq('church_id', church.id).order('starts_at', { ascending: false }).limit(200);
    return (rows ?? []) as unknown as Ev[];
  }, [] as Ev[], `gev:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const now = new Date().toISOString();
  const list = when === 'proximos' ? data.filter((e) => e.starts_at >= now).reverse() : data.filter((e) => e.starts_at < now);
  const fmt = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('.', '');

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Eventos' }} />
      <AddButton label="Novo evento" color={color} onPress={() => router.push({ pathname: '/gestao/evento/[id]', params: { id: 'novo' } })} />
      <Chips color={color} value={when} onChange={setWhen} options={[{ value: 'proximos', label: 'Próximos' }, { value: 'passados', label: 'Já passaram' }]} />
      {list.length === 0 ? <Empty>Nenhum evento aqui.</Empty> : (
        <List>
          {list.map((e, i) => {
            const ok = e.regs.filter((r) => r.status === 'confirmada').length;
            return (
              <Row key={e.id} first={i === 0} title={e.title} sub={`${fmt(e.starts_at)} · ${ok} inscrito${ok === 1 ? '' : 's'}`}
                onPress={() => router.push({ pathname: '/gestao/evento/[id]', params: { id: e.id } })}
                right={!e.published ? <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.accentText }}>rascunho</Text> : undefined} />
            );
          })}
        </List>
      )}
    </Screen>
  );
}
