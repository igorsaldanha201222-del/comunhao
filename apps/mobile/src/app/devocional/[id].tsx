import { useLocalSearchParams } from 'expo-router';

import { DevotionalView, type Devotional } from '@/components/devotional';
import { Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

export default function DevocionalDia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useChurch();
  const { data } = useData(async () => {
    const { data: d } = await supabase.from('devotionals').select('id, publish_on, title, verse_ref, verse_text, body, prayer, author, image_url').eq('id', id).maybeSingle();
    return d as Devotional | null;
  }, null, `devo:${id}`);
  return <Screen color={color}>{data ? <DevotionalView d={data} color={color} /> : <Muted>Carregando…</Muted>}</Screen>;
}
