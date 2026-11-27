import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, Card, Input, Muted, Screen, s } from '@/components/ui';
import { useSession, type Church } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Escolher uma igreja já vinculada ou entrar em uma nova pelo código. */
export default function EscolherIgreja() {
  const { session, selectChurch } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Church[]>([]);

  useEffect(() => {
    supabase.from('memberships').select('churches(id, slug, name, logo_url, primary_color)').eq('user_id', session!.user.id)
      .then(({ data }) => {
        const list = (data ?? []).map((m) => m.churches as unknown as Church).filter(Boolean);
        // Uma igreja só: entra direto, sem precisar tocar no nome.
        if (list.length === 1) selectChurch(list[0]);
        else setMine(list);
      });
  }, [session, selectChurch]);

  async function join() {
    setBusy(true);
    const { data, error } = await supabase.rpc('join_church', { p_slug: code.trim().toLowerCase() });
    setBusy(false);
    if (error) return Alert.alert('Igreja não encontrada', 'Confira o código com a liderança da sua igreja.');
    selectChurch(data as Church);
  }

  return (
    <Screen title="Sua igreja" subtitle="Entre com o código que a sua igreja divulgou.">
      {mine.length > 0 && (
        <Card>
          <Text style={s.h2}>Minhas igrejas</Text>
          {mine.map((c) => (
            <Pressable key={c.id} onPress={() => selectChurch(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary_color }} />
              <Text style={{ fontSize: 16 }}>{c.name}</Text>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <Input label="Código da igreja" value={code} onChangeText={setCode} autoCapitalize="none" placeholder="ex.: igreja-esperanca" />
        <Button title="Entrar na igreja" onPress={join} loading={busy} disabled={code.trim().length < 3} />
      </Card>
      <Pressable onPress={() => supabase.auth.signOut()}><Muted>Sair da conta</Muted></Pressable>
    </Screen>
  );
}
