import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { brToISO, DeleteButton, goBack, isoToBR, Toggle } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Kid = { id?: string; full_name: string; birth_date: string | null; allergies: string | null; medical_notes: string | null; notes: string | null };
type G = { id: string; name: string; phone: string | null; relationship: string | null; can_pickup: boolean };

/** Cadastro da criança (id = "novo") e responsáveis. */
export default function Crianca() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData(async () => {
    if (id === 'novo') return { full_name: '', birth_date: null, allergies: null, medical_notes: null, notes: null } as Kid;
    const { data: k } = await supabase.from('kids_children').select('id, full_name, birth_date, allergies, medical_notes, notes').eq('id', id).maybeSingle();
    return k as Kid | null;
  }, null as Kid | null, `kid:${id}`);
  if (!data) return <Screen><Muted>Carregando…</Muted></Screen>;
  return <Form initial={data} />;
}

function Form({ initial }: { initial: Kid }) {
  const { church, color } = useChurch();
  const editing = !!initial.id;
  const [f, setF] = useState({
    full_name: initial.full_name, birth: isoToBR(initial.birth_date), allergies: initial.allergies ?? '', medical: initial.medical_notes ?? '', notes: initial.notes ?? '',
    gName: '', gPhone: '', gRel: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    if (f.full_name.trim().length < 2) return Alert.alert('Nome', 'Informe o nome da criança.');
    if (f.birth.trim() && !brToISO(f.birth)) return Alert.alert('Nascimento', 'Use dd/mm/aaaa.');
    setBusy(true);
    const row = {
      church_id: church.id, full_name: f.full_name.trim(), birth_date: f.birth.trim() ? brToISO(f.birth) : null,
      allergies: f.allergies.trim() || null, medical_notes: f.medical.trim() || null, notes: f.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from('kids_children').update(row).eq('id', initial.id!);
      setBusy(false);
      if (error) return Alert.alert('Não deu', error.message);
      return goBack('/gestao/kids');
    }
    const { data, error } = await supabase.from('kids_children').insert(row).select('id').single();
    if (!error && f.gName.trim().length >= 2) {
      await supabase.from('kids_guardians').insert({ child_id: data.id, church_id: church.id, name: f.gName.trim(), phone: f.gPhone.trim() || null, relationship: f.gRel.trim() || null });
    }
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    router.replace({ pathname: '/gestao/crianca/[id]', params: { id: data.id } });
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: editing ? initial.full_name.split(' ')[0] : 'Nova criança' }} />
      <Card>
        <Input label="Nome completo" value={f.full_name} onChangeText={set('full_name')} />
        <Input label="Nascimento" value={f.birth} onChangeText={set('birth')} placeholder="dd/mm/aaaa" />
        <Input label="Alergias" value={f.allergies} onChangeText={set('allergies')} placeholder="ex.: amendoim, lactose" />
        <Input label="Cuidados de saúde" value={f.medical} onChangeText={set('medical')} multiline />
        <Input label="Observações" value={f.notes} onChangeText={set('notes')} multiline />
      </Card>
      {!editing && (
        <Section title="Responsável">
          <Card>
            <Input label="Nome" value={f.gName} onChangeText={set('gName')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 3 }}><Input label="Telefone" value={f.gPhone} onChangeText={set('gPhone')} keyboardType="phone-pad" /></View>
              <View style={{ flex: 2 }}><Input label="Parentesco" value={f.gRel} onChangeText={set('gRel')} placeholder="Mãe" /></View>
            </View>
          </Card>
        </Section>
      )}
      <Button title={editing ? 'Salvar' : 'Cadastrar criança'} color={color} loading={busy} onPress={save} />
      {editing && <Guardians childId={initial.id!} churchId={church.id} color={color} />}
      {editing && <DeleteButton what="cadastro da criança" fallback="/gestao/kids" onDelete={async () => supabase.from('kids_children').delete().eq('id', initial.id!)} />}
    </Screen>
  );
}

function Guardians({ childId, churchId, color }: { childId: string; churchId: string; color: string }) {
  const [g, setG] = useState({ name: '', phone: '', rel: '' });
  const [pickup, setPickup] = useState(true);
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('kids_guardians').select('id, name, phone, relationship, can_pickup').eq('child_id', childId).order('name');
    return (rows ?? []) as G[];
  }, [] as G[], `kidg:${childId}`);
  async function add() {
    const { error } = await supabase.from('kids_guardians').insert({ child_id: childId, church_id: churchId, name: g.name.trim(), phone: g.phone.trim() || null, relationship: g.rel.trim() || null, can_pickup: pickup });
    if (error) return Alert.alert('Não deu', error.message);
    setG({ name: '', phone: '', rel: '' }); setPickup(true); reload();
  }
  function remove(x: G) {
    Alert.alert('Tirar responsável?', x.name, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Tirar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('kids_guardians').delete().eq('id', x.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }
  return (
    <Section title="Responsáveis">
      <Card>
        {data.length === 0 && <Muted>Nenhum responsável cadastrado.</Muted>}
        {data.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{x.name}{x.relationship ? ` · ${x.relationship}` : ''}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 12, color: x.can_pickup ? C.muted : C.danger }}>{[x.phone, x.can_pickup ? 'pode buscar' : 'NÃO pode buscar'].filter(Boolean).join(' · ')}</Text>
            </View>
            <Pressable onPress={() => remove(x)} hitSlop={8} accessibilityLabel={`Tirar ${x.name}`}><Trash2 size={16} color={C.danger} /></Pressable>
          </View>
        ))}
      </Card>
      <Card>
        <Input label="Nome" value={g.name} onChangeText={(v) => setG((o) => ({ ...o, name: v }))} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 3 }}><Input label="Telefone" value={g.phone} onChangeText={(v) => setG((o) => ({ ...o, phone: v }))} keyboardType="phone-pad" /></View>
          <View style={{ flex: 2 }}><Input label="Parentesco" value={g.rel} onChangeText={(v) => setG((o) => ({ ...o, rel: v }))} /></View>
        </View>
        <Toggle label="Pode buscar a criança" value={pickup} onChange={setPickup} color={color} />
        <Button title="Adicionar responsável" variant="outline" color={color} disabled={g.name.trim().length < 2} onPress={add} />
      </Card>
    </Section>
  );
}
