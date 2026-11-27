import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { DeleteButton } from '@/components/admin';
import { Button, C, Card, Chips, F, Input, Muted, Screen } from '@/components/ui';
import { type EntryType, loadFinance, todayBR, uploadReceipt } from '@/lib/finance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const METHODS = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' }, { value: 'boleto', label: 'Boleto' },
] as const;

/** "1.234,56" ou "1234.5" → centavos */
const toCents = (v: string) => {
  const s = v.replace(/[^\d,.]/g, '');
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

type Initial = {
  id?: string; type: EntryType; amount: string; description: string; category: string; account: string; method: string;
  paid: 'pago' | 'pendente'; date: string; counterparty: string;
};
const brDate = (iso: string) => iso.split('-').reverse().join('/');

/** Novo lançamento, ou edição quando vem ?id=. */
export default function NovoLancamento() {
  const params = useLocalSearchParams<{ tipo?: string; id?: string }>();
  const { data: row } = useData(async () => {
    if (!params.id) return null;
    const { data: e } = await supabase.from('finance_entries')
      .select('id, type, status, entry_date, due_date, amount_cents, description, category_id, account_id, payment_method, counterparty').eq('id', params.id).maybeSingle();
    return e;
  }, null, `fin-edit:${params.id ?? ''}`);
  if (params.id) {
    if (!row) return <Screen><Muted>Carregando…</Muted></Screen>;
    return (
      <Form initial={{
        id: row.id, type: row.type, amount: (Number(row.amount_cents) / 100).toFixed(2).replace('.', ','), description: row.description,
        category: row.category_id ?? '', account: row.account_id ?? '', method: row.payment_method ?? 'pix', paid: row.status,
        date: brDate(row.status === 'pendente' ? row.due_date ?? row.entry_date : row.entry_date), counterparty: row.counterparty ?? '',
      }} />
    );
  }
  return (
    <Form initial={{
      type: params.tipo === 'saida' ? 'saida' : 'entrada', amount: '', description: '', category: '', account: '', method: 'pix',
      paid: 'pago', date: brDate(todayBR()), counterparty: '',
    }} />
  );
}

function Form({ initial }: { initial: Initial }) {
  const { church, color, user } = useChurch();
  const editing = !!initial.id;
  const [type, setType] = useState<EntryType>(initial.type);
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [account, setAccount] = useState(initial.account);
  const [method, setMethod] = useState<string>(initial.method);
  const [paid, setPaid] = useState<'pago' | 'pendente'>(initial.paid);
  const [date, setDate] = useState(initial.date);
  const [counterparty, setCounterparty] = useState(initial.counterparty);
  const [photo, setPhoto] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useData(() => loadFinance(church.id), null, `fin-form:${church.id}`);
  const cats = (data?.categories ?? []).filter((c) => c.type === type);
  const accounts = data?.accounts ?? [];
  const accountId = account || accounts.find((a) => a.kind !== 'online')?.id || accounts[0]?.id || '';

  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permissão negada', camera ? 'Libere a câmera nas configurações.' : 'Libere as fotos nas configurações.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setPhoto({ uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' });
  }

  async function save() {
    const cents = toCents(amount);
    const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (cents <= 0) return Alert.alert('Valor', 'Digite o valor, ex.: 150,00');
    if (description.trim().length < 2) return Alert.alert('Descrição', 'Diga do que se trata, ex.: Dízimos do culto de domingo');
    if (!m) return Alert.alert('Data', 'Use o formato dia/mês/ano, ex.: 26/11/2026');
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    setBusy(true);
    try {
      const attachment_path = photo ? await uploadReceipt(church.id, photo.uri, photo.mime) : null;
      const row: Record<string, unknown> = {
        type, status: paid, amount_cents: cents, description: description.trim(),
        entry_date: iso, due_date: paid === 'pendente' ? iso : null,
        category_id: category || null, account_id: accountId || null,
        payment_method: paid === 'pago' ? method : null, counterparty: counterparty.trim() || null, updated_by: user.id,
      };
      if (attachment_path) { row.attachment_path = attachment_path; row.document_type = type === 'entrada' ? 'recibo' : 'nota_fiscal'; }
      const { error } = editing
        ? await supabase.from('finance_entries').update(row).eq('id', initial.id!)
        : await supabase.from('finance_entries').insert({ ...row, church_id: church.id, created_by: user.id });
      if (error) throw error;
      Alert.alert(editing ? 'Salvo ✅' : 'Lançado ✅', editing ? 'Lançamento atualizado.' : `${type === 'entrada' ? 'Entrada' : 'Saída'} registrada no financeiro.`);
      if (router.canGoBack()) router.back(); else router.replace('/financeiro');
    } catch (e) {
      Alert.alert('Não deu para salvar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen color={color}>
      {editing && <Stack.Screen options={{ title: 'Editar lançamento' }} />}
      <Chips color={type === 'entrada' ? color : C.danger} value={type} onChange={(v) => { setType(v); setCategory(''); }}
        options={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} />

      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Valor</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.muted }}>R$</Text>
          <Input label="" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00"
            style={{ flex: 1, fontFamily: F.extrabold, fontSize: 30, color: C.text, paddingVertical: 4 }} />
        </View>
        <Input label="Descrição" value={description} onChangeText={setDescription} maxLength={140}
          placeholder={type === 'entrada' ? 'ex.: Dízimos do culto de domingo' : 'ex.: Conta de energia de novembro'} />
        <Input label={type === 'entrada' ? 'De quem (opcional)' : 'Para quem / fornecedor (opcional)'} value={counterparty} onChangeText={setCounterparty} maxLength={120} />
        <Input label={paid === 'pago' ? 'Data' : 'Vencimento'} value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
      </Card>

      {(type === 'saida' || editing) && (
        <Card>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Situação</Text>
          <Chips color={color} value={paid} onChange={setPaid}
            options={type === 'entrada' ? [{ value: 'pago', label: 'Recebido' }, { value: 'pendente', label: 'A conferir' }] : [{ value: 'pago', label: 'Já paguei' }, { value: 'pendente', label: 'A pagar' }]} />
        </Card>
      )}

      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Categoria</Text>
        {cats.length ? (
          <Chips color={color} value={category} onChange={setCategory} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        ) : <Muted>Carregando…</Muted>}
      </Card>

      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Conta</Text>
        <Chips color={color} value={accountId} onChange={setAccount} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        {paid === 'pago' && (
          <>
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body, marginTop: 6 }}>Forma</Text>
            <Chips color={color} value={method} onChange={setMethod} options={METHODS.map((x) => ({ ...x }))} />
          </>
        )}
      </Card>

      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Comprovante (opcional)</Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200, borderRadius: 14 }} contentFit="cover" />
            <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Remover foto"
              style={{ position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PickButton label="Tirar foto" icon="cam" onPress={() => pick(true)} />
            <PickButton label="Da galeria" icon="img" onPress={() => pick(false)} />
          </View>
        )}
      </Card>

      <Button title={editing ? 'Salvar alterações' : type === 'entrada' ? 'Salvar entrada' : 'Salvar saída'} color={type === 'entrada' ? color : C.danger} loading={busy} onPress={save} />
      {editing && <DeleteButton what="lançamento" fallback="/financeiro" onDelete={async () => supabase.from('finance_entries').delete().eq('id', initial.id!)} />}
    </Screen>
  );
}

function PickButton({ label, icon, onPress }: { label: string; icon: 'cam' | 'img'; onPress: () => void }) {
  const Icon = icon === 'cam' ? Camera : ImageIcon;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
      <Icon size={18} color={C.text} strokeWidth={1.8} />
      <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }}>{label}</Text>
    </Pressable>
  );
}
