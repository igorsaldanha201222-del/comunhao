import { Stack } from 'expo-router';
import { Check, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { ImageField, pickImage, uploadMedia, type Picked } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen, Section } from '@/components/ui';
import { MINISTRY_COLORS } from '@/lib/ministries';
import { useChurch, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const FIELDS = [
  ['name', 'Nome da igreja'], ['tagline', 'Frase de apresentação'], ['service_times', 'Horários dos cultos'],
  ['address', 'Endereço'], ['city', 'Cidade'], ['state', 'Estado (UF)'], ['phone', 'Telefone / WhatsApp'],
  ['email', 'E-mail'], ['instagram', 'Instagram'], ['youtube_channel', 'Canal do YouTube'], ['about', 'Sobre a igreja'],
] as const;
type Key = (typeof FIELDS)[number][0] | 'pix_key' | 'primary_color';
type Row = Record<Key, string | null> & { logo_url: string | null };

/** Dados da igreja (site e app), Pix, fundos de oferta e liderança do site. Só administradores. */
export default function GestaoIgreja() {
  const { church, color } = useChurch();
  const { selectChurch } = useSession();
  const [edit, setEdit] = useState<Partial<Record<Key, string>>>({});
  const [logo, setLogo] = useState<Picked>(null);
  const [busy, setBusy] = useState(false);
  const [fund, setFund] = useState('');
  const { data, reload } = useData(async () => {
    const [c, f] = await Promise.all([
      supabase.from('churches').select(`logo_url, pix_key, primary_color, ${FIELDS.map((x) => x[0]).join(', ')}`).eq('id', church.id).maybeSingle(),
      supabase.from('donation_funds').select('id, name, active').eq('church_id', church.id).order('position'),
    ]);
    return { c: c.data as unknown as Row | null, funds: (f.data ?? []) as { id: string; name: string; active: boolean }[] };
  }, { c: null as Row | null, funds: [] as { id: string; name: string; active: boolean }[] }, `gigr:${church.id}`);
  const c = data.c;
  if (!c) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;
  const v = (k: Key) => edit[k] ?? c[k] ?? '';
  const set = (k: Key) => (x: string) => setEdit((o) => ({ ...o, [k]: x }));
  const tone = v('primary_color') || color;

  async function save() {
    if (v('name').trim().length < 2) return Alert.alert('Nome', 'Preencha o nome da igreja.');
    setBusy(true);
    try {
      const row: Record<string, unknown> = Object.fromEntries(Object.entries(edit).map(([k, x]) => [k, (x ?? '').trim() || null]));
      if (logo) row.logo_url = await uploadMedia(church.id, 'marca', logo.uri, logo.mime);
      const { error } = await supabase.from('churches').update(row).eq('id', church.id);
      if (error) throw error;
      selectChurch({ ...church, name: v('name').trim(), primary_color: tone, logo_url: (row.logo_url as string) ?? c!.logo_url });
      setEdit({}); setLogo(null); reload();
      Alert.alert('Salvo', 'Os dados da igreja foram atualizados no app e no site.');
    } catch (e) {
      Alert.alert('Não deu', (e as Error).message);
    } finally { setBusy(false); }
  }
  async function addFund() {
    const { error } = await supabase.from('donation_funds').insert({ church_id: church.id, name: fund.trim(), position: 99 });
    if (error) return Alert.alert('Não deu', error.message);
    setFund(''); reload();
  }
  async function toggleFund(f: { id: string; active: boolean }) {
    const { error } = await supabase.from('donation_funds').update({ active: !f.active }).eq('id', f.id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Dados da igreja' }} />
      <Card>
        <ImageField label="Logo" aspect={1} url={logo?.uri ?? c.logo_url} onPick={async () => { const p = await pickImage([1, 1]); if (p) setLogo(p); }} />
        {FIELDS.map(([k, label]) => (
          <Input key={k} label={label} value={v(k)} onChangeText={set(k)} multiline={k === 'about' || k === 'service_times'}
            autoCapitalize={k === 'email' || k === 'instagram' || k === 'youtube_channel' ? 'none' : undefined} />
        ))}
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Cor da igreja</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {MINISTRY_COLORS.map((x) => (
            <Pressable key={x} onPress={() => set('primary_color')(x)} accessibilityRole="button" accessibilityLabel={`Cor ${x}`} accessibilityState={{ selected: tone === x }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: x, alignItems: 'center', justifyContent: 'center' }}>
              {tone === x && <Check size={20} color="#fff" strokeWidth={3} />}
            </Pressable>
          ))}
        </View>
      </Card>

      <Section title="Pix da igreja">
        <Card>
          <Input label="Chave Pix" value={v('pix_key')} onChangeText={set('pix_key')} autoCapitalize="none" placeholder="CNPJ, e-mail, celular ou aleatória" />
          <Muted>Com a chave preenchida, o membro contribui pelo app com QR Code e copia e cola. O dinheiro cai direto na conta da igreja.</Muted>
        </Card>
      </Section>

      <Button title="Salvar dados da igreja" color={color} loading={busy} onPress={save} />

      <Section title="Fundos de oferta">
        <Card>
          {data.funds.map((f) => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: f.active ? C.text : C.muted }}>{f.name}{f.active ? '' : ' (oculto)'}</Text>
              <Pressable onPress={() => toggleFund(f)} hitSlop={8} accessibilityRole="button">
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: f.active ? C.muted : color }}>{f.active ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={fund} onChangeText={setFund} placeholder="Novo fundo (ex.: Missões)" placeholderTextColor="#8a948e"
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15, color: C.text }} />
            <Pressable onPress={addFund} disabled={fund.trim().length < 2} accessibilityRole="button"
              style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: fund.trim().length < 2 ? 0.4 : 1 }}>
              <Text style={{ fontFamily: F.bold, color: '#fff' }}>Criar</Text>
            </Pressable>
          </View>
        </Card>
      </Section>

      <Leaders churchId={church.id} color={color} />
    </Screen>
  );
}

