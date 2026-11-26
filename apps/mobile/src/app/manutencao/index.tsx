import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, C, Card, Chips, Empty, Muted, Screen } from '@/components/ui';
import { STATUS, statusOf, useMaintAccess } from '@/lib/maintenance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Row = {
  id: string; number: number; title: string; location: string | null; priority: string; status: string;
  photos: string[]; assigned_to: string | null; requested_by: string | null; created_at: string; thumb?: string;
};

export default function Manutencao() {
  const { church, user, color } = useChurch();
  const access = useMaintAccess();
  const [tab, setTab] = useState<'abertos' | 'comigo' | 'meus' | 'concluidos'>('abertos');

  const { data, refresh, refreshing } = useData<Row[]>(async () => {
    const { data: rows } = await supabase.from('maintenance_requests')
      .select('id, number, title, location, priority, status, photos, assigned_to, requested_by, created_at')
      .eq('church_id', church.id).neq('status', 'cancelada').order('created_at', { ascending: false }).limit(100);
    const list = (rows ?? []) as Row[];
    const thumbs = list.map((r) => r.photos[0]).filter(Boolean);
    if (thumbs.length) {
      const { data: signed } = await supabase.storage.from('maintenance').createSignedUrls(thumbs, 3600);
      const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      list.forEach((r) => { r.thumb = r.photos[0] ? map.get(r.photos[0]) ?? undefined : undefined; });
    }
    return list;
  }, [], `${church.id}:${user.id}`);

  const shown = data.filter((r) =>
    tab === 'abertos' ? r.status !== 'concluida'
      : tab === 'comigo' ? r.assigned_to === user.id && r.status !== 'concluida'
      : tab === 'meus' ? r.requested_by === user.id
      : r.status === 'concluida');

  const tabs = [
    { value: 'abertos' as const, label: `Abertos (${data.filter((r) => r.status !== 'concluida').length})` },
    ...(access.manage ? [{ value: 'comigo' as const, label: 'Comigo' }] : []),
    { value: 'meus' as const, label: 'Que abri' },
    { value: 'concluidos' as const, label: 'Concluídos' },
  ];

  return (
    <Screen title="Manutenção" subtitle={access.manage ? 'Chamados da igreja' : 'Seus chamados'} color={color} refreshing={refreshing} onRefresh={refresh}>
      {access.request && <Button title="📸  Abrir chamado" color={color} onPress={() => router.push('/manutencao/novo')} />}
      <Chips color={color} value={tab} onChange={setTab} options={tabs} />
      {shown.length === 0 && <Empty>Nenhum chamado aqui.</Empty>}
      {shown.map((r) => {
        const st = statusOf(r.status);
        return (
          <Pressable key={r.id} onPress={() => router.push(`/manutencao/${r.id}`)}>
            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {r.thumb
                ? <Image source={{ uri: r.thumb }} style={{ width: 64, height: 64, borderRadius: 10 }} contentFit="cover" />
                : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26 }}>🔧</Text></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '600', color: C.text }} numberOfLines={2}>#{r.number} · {r.title}</Text>
                {r.location ? <Muted>📍 {r.location}</Muted> : null}
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Text style={{ color: st.color, fontWeight: '600', fontSize: 13 }}>● {st.label}</Text>
                  {(r.priority === 'alta' || r.priority === 'urgente') && (
                    <Text style={{ color: r.priority === 'urgente' ? C.danger : C.warn, fontSize: 13, fontWeight: '600' }}>
                      {r.priority === 'urgente' ? '⚠ Urgente' : 'Alta'}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Muted>Etapas: {STATUS.map((s) => s.label).join(' → ')}</Muted>
    </Screen>
  );
}
