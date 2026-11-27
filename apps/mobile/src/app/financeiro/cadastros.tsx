import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button, C, Card, Chips, F, Input, Screen, Section, fmtBRL } from '@/components/ui';
import type { EntryType } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Cat = { id: string; name: string; type: EntryType; active: boolean };
type Acc = { id: string; name: string; kind: string; opening_cents: number; active: boolean };
const KINDS = [{ value: 'banco', label: 'Banco' }, { value: 'caixa', label: 'Caixa (dinheiro)' }, { value: 'online', label: 'Online' }];
const toCents = (v: string) => {
  const s = v.replace(/[^\d,.-]/g, '');
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

/** Categorias de entrada/saída e contas (banco, caixa) do financeiro. */
export default function Cadastros() {
  const { church, color } = useChurch();
  const [catType, setCatType] = useState<EntryType>('saida');
  const [catName, setCatName] = useState('');
  const [acc, setAcc] = useState({ name: '', kind: 'banco', opening: '' });
  const { data, reload } = useData(async () => {
    const [c, a] = await Promise.all([
      supabase.from('finance_categories').select('id, name, type, active').eq('church_id', church.id).order('name'),
      supabase.from('finance_accounts').select('id, name, kind, opening_cents, active').eq('church_id', church.id).order('name'),
    ]);
    return { cats: (c.data ?? []) as Cat[], accs: (a.data ?? []) as Acc[] };
  }, { cats: [] as Cat[], accs: [] as Acc[] }, `fincad:${church.id}`);

  async function addCat() {
    const { error } = await supabase.from('finance_categories').insert({ church_id: church.id, type: catType, name: catName.trim() });
    if (error) return Alert.alert('Não deu', error.code === '23505' ? 'Essa categoria já existe.' : error.message);
    setCatName(''); reload();
  }
  async function addAcc() {
    const opening = acc.opening.trim() ? toCents(acc.opening) : 0;
    if (Number.isNaN(opening)) return Alert.alert('Saldo inicial', 'Digite um valor, ex.: 1.500,00');
    const { error } = await supabase.from('finance_accounts').insert({ church_id: church.id, name: acc.name.trim(), kind: acc.kind, opening_cents: opening });
    if (error) return Alert.alert('Não deu', error.code === '23505' ? 'Essa conta já existe.' : error.message);
    setAcc({ name: '', kind: 'banco', opening: '' }); reload();
  }
  async function toggle(table: 'finance_categories' | 'finance_accounts', id: string, active: boolean) {
    const { error } = await supabase.from(table).update({ active: !active }).eq('id', id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }

  const cats = data.cats.filter((c) => c.type === catType);
  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Categorias e contas' }} />
      <Section title="Categorias">
        <Chips color={color} value={catType} onChange={setCatType} options={[{ value: 'entrada', label: 'De entrada' }, { value: 'saida', label: 'De saída' }]} />
        <Card>
          {cats.map((c) => (
            <ItemRow key={c.id} title={c.name} active={c.active} color={color} onToggle={() => toggle('finance_categories', c.id, c.active)} />
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={catName} onChangeText={setCatName} placeholder={catType === 'entrada' ? 'ex.: Cantina' : 'ex.: Internet'} placeholderTextColor="#8a948e"
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15, color: C.text }} />
            <Pressable onPress={addCat} disabled={catName.trim().length < 2} accessibilityRole="button"
              style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: catName.trim().length < 2 ? 0.4 : 1 }}>
              <Text style={{ fontFamily: F.bold, color: '#fff' }}>Criar</Text>
            </Pressable>
          </View>
        </Card>
      </Section>

      <Section title="Contas">
        <Card>
          {data.accs.map((a) => (
            <ItemRow key={a.id} title={a.name} sub={`${KINDS.find((k) => k.value === a.kind)?.label ?? a.kind} · saldo inicial ${fmtBRL(Number(a.opening_cents))}`}
              active={a.active} color={color} onToggle={() => toggle('finance_accounts', a.id, a.active)} />
          ))}
        </Card>
        <Card>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>Nova conta</Text>
          <Input label="Nome" value={acc.name} onChangeText={(v) => setAcc((o) => ({ ...o, name: v }))} placeholder="ex.: Banco do Brasil" />
          <Chips color={color} value={acc.kind} onChange={(v) => setAcc((o) => ({ ...o, kind: v }))} options={KINDS} />
          <Input label="Saldo inicial (R$)" value={acc.opening} onChangeText={(v) => setAcc((o) => ({ ...o, opening: v }))} keyboardType="decimal-pad" placeholder="0,00" />
          <Button title="Criar conta" color={color} disabled={acc.name.trim().length < 2} onPress={addAcc} />
        </Card>
      </Section>
    </Screen>
  );
}

function ItemRow({ title, sub, active, color, onToggle }: { title: string; sub?: string; active: boolean; color: string; onToggle: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 15, color: active ? C.text : C.muted }}>{title}{active ? '' : ' (desativada)'}</Text>
        {sub ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{sub}</Text> : null}
      </View>
      <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: active ? C.muted : color }}>{active ? 'Desativar' : 'Ativar'}</Text>
      </Pressable>
    </View>
  );
}
