import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chips, H2, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { fnError, supabase } from '@/lib/supabase';

type Method = 'pix' | 'cartao' | 'boleto';

export default function Contribuir() {
  const { church, user, color } = useChurch();
  const [funds, setFunds] = useState<{ id: string; name: string }[]>([]);
  const [fund, setFund] = useState('');
  const [amount, setAmount] = useState('100');
  const [method, setMethod] = useState<Method>('pix');
  const [name, setName] = useState((user.user_metadata?.full_name as string) ?? '');
  const [cpf, setCpf] = useState('');
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<{ payload: string; qr: string } | null>(null);

  useEffect(() => {
    supabase.from('donation_funds').select('id, name').eq('church_id', church.id).eq('active', true).order('position')
      .then(({ data }) => { setFunds(data ?? []); setFund(data?.[0]?.id ?? ''); });
  }, [church.id]);

  async function give() {
    const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
    if (!cents || cents < 500) return Alert.alert('Valor mínimo', 'O valor mínimo é R$ 5,00.');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: { church_id: church.id, kind: 'doacao', fund_id: fund, amount_cents: cents, method, name: name.trim(), cpf },
    });
    setBusy(false);
    if (error || data?.error) return Alert.alert('Contribuição', await fnError(error, data));
    if (method === 'pix') setPix({ payload: data.pix_payload, qr: data.pix_qr_base64 });
    else await WebBrowser.openBrowserAsync(data.invoice_url);
  }

  if (pix) {
    return (
      <Screen title="Pague com Pix" color={color}>
        <Card style={{ alignItems: 'center' }}>
          <Image source={{ uri: `data:image/png;base64,${pix.qr}` }} style={{ width: 220, height: 220 }} accessibilityLabel="QR Code Pix" />
          <Muted>Abra o app do seu banco, escolha Pix e leia o QR Code ou use o copia e cola.</Muted>
        </Card>
        <Button title="Copiar código Pix" color={color} onPress={async () => { await Clipboard.setStringAsync(pix.payload); Alert.alert('Copiado!'); }} />
        <Button title="Nova contribuição" variant="outline" color={color} onPress={() => setPix(null)} />
      </Screen>
    );
  }

  return (
    <Screen title="Contribuir" subtitle="Dízimos e ofertas com segurança" color={color}>
      <Card>
        <H2>Destino</H2>
        <Chips color={color} value={fund} onChange={setFund} options={funds.map((f) => ({ value: f.id, label: f.name }))} />
      </Card>
      <Card>
        <H2>Valor</H2>
        <Chips color={color} value={amount} onChange={setAmount}
          options={['50', '100', '200', '500'].map((v) => ({ value: v, label: `R$ ${v}` }))} />
        <Input label="Outro valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      </Card>
      <Card>
        <H2>Forma de pagamento</H2>
        <Chips color={color} value={method} onChange={setMethod}
          options={[{ value: 'pix', label: 'Pix' }, { value: 'cartao', label: 'Cartão' }, { value: 'boleto', label: 'Boleto' }]} />
        <View style={{ gap: 12, marginTop: 4 }}>
          <Input label="Nome completo" value={name} onChangeText={setName} />
          <Input label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" />
        </View>
      </Card>
      <Button title="Contribuir" color={color} onPress={give} loading={busy} disabled={!fund || !name.trim() || cpf.replace(/\D/g, '').length !== 11} />
      <Muted>No cartão e no boleto, o pagamento é feito na página segura do processador de pagamentos.</Muted>
    </Screen>
  );
}
