import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Chips, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const RELATIONS = ['Mãe', 'Pai', 'Avó', 'Avô', 'Responsável'];

/** "10/05/2019" -> "2019-05-10" (ou null se inválida). */
function parseBR(v: string) {
  const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export default function NovoFilho() {
  const { church, color } = useChurch();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [relation, setRelation] = useState('Mãe');
  const [busy, setBusy] = useState(false);

  async function save() {
    const iso = parseBR(birth);
    if (!iso) return Alert.alert('Data de nascimento', 'Use o formato dd/mm/aaaa, ex.: 10/05/2019.');
    setBusy(true);
    const { error } = await supabase.rpc('kids_register_child', {
      p_church: church.id, p_name: name.trim(), p_birth: iso, p_allergies: allergies, p_notes: notes, p_relationship: relation,
    });
    setBusy(false);
    if (error) return Alert.alert('Ops', error.message);
    router.back();
  }

  return (
    <Screen title="Cadastrar filho" subtitle="Essas informações ficam com a equipe do Kids" color={color}>
      <Card>
        <Input label="Nome da criança" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Data de nascimento (dd/mm/aaaa)" value={birth} onChangeText={setBirth} keyboardType="numbers-and-punctuation" placeholder="10/05/2019" maxLength={10} />
        <Input label="Alergias ou restrições alimentares" value={allergies} onChangeText={setAllergies} placeholder="ex.: amendoim, lactose" />
        <Input label="Algo que a equipe precise saber?" value={notes} onChangeText={setNotes} multiline />
        <Muted>Você é</Muted>
        <Chips color={color} value={relation} onChange={setRelation} options={RELATIONS.map((r) => ({ value: r, label: r }))} />
      </Card>
      <Button title="Cadastrar" color={color} onPress={save} loading={busy} disabled={name.trim().length < 2 || birth.length < 10} />
    </Screen>
  );
}