function Leaders({ churchId, color }: { churchId: string; color: string }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<Picked>(null);
  const [busy, setBusy] = useState(false);
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('church_leaders').select('id, name, title').eq('church_id', churchId).order('position');
    return rows ?? [];
  }, [] as { id: string; name: string; title: string | null }[], `glead:${churchId}`);
  async function add() {
    setBusy(true);
    try {
      const photo_url = photo ? await uploadMedia(churchId, 'lideranca', photo.uri, photo.mime) : null;
      const { error } = await supabase.from('church_leaders').insert({ church_id: churchId, name: name.trim(), title: title.trim() || null, photo_url, position: data.length });
      if (error) throw error;
      setName(''); setTitle(''); setPhoto(null); reload();
    } catch (e) { Alert.alert('Não deu', (e as Error).message); } finally { setBusy(false); }
  }
  function remove(l: { id: string; name: string }) {
    Alert.alert('Tirar do site?', l.name, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Tirar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('church_leaders').delete().eq('id', l.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }
  return (
    <Section title="Liderança (aparece no site)">
      <Card>
        {data.map((l) => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{l.name}</Text>
              {l.title ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{l.title}</Text> : null}
            </View>
            <Pressable onPress={() => remove(l)} hitSlop={8} accessibilityLabel={`Tirar ${l.name}`}><Trash2 size={16} color={C.danger} /></Pressable>
          </View>
        ))}
        <Input label="Nome" value={name} onChangeText={setName} />
        <Input label="Cargo" value={title} onChangeText={setTitle} placeholder="Pastor presidente" />
        <ImageField label="Foto (opcional)" aspect={1} url={photo?.uri ?? null} onPick={async () => { const p = await pickImage([1, 1]); if (p) setPhoto(p); }} onClear={photo ? () => setPhoto(null) : undefined} />
        <Button title="Adicionar líder" variant="outline" color={color} loading={busy} disabled={name.trim().length < 2} onPress={add} />
      </Card>
    </Section>
  );
}
