import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Button, C, Card, Chips, H2, Input, Muted, Screen, fmtDateTime } from '@/components/ui';
import { useMaintAccess } from '@/lib/maintenance';
import { useChurch, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const CATEGORIES = ['Saúde', 'Família', 'Casamento', 'Finanças', 'Trabalho', 'Espiritual', 'Outros'];
type Prayer = { id: string; category: string; body: string; created_at: string; prayed_at: string | null };

export default function Perfil() {
  const { church, user, color } = useChurch();
  const { selectChurch } = useSession();
  const [category, setCategory] = useState('Saúde');
  const [body, setBody] = useState('');
  const [isPrivate, setPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const name = (user.user_metadata?.full_name as string) ?? user.email;
  const maint = useMaintAccess();

  const { data: mine, reload: load } = useData<Prayer[]>(async () => {
    const { data } = await supabase.from('prayer_requests').select('id, category, body, created_at, prayed_at')
      .eq('church_id', church.id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    return data ?? [];
  }, [], `${church.id}:${user.id}`);

  async function sendPrayer() {
    setBusy(true);
    const { error } = await supabase.from('prayer_requests').insert({
      church_id: church.id, user_id: user.id, author_name: name, category, body: body.trim(), is_private: isPrivate,
    });
    setBusy(false);
    if (error) return Alert.alert('Ops', error.message);
    setBody('');
    Alert.alert('Pedido enviado', 'A equipe de intercessão vai orar por você. 🙏');
    load();
  }

  return (
    <Screen title="Perfil" subtitle={`${name} · ${church.name}`} color={color}>
      <Card>
        <H2>🧸 Kids</H2>
        <Muted>Cadastre seus filhos, faça o check-in pelo celular e veja as aulas e atividades.</Muted>
        <Button title="Abrir Kids" color={color} onPress={() => router.push('/kids')} />
      </Card>
      {maint.request && (
        <Card>
          <H2>🔧 Manutenção</H2>
          <Muted>{maint.manage ? 'Veja e mova os chamados da igreja.' : 'Viu algo quebrado? Tire uma foto e abra um chamado.'}</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="📸 Abrir chamado" color={color} onPress={() => router.push('/manutencao/novo')} /></View>
            <View style={{ flex: 1 }}><Button title="Ver chamados" variant="outline" color={color} onPress={() => router.push('/manutencao')} /></View>
          </View>
        </Card>
      )}
      <Card>
        <H2>Pedido de oração</H2>
        <Chips color={color} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Input label="Como podemos orar por você?" value={body} onChangeText={setBody} multiline maxLength={1000} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>Só a liderança pode ver</Text>
          <Switch value={isPrivate} onValueChange={setPrivate} trackColor={{ true: color }} />
        </View>
        <Button title="Enviar pedido" color={color} onPress={sendPrayer} loading={busy} disabled={body.trim().length < 5} />
      </Card>

      {mine.length > 0 && (
        <Card>
          <H2>Meus pedidos</H2>
          {mine.map((p) => (
            <View key={p.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: C.border }}>
              <Muted>{p.category} · {fmtDateTime(p.created_at)}</Muted>
              <Text numberOfLines={2}>{p.body}</Text>
              {p.prayed_at && <Text style={{ color: C.ok }}>🙏 A igreja orou por você</Text>}
            </View>
          ))}
        </Card>
      )}

      <Button title="Trocar de igreja" variant="outline" color={color} onPress={() => selectChurch(null)} />
      <Button title="Sair" variant="outline" color={C.danger} onPress={() => { selectChurch(null); supabase.auth.signOut(); }} />
    </Screen>
  );
}
