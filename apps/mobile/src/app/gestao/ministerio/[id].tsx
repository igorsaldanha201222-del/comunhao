import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { goBack } from '@/components/admin';
import { Button, C, Card, Chips, F, Input, Screen } from '@/components/ui';
import { MINISTRY_COLORS, MINISTRY_KINDS, type MinistryKind } from '@/lib/ministries';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Criar (id = "novo") ou editar um ministério. */
export default function EditarMinisterio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'novo';
  const { church, color } = useChurch();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MinistryKind>('outro');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState(MINISTRY_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    supabase.from('ministries').select('name, kind, description, color').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) { setName(data.name); setKind(data.kind as MinistryKind); setDescription(data.description ?? ''); setTone(data.color); }
    });
  }, [id, isNew]);

  async function save() {
    setBusy(true);
    const row = { name: name.trim(), description: description.trim() || null, color: tone };
    const res = isNew
      ? await supabase.from('ministries').insert({ ...row, church_id: church.id, kind }).select('id').single()
      : await supabase.from('ministries').update(row).eq('id', id).select('id').single();
    setBusy(false);
    if (res.error) return Alert.alert('Não deu', res.error.message);
    if (isNew) router.replace({ pathname: '/ministerios/[id]', params: { id: res.data.id } });
    else goBack('/ministerios');
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: isNew ? 'Novo ministério' : 'Editar ministério' }} />
      <Card>
        <Input label="Nome" value={name} onChangeText={setName} placeholder="ex.: Louvor, Diaconato, Jovens" />
        {isNew && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Tipo</Text>
            <Chips color={color} value={kind} onChange={setKind} options={(Object.keys(MINISTRY_KINDS) as MinistryKind[]).map((k) => ({ value: k, label: MINISTRY_KINDS[k] }))} />
          </View>
        )}
        <Input label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline />
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Cor</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MINISTRY_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setTone(c)} accessibilityRole="button" accessibilityLabel={`Cor ${c}`} accessibilityState={{ selected: tone === c }}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
                {tone === c && <Check size={20} color="#fff" strokeWidth={3} />}
              </Pressable>
            ))}
          </View>
        </View>
        <Button title={isNew ? 'Criar ministério' : 'Salvar'} color={color} loading={busy} disabled={name.trim().length < 2} onPress={save} />
      </Card>
    </Screen>
  );
}
