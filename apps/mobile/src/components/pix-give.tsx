import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { CircleCheck, Copy } from 'lucide-react-native';
import QRCode from 'qrcode';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Button, C, Card, Chips, F, Muted } from '@/components/ui';
import { newTxid, pixPayload } from '@/lib/pix';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const PRESETS = ['50', '100', '200', '500'];
const toCents = (v: string) => {
  const s = v.replace(/[^\d,.]/g, '');
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Contribuição pelo Pix da igreja: gera o Pix com valor; o membro paga no banco e avisa. */
export function PixGive({ funds }: { funds: { id: string; name: string }[] }) {
  const { church, color } = useChurch();
  const [fund, setFund] = useState(funds[0]?.id ?? '');
  const [amount, setAmount] = useState('100');
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [code, setCode] = useState<{ payload: string; svg: string; txid: string; cents: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: pix } = useData(async () => {
    const { data } = await supabase.rpc('church_pix', { p_church: church.id });
    return ((data ?? []) as { pix_key: string | null; name: string; city: string | null }[])[0] ?? null;
  }, null, `pix:${church.id}`);
  const fundId = fund || funds[0]?.id || '';
  const fundName = funds.find((f) => f.id === fundId)?.name ?? 'Oferta';

  async function generate() {
    const cents = toCents(amount);
    if (cents < 100) return Alert.alert('Valor', 'Digite o valor, ex.: 100');
    if (!pix?.pix_key) return;
    const txid = newTxid();
    const payload = pixPayload({ key: pix.pix_key, name: pix.name, city: pix.city ?? 'BRASIL', cents, txid });
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    setCode({ payload, svg, txid, cents });
    setStep('pay');
  }

  async function declare() {
    if (!code) return;
    setBusy(true);
    const { error } = await supabase.rpc('pix_declare', { p_church: church.id, p_fund: fundId || null, p_amount_cents: code.cents, p_txid: code.txid });
    setBusy(false);
    if (error) return Alert.alert('Não deu para registrar', error.message);
    setStep('done');
  }

  const copy = async () => { if (code) { await Clipboard.setStringAsync(code.payload); Alert.alert('Pix copiado!', 'Abra o app do seu banco → Pix → Pix copia e cola.'); } };
  const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (step === 'done' && code) {
    return (
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 26 }}>
        <CircleCheck size={44} color={C.ok} />
        <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: C.text }}>Obrigado!</Text>
        <Muted>{`${fundName} de ${brl(code.cents)} registrado. A tesouraria confere no extrato e confirma.`}</Muted>
        <Button title="Ver minhas contribuições" color={color} onPress={() => router.push('/contribuicoes')} />
        <Button title="Nova contribuição" variant="outline" color={color} onPress={() => { setStep('form'); setCode(null); }} />
      </Card>
    );
  }

  if (step === 'pay' && code) {
    return (
      <>
        <Card style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.muted }}>{fundName} · {pix?.name}</Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 32, color: C.text }}>{brl(code.cents)}</Text>
          <SvgXml xml={code.svg} width={230} height={230} />
          <Muted>Leia o QR Code no app do banco, ou copie o código e use “Pix copia e cola”.</Muted>
        </Card>
        <Pressable onPress={copy} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 12, color: C.body }} numberOfLines={2}>{code.payload}</Text>
          <Copy size={20} color={color} />
        </Pressable>
        <Button title="Copiar Pix copia e cola" variant="outline" color={color} onPress={copy} />
        <Button title="Já fiz o Pix" color={color} loading={busy} onPress={declare} />
        <Pressable onPress={() => setStep('form')} style={{ padding: 8 }}><Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.muted, textAlign: 'center' }}>Mudar valor</Text></Pressable>
      </>
    );
  }

  return (
    <>
      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Valor</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 26, color: C.muted }}>R$</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Valor"
            style={{ flex: 1, fontFamily: F.extrabold, fontSize: 38, color: C.text, paddingVertical: 2 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESETS.map((v) => (
            <Pressable key={v} onPress={() => setAmount(v)} accessibilityRole="button"
              style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: amount === v ? color : C.bg, borderWidth: 1, borderColor: amount === v ? color : C.border }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: amount === v ? '#fff' : C.text }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      {funds.length > 0 && (
        <Card>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Para</Text>
          <Chips color={color} value={fundId} onChange={setFund} options={funds.map((f) => ({ value: f.id, label: f.name }))} />
        </Card>
      )}
      <Button title="Gerar Pix" color={color} onPress={generate} disabled={!pix?.pix_key} />
      <Pressable onPress={() => router.push('/contribuicoes')} style={{ padding: 8 }} accessibilityRole="link">
        <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text, textAlign: 'center' }}>Minhas contribuições</Text>
      </Pressable>
    </>
  );
}
