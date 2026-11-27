import { router } from 'expo-router';
import { Check, MessageCircle, QrCode } from 'lucide-react-native';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { C, Card, Chips, Empty, F, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useState } from 'react';

type V = { id: string; full_name: string; phone: string | null; how_found: string | null; created_at: string; contacted_at: string | null };

const since = (v: string) => {
  const d = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
};
const wa = (phone: string, first: string, church: string) => {
  let n = phone.replace(/\D/g, '');
  if (n.length <= 11) n = '55' + n;
  const msg = `Olá, ${first}! Aqui é da ${church}. Que alegria ter você com a gente! Como podemos te ajudar?`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
};

/** Lista de visitantes para a liderança entrar em contato. */
export default function Visitantes() {
  const { church, color, user } = useChurch();
  const [filter, setFilter] = useState<'novos' | 'todos'>('novos');
  const { data, setData, refresh, refreshing } = useData(async () => {
    const { data: rows, error } = await supabase.from('people').select('id, full_name, phone, how_found, created_at, contacted_at')
      .eq('church_id', church.id).eq('status', 'visitante').order('created_at', { ascending: false }).limit(100);
    return error ? null : (rows ?? []) as V[];
  }, [] as V[] | null, `visitors:${church.id}`);

  if (data === null) return <Screen><Empty>A lista de visitantes é vista só pela liderança.</Empty></Screen>;
  const list = filter === 'novos' ? data.filter((v) => !v.contacted_at) : data;

  async function mark(v: V) {
    const on = !v.contacted_at;
    const at = on ? new Date().toISOString() : null;
    setData(data!.map((x) => (x.id === v.id ? { ...x, contacted_at: at } : x)));
    const { error } = await supabase.from('people').update({ contacted_at: at, contacted_by: on ? user.id : null }).eq('id', v.id);
    if (error) { Alert.alert('Não deu para salvar', error.message); refresh(); }
  }

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <Pressable onPress={() => router.push('/qr-entrada')} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.dark, borderRadius: 20, padding: 16, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <QrCode size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: '#fff' }}>QR Code da entrada</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Imprima e deixe na porta: o visitante se cadastra sozinho</Text>
        </View>
      </Pressable>

      <Chips color={color} value={filter} onChange={setFilter}
        options={[{ value: 'novos', label: `Sem contato (${data.filter((v) => !v.contacted_at).length})` }, { value: 'todos', label: 'Todos' }]} />

      {list.length === 0 ? <Empty>{filter === 'novos' ? 'Todo mundo já recebeu contato. 🙌' : 'Nenhum visitante ainda.'}</Empty> : (
        <Card style={{ padding: 0, gap: 0 }}>
          {list.map((v, i) => (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }} numberOfLines={1}>{v.full_name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }} numberOfLines={1}>
                  {[`Chegou ${since(v.created_at)}`, v.how_found].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {v.phone ? (
                <Pressable onPress={() => Linking.openURL(wa(v.phone!, v.full_name.split(' ')[0], church.name))} accessibilityLabel={`WhatsApp de ${v.full_name}`}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={20} color={C.ok} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => mark(v)} accessibilityRole="checkbox" accessibilityState={{ checked: !!v.contacted_at }} accessibilityLabel="Já falei"
                style={{ height: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: v.contacted_at ? color : '#fff', borderWidth: v.contacted_at ? 0 : 1, borderColor: C.line }}>
                {v.contacted_at ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                <Text style={{ fontFamily: F.semibold, fontSize: 13, color: v.contacted_at ? '#fff' : C.text }}>{v.contacted_at ? 'Falei' : 'Já falei'}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      <Muted>Toque no balão para abrir o WhatsApp com uma mensagem de boas-vindas pronta.</Muted>
    </Screen>
  );
}
