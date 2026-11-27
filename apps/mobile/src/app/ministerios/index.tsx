import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Crown } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { C, Empty, F, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type M = { id: string; name: string; color: string; description: string | null; members: { is_leader: boolean; people: { full_name: string } | null }[] };

export default function Ministerios() {
  const { church, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const { data: rows } = await supabase.from('ministries')
      .select('id, name, color, description, members:ministry_members(is_leader, people(full_name))')
      .eq('church_id', church.id).order('name');
    return (rows ?? []) as unknown as M[];
  }, [] as M[], `mins:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      {data.length === 0 && <Empty>Nenhum ministério cadastrado.</Empty>}
      {data.map((m) => {
        const leaders = m.members.filter((x) => x.is_leader).map((x) => x.people?.full_name.split(' ')[0]).filter(Boolean);
        return (
          <Pressable key={m.id} onPress={() => router.push({ pathname: '/ministerios/[id]', params: { id: m.id } })} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.extrabold, fontSize: 18, color: '#fff' }}>{m.name[0]}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{m.name}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }}>{m.members.length} {m.members.length === 1 ? 'pessoa' : 'pessoas'}</Text>
              {leaders.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Crown size={12} color={C.accentText} />
                  <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.accentText }} numberOfLines={1}>{leaders.join(', ')}</Text>
                </View>
              )}
            </View>
            <ChevronRight size={18} color="#9aa39d" />
          </Pressable>
        );
      })}
    </Screen>
  );
}
