import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { Copy, KeyRound, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { List, Row } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Dev = { id: string; name: string; inverter_brand: string | null; inverter_model: string | null; rated_power_kw: number | null; last_seen_at: string | null };

/** Cadastrar o aparelho que lê o inversor. O token aparece uma única vez, para gravar no firmware. */
export default function GestaoSolar() {
  const { church, color } = useChurch();
  const [f, setF] = useState({ name: '', brand: '', model: '', kw: '' });
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<{ name: string; token: string } | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('solar_devices').select('id, name, inverter_brand, inverter_model, rated_power_kw, last_seen_at').eq('church_id', church.id).order('name');
    return (rows ?? []) as Dev[];
  }, [] as Dev[], `gsol:${church.id}`);

  async function create() {
    setBusy(true);
    const kw = f.kw.trim() ? Number(f.kw.replace(',', '.')) : null;
    const { data: res, error } = await supabase.rpc('create_solar_device', {
      p_church: church.id, p_name: f.name.trim(), p_brand: f.brand.trim() || null, p_model: f.model.trim() || null, p_kw: kw,
    });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    const row = (Array.isArray(res) ? res[0] : res) as { device_token: string };
    setToken({ name: f.name.trim(), token: row.device_token });
    setF({ name: '', brand: '', model: '', kw: '' }); reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Aparelhos de energia' }} />
      {token && (
        <View style={{ backgroundColor: C.dark, borderRadius: 20, padding: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} color="#fff" />
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: '#fff' }}>Token do {token.name}</Text>
          </View>
          <Text selectable style={{ fontFamily: F.medium, fontSize: 13, color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>{token.token}</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Grave este token no aparelho. Ele não será mostrado de novo.</Text>
          <Pressable onPress={async () => { await Clipboard.setStringAsync(token.token); Alert.alert('Copiado'); }} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, backgroundColor: '#fff' }}>
            <Copy size={18} color={C.dark} /><Text style={{ fontFamily: F.bold, color: C.dark }}>Copiar token</Text>
          </Pressable>
          <Pressable onPress={() => setToken(null)} accessibilityRole="button" style={{ alignItems: 'center', padding: 4 }}>
            <Text style={{ fontFamily: F.semibold, color: 'rgba(255,255,255,0.8)' }}>Já gravei</Text>
          </Pressable>
        </View>
      )}

      <Section title="Aparelhos">
        <List>
          {data.length === 0 && <Row first title="Nenhum aparelho cadastrado." />}
          {data.map((d, i) => (
            <Row key={d.id} first={i === 0} left={<Sun size={18} color={color} />} title={d.name}
              sub={[[d.inverter_brand, d.inverter_model].filter(Boolean).join(' '), d.rated_power_kw && `${d.rated_power_kw} kW`, d.last_seen_at ? 'comunicando' : 'nunca comunicou'].filter(Boolean).join(' · ')} />
          ))}
        </List>
      </Section>

      <Section title="Cadastrar aparelho">
        <Card>
          <Input label="Nome" value={f.name} onChangeText={set('name')} placeholder="Inversor do templo" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Marca do inversor" value={f.brand} onChangeText={set('brand')} placeholder="Growatt" /></View>
            <View style={{ flex: 1 }}><Input label="Modelo" value={f.model} onChangeText={set('model')} /></View>
          </View>
          <Input label="Potência (kW)" value={f.kw} onChangeText={set('kw')} keyboardType="decimal-pad" placeholder="10" />
          <Muted>Ao cadastrar, o app gera o token que o aparelho usa para enviar as leituras.</Muted>
          <Button title="Cadastrar e gerar token" color={color} loading={busy} disabled={f.name.trim().length < 2} onPress={create} />
        </Card>
      </Section>
    </Screen>
  );
}
