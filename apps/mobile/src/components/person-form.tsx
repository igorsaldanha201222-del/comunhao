import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Chips, Input } from '@/components/ui';
import { fromISODate, STATUS, toISODate, type PersonStatus } from '@/lib/people';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type PersonRow = {
  id?: string; full_name: string; phone: string | null; email: string | null; status: PersonStatus;
  birth_date: string | null; baptized_at: string | null; marital_status: string | null; address: string | null; notes: string | null;
};

/** Formulário de cadastro/edição de pessoa (equipe). */
export function PersonForm({ person, onSaved }: { person?: PersonRow; onSaved: (id: string) => void }) {
  const { church, color } = useChurch();
  const [f, setF] = useState({
    full_name: person?.full_name ?? '', phone: person?.phone ?? '', email: person?.email ?? '',
    status: (person?.status ?? 'visitante') as PersonStatus, birth: fromISODate(person?.birth_date ?? null),
    baptized: fromISODate(person?.baptized_at ?? null), marital_status: person?.marital_status ?? '',
    address: person?.address ?? '', notes: person?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    if ((f.birth && !toISODate(f.birth)) || (f.baptized && !toISODate(f.baptized))) return Alert.alert('Data', 'Use o formato dia/mês/ano, ex.: 25/12/1990');
    setBusy(true);
    const row = {
      church_id: church.id, full_name: f.full_name.trim(), phone: f.phone.trim() || null, email: f.email.trim().toLowerCase() || null,
      status: f.status, birth_date: toISODate(f.birth), baptized_at: toISODate(f.baptized),
      marital_status: f.marital_status.trim() || null, address: f.address.trim() || null, notes: f.notes.trim() || null,
    };
    const res = person?.id
      ? await supabase.from('people').update(row).eq('id', person.id).select('id').single()
      : await supabase.from('people').insert(row).select('id').single();
    setBusy(false);
    if (res.error) return Alert.alert('Não deu para salvar', res.error.message);
    onSaved(res.data.id);
  }

  return (
    <View style={{ gap: 12 }}>
      <Input label="Nome completo" value={f.full_name} onChangeText={set('full_name')} autoComplete="name" />
      <Chips color={color} value={f.status} onChange={set('status')}
        options={(Object.keys(STATUS) as PersonStatus[]).map((k) => ({ value: k, label: STATUS[k].label }))} />
      <Input label="WhatsApp / telefone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Nascimento" value={f.birth} onChangeText={set('birth')} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" /></View>
        <View style={{ flex: 1 }}><Input label="Batismo" value={f.baptized} onChangeText={set('baptized')} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" /></View>
      </View>
      <Input label="Estado civil" value={f.marital_status} onChangeText={set('marital_status')} />
      <Input label="Endereço" value={f.address} onChangeText={set('address')} />
      <Input label="Observações (só a equipe vê)" value={f.notes} onChangeText={set('notes')} multiline />
      <Button title={person?.id ? 'Salvar alterações' : 'Cadastrar pessoa'} color={color} loading={busy} disabled={f.full_name.trim().length < 2} onPress={save} />
    </View>
  );
}
