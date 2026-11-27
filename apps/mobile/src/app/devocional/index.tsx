import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { DevotionalView, fmtLongDay, type Devotional } from '@/components/devotional';
import { C, Empty, F, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export default function Devocionais() {
  const { church, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const { data: rows } = await supabase.from('devotionals').select('id, publish_on, title, verse_ref, verse_text, body, prayer, author, image_url')
      .eq('church_id', church.id).lte('publish_on', todayBR()).order('publish_on', { ascending: false }).limit(30);
    return (rows ?? []) as Devotional[];
  }, [] as Devotional[], `devos:${church.id}`);
  const [today, ...older] = data;

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      {today ? <DevotionalView d={today} color={color} /> : <Empty>O devocional de hoje ainda não foi publicado.</Empty>}
      {older.length > 0 && (
        <Section title="Anteriores">
          <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
            {older.map((d, i) => (
              <Pressable key={d.id} onPress={() => router.push({ pathname: '/devocional/[id]', params: { id: d.id } })} accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed', backgroundColor: pressed ? C.bg : C.card })}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{d.title}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{fmtLongDay(d.publish_on)}{d.verse_ref ? ` · ${d.verse_ref}` : ''}</Text>
                </View>
                <ChevronRight size={18} color="#9aa39d" />
              </Pressable>
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}
