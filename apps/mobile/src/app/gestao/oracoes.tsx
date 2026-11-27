import { Stack } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { C, Chips, Empty, F, Screen, fmtDateTime } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type P = { id: string; author_name: string | null; category: string; body: string; is_private: boolean; prayed_at: string | null; created_at: string };

/** Pedidos de oração da igreja: a equipe ora e marca. */
export default function GestaoOracoes() {
  const { church, user, color } = useChurch();
  const [tab, setTab] = useState<'abertos' | 'orados'>('abertos');
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('prayer_requests').select('id, author_name, category, body, is_private, prayed_at, created_at').eq('church_id', church.id).order('created_at', { ascending: false }).limit(200);
    return (rows ?? []) as P[];
  }, [] as P[], `gpr:${church.id}`);
  const list = data.filter((p) => (tab === 'abertos' ? !p.prayed_at : !!p.prayed_at));

  async function prayed(p: P) {
    const { error } = await supabase.from('prayer_requests').update({ prayed_at: new Date().toISOString(), prayed_by: user.id }).eq('id', p.id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Pedidos de oração' }} />
      <Chips color={color} value={tab} onChange={setTab} options={[
        { value: 'abertos', label: `Para orar ${data.filter((p) => !p.prayed_at).length}` },
        { value: 'orados', label: 'Já orados' },
      ]} />
      {list.length === 0 && <Empty>{tab === 'abertos' ? 'Nenhum pedido esperando.' : 'Nada por aqui ainda.'}</Empty>}
      {list.map((p) => (
        <View key={p.id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.accentText, backgroundColor: C.accentTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>{p.category}</Text>
            {p.is_private && <Lock size={13} color={C.muted} accessibilityLabel="só a liderança" />}
            <Text style={{ flex: 1, textAlign: 'right', fontFamily: F.regular, fontSize: 12, color: C.muted }}>{fmtDateTime(p.created_at)}</Text>
          </View>
          <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.text }}>{p.body}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 13, color: C.body }}>{p.author_name ?? 'Anônimo'}</Text>
            {p.prayed_at ? <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.ok }}>Orado {fmtDateTime(p.prayed_at)}</Text> : (
              <Pressable onPress={() => prayed(p)} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: color }}>
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: '#fff' }}>Oramos</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </Screen>
  );
}
