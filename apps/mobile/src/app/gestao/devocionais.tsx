import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Text } from 'react-native';

import { AddButton, isoToBR, List, Row, todayISO } from '@/components/admin';
import { C, Empty, F, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type D = { id: string; title: string; publish_on: string; published: boolean; verse_ref: string | null };

export default function GestaoDevocionais() {
  const { church, color } = useChurch();
  const { data, refresh } = useData(async () => {
    const { data: rows } = await supabase.from('devotionals').select('id, title, publish_on, published, verse_ref').eq('church_id', church.id).order('publish_on', { ascending: false }).limit(90);
    return (rows ?? []) as D[];
  }, [] as D[], `gdevo:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const today = todayISO();

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Devocionais' }} />
      <AddButton label="Escrever devocional" color={color} onPress={() => router.push({ pathname: '/gestao/devocional/[id]', params: { id: 'novo' } })} />
      {data.length === 0 ? <Empty>Nenhum devocional ainda.</Empty> : (
        <List>
          {data.map((d, i) => {
            const tag = !d.published ? 'rascunho' : d.publish_on > today ? 'agendado' : d.publish_on === today ? 'hoje' : '';
            return (
              <Row key={d.id} first={i === 0} title={d.title} sub={[isoToBR(d.publish_on), d.verse_ref].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/gestao/devocional/[id]', params: { id: d.id } })}
                right={tag ? <Text style={{ fontFamily: F.bold, fontSize: 11, color: tag === 'hoje' ? C.ok : C.accentText }}>{tag}</Text> : undefined} />
            );
          })}
        </List>
      )}
    </Screen>
  );
}
