import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button, C, Card, Chips, H2, Input, Muted, fmtBRL, fmtDateTime, s } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { fnError, supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Ev = { id: string; title: string; description: string | null; starts_at: string; location: string | null; price_cents: number; cover_url: string | null };
type Reg = { id: string; status: string; ticket_code: string; checked_in_at: string | null };

export default function Evento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, user, color } = useChurch();
  const [justRegistered, setReg] = useState<Reg | null>(null);
  const [name, setName] = useState((user.user_metadata?.full_name as string) ?? '');
  const [cpf, setCpf] = useState('');
  const [method, setMethod] = useState<'pix' | 'cartao' | 'boleto'>('pix');
  const [pix, setPix] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, reload: load } = useData(async () => {
    const [e, r] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('registrations').select('id, status, ticket_code, checked_in_at').eq('event_id', id).eq('user_id', user.id)
        .neq('status', 'cancelada').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { ev: e.data as Ev | null, reg: r.data as Reg | null };
  }, { ev: null, reg: null }, `${id}:${user.id}`);
  const ev = data.ev;
  // A inscrição recém-criada vale até a próxima recarga trazer a do servidor.
  const reg = data.reg ?? justRegistered;

  async function register() {
    setBusy(true);
    const { data, error } = await supabase.rpc('register_for_event', { p_event: id, p_name: name.trim(), p_email: user.email, p_phone: null });
    setBusy(false);
    if (error) return Alert.alert('Não foi possível', error.message);
    setReg(data as Reg);
  }

  async function pay() {
    if (!reg) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: { church_id: church.id, kind: 'inscricao', registration_id: reg.id, method, name: name.trim(), cpf },
    });
    setBusy(false);
    if (error || data?.error) return Alert.alert('Pagamento', await fnError(error, data));
    if (method === 'pix' && data.pix_payload) setPix(data.pix_payload);
    else await WebBrowser.openBrowserAsync(data.invoice_url);
  }

  if (!ev) return null;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      {ev.cover_url && <Image source={ev.cover_url} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} />}
      <Text style={s.title}>{ev.title}</Text>
      <Muted>{fmtDateTime(ev.starts_at)}{ev.location ? ` · ${ev.location}` : ''}</Muted>
      <Muted>{ev.price_cents ? fmtBRL(ev.price_cents) : 'Gratuito'}</Muted>
      {ev.description && <Text style={{ fontSize: 16, lineHeight: 22 }}>{ev.description}</Text>}

      {reg?.status === 'confirmada' && (
        <Card style={{ alignItems: 'center' }}>
          <H2>✓ Inscrição confirmada</H2>
          <Muted>Mostre este código na entrada:</Muted>
          <Text selectable style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 2, color, marginVertical: 8 }}>{reg.ticket_code}</Text>
          {reg.checked_in_at && <Muted>Check-in feito {fmtDateTime(reg.checked_in_at)}</Muted>}
        </Card>
      )}

      {!reg && (
        <Card>
          <H2>Inscrição</H2>
          <Input label="Nome do participante" value={name} onChangeText={setName} />
          <Button title={ev.price_cents ? 'Reservar vaga' : 'Confirmar inscrição'} color={color} onPress={register} loading={busy} disabled={!name.trim()} />
        </Card>
      )}

      {reg?.status === 'pendente' && (
        <Card>
          <H2>Pagamento da inscrição · {fmtBRL(ev.price_cents)}</H2>
          {pix ? (
            <View style={{ gap: 8 }}>
              <Muted>Copie o código Pix e pague no app do seu banco. A confirmação chega sozinha.</Muted>
              <Button title="Copiar código Pix" color={color} onPress={async () => { await Clipboard.setStringAsync(pix); Alert.alert('Copiado!'); }} />
              <Button title="Já paguei, atualizar" variant="outline" color={color} onPress={load} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Chips color={color} value={method} onChange={setMethod}
                options={[{ value: 'pix', label: 'Pix' }, { value: 'cartao', label: 'Cartão' }, { value: 'boleto', label: 'Boleto' }]} />
              <Input label="CPF do pagador" value={cpf} onChangeText={setCpf} keyboardType="number-pad" />
              <Button title="Pagar" color={color} onPress={pay} loading={busy} disabled={cpf.replace(/\D/g, '').length !== 11} />
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}
