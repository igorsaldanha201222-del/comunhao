import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { HeartHandshake, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { PixGive } from '@/components/pix-give';
import { Button, C, Card, Chips, F, Input, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { fnError, supabase } from '@/lib/supabase';

type Method = 'pix' | 'cartao' | 'boleto';
const PRESETS = ['50', '100', '200', '500'];

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
  // Pagamento online só funciona com a conta de recebimento configurada; sem ela, mostra a chave Pix da igreja.
  const [cfg, setCfg] = useState<{ online: boolean; pixKey: string | null } | null>(null);

  useEffect(() => {
    supabase.from('churches').select('pix_key, payment_wallet_id').eq('id', church.id).maybeSingle()
      .then(({ data }) => setCfg({ online: !!data?.payment_wallet_id, pixKey: data?.pix_key ?? null }));
  }, [church.id]);

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

  const hero = (
    <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 22, gap: 8 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <HeartHandshake size={22} color="#fff" />
      </View>
      <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: '#fff' }}>Dízimos e ofertas</Text>
      <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)' }}>
        “Cada um dê conforme determinou em seu coração, não com pesar nem por obrigação, pois Deus ama quem dá com alegria.” 2Co 9:7
      </Text>
    </View>
  );

  if (cfg && !cfg.online) {
    return (
      <Screen title="Contribuir" color={color}>
        {hero}
        {cfg.pixKey ? (
          <PixGive funds={funds} />
        ) : (
          <Card>
            <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>Contribuições pelo app em breve</Text>
            <Muted>A igreja ainda não cadastrou a forma de receber pelo app. Enquanto isso, fale com a tesouraria para contribuir.</Muted>
          </Card>
        )}
      </Screen>
    );
  }

  if (pix) {
    return (
      <Screen title="Pague com Pix" color={color}>
        <Card style={{ alignItems: 'center', gap: 14 }}>
          <Image source={{ uri: `data:image/png;base64,${pix.qr}` }} style={{ width: 230, height: 230 }} accessibilityLabel="QR Code Pix" />
          <Muted>Abra o app do seu banco, escolha Pix e leia o QR Code ou use o copia e cola.</Muted>
        </Card>
        <Button title="Copiar código Pix" color={color} onPress={async () => { await Clipboard.setStringAsync(pix.payload); Alert.alert('Copiado!'); }} />
        <Button title="Nova contribuição" variant="outline" color={color} onPress={() => setPix(null)} />
      </Screen>
    );
  }

  return (
    <Screen title="Contribuir" color={color}>
      {hero}
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
      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Para</Text>
        <Chips color={color} value={fund} onChange={setFund} options={funds.map((f) => ({ value: f.id, label: f.name }))} />
      </Card>
      <Card>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Forma de pagamento</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderRadius: 14, padding: 4 }}>
          {([['pix', 'Pix'], ['cartao', 'Cartão'], ['boleto', 'Boleto']] as const).map(([v, l]) => (
            <Pressable key={v} onPress={() => setMethod(v)} accessibilityRole="button" accessibilityState={{ selected: method === v }}
              style={{ flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: method === v ? '#fff' : 'transparent' }}>
              <Text style={{ fontFamily: method === v ? F.bold : F.medium, fontSize: 14, color: method === v ? C.text : C.muted }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Nome completo" value={name} onChangeText={setName} />
        <Input label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" />
      </Card>
      <Button title="Contribuir" color={color} onPress={give} loading={busy} disabled={!fund || !name.trim() || cpf.replace(/\D/g, '').length !== 11} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <ShieldCheck size={14} color={C.muted} />
        <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>Pagamento seguro. Cartão e boleto abrem a página do processador.</Text>
      </View>
    </Screen>
  );
}
