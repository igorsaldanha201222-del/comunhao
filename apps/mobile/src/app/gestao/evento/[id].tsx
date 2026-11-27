import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  brDateTimeToISO, DeleteButton, ImageField, isoToBRDateTZ, isoToBRTime, List, pickImage, Row, Toggle, uploadMedia, type Picked,
} from '@/components/admin';
import { Button, C, Card, F, Input, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Reg = { id: string; name: string; phone: string | null; status: string; ticket_code: string; checked_in_at: string | null };
const EMPTY = { title: '', date: '', time: '19:00', end_date: '', end_time: '', location: '', price: '', capacity: '', description: '', cover_url: null as string | null, published: true };
const toCents = (v: string) => { const n = Number(v.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

/** Criar/editar evento + lista de inscritos com check-in na porta. */
export default function EditarEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'novo';
  const { church, color } = useChurch();
  const [f, setF] = useState(EMPTY);
  const [img, setImg] = useState<Picked>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (isNew) return;
    supabase.from('events').select('*').eq('id', id).maybeSingle().then(({ data: e }) => {
      if (e) setF({
        title: e.title, date: isoToBRDateTZ(e.starts_at), time: isoToBRTime(e.starts_at), end_date: isoToBRDateTZ(e.ends_at), end_time: isoToBRTime(e.ends_at),
        location: e.location ?? '', price: e.price_cents ? (e.price_cents / 100).toFixed(2).replace('.', ',') : '', capacity: e.capacity ? String(e.capacity) : '',
        description: e.description ?? '', cover_url: e.cover_url, published: e.published,
      });
    });
  }, [id, isNew]);

  const { data: regs, reload } = useData(async () => {
    if (isNew) return [] as Reg[];
    const { data } = await supabase.from('registrations').select('id, name, phone, status, ticket_code, checked_in_at').eq('event_id', id).neq('status', 'cancelada').order('name');
    return (data ?? []) as Reg[];
  }, [] as Reg[], `regs:${id}`);

  async function save() {
    const starts = brDateTimeToISO(f.date, f.time);
    if (!starts) return Alert.alert('Data', 'Preencha a data (dd/mm/aaaa) e a hora (19:30).');
    const ends = f.end_date ? brDateTimeToISO(f.end_date, f.end_time || '23:59') : null;
    if (f.end_date && !ends) return Alert.alert('Data de término', 'Use dd/mm/aaaa.');
    const price = f.price.trim() ? toCents(f.price) : 0;
    if (Number.isNaN(price)) return Alert.alert('Valor', 'Valor inválido.');
    setBusy(true);
    try {
      const cover_url = img ? await uploadMedia(church.id, 'eventos', img.uri, img.mime) : f.cover_url;
      const row = {
        church_id: church.id, title: f.title.trim(), starts_at: starts, ends_at: ends, location: f.location.trim() || null, price_cents: price,
        capacity: f.capacity.trim() ? Number(f.capacity) : null, description: f.description.trim() || null, cover_url, published: f.published,
      };
      const res = isNew ? await supabase.from('events').insert(row).select('id').single() : await supabase.from('events').update(row).eq('id', id).select('id').single();
      if (res.error) throw res.error;
      if (isNew) router.replace({ pathname: '/gestao/evento/[id]', params: { id: res.data.id } });
      else Alert.alert('Evento salvo');
    } catch (e) {
      Alert.alert('Não deu para salvar', (e as Error).message);
    } finally { setBusy(false); }
  }

  async function checkIn(r: Reg) {
    const { error } = await supabase.rpc('check_in', { p_code: r.ticket_code });
    if (error) return Alert.alert('Check-in', error.message);
    reload();
  }

  const confirmed = regs.filter((r) => r.status === 'confirmada');
  const inside = confirmed.filter((r) => r.checked_in_at).length;
  const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = regs.filter((r) => !q || norm(r.name).includes(norm(q)));

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: isNew ? 'Novo evento' : f.title || 'Evento' }} />
      {!isNew && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Inscritos" value={confirmed.length} />
          <Stat label="Pagamento pendente" value={regs.length - confirmed.length} />
          <Stat label="Já entraram" value={inside} />
        </View>
      )}
      {!isNew && regs.length > 0 && (
        <Section title="Inscritos · check-in">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
            <Search size={16} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar nome" placeholderTextColor="#8a948e" style={{ flex: 1, height: 46, fontFamily: F.regular, fontSize: 15, color: C.text }} />
          </View>
          <List>
            {shown.map((r, i) => (
              <Row key={r.id} first={i === 0} title={r.name}
                sub={r.status !== 'confirmada' ? 'aguardando pagamento' : r.checked_in_at ? `entrou às ${isoToBRTime(r.checked_in_at)}` : r.phone ?? ''}
                right={r.status === 'confirmada' && !r.checked_in_at ? (
                  <Pressable onPress={() => checkIn(r)} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: color }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 13, color: '#fff' }}>Entrou</Text>
                  </Pressable>
                ) : r.checked_in_at ? <Check size={20} color={C.ok} /> : undefined} />
            ))}
          </List>
        </Section>
      )}
      <Section title={isNew ? 'Dados do evento' : 'Editar evento'}>
        <Card>
          <Input label="Nome do evento" value={f.title} onChangeText={set('title')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 3 }}><Input label="Data" value={f.date} onChangeText={set('date')} placeholder="dd/mm/aaaa" /></View>
            <View style={{ flex: 2 }}><Input label="Hora" value={f.time} onChangeText={set('time')} placeholder="19:30" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 3 }}><Input label="Termina (opcional)" value={f.end_date} onChangeText={set('end_date')} placeholder="dd/mm/aaaa" /></View>
            <View style={{ flex: 2 }}><Input label="Hora" value={f.end_time} onChangeText={set('end_time')} placeholder="22:00" /></View>
          </View>
          <Input label="Local" value={f.location} onChangeText={set('location')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Valor (vazio = grátis)" value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" placeholder="0,00" /></View>
            <View style={{ flex: 1 }}><Input label="Vagas (opcional)" value={f.capacity} onChangeText={set('capacity')} keyboardType="number-pad" /></View>
          </View>
          <Input label="Descrição" value={f.description} onChangeText={set('description')} multiline />
          <ImageField label="Capa (opcional)" url={img?.uri ?? f.cover_url} onPick={async () => { const p = await pickImage([16, 8]); if (p) setImg(p); }}
            onClear={() => { setImg(null); setF((o) => ({ ...o, cover_url: null })); }} />
          <Toggle label="Publicado" hint="Desligado = só a equipe vê" value={f.published} onChange={(v) => setF((o) => ({ ...o, published: v }))} color={color} />
          <Button title={isNew ? 'Criar evento' : 'Salvar alterações'} color={color} loading={busy} disabled={f.title.trim().length < 3} onPress={save} />
        </Card>
      </Section>
      {!isNew && <DeleteButton what="evento" fallback="/gestao/eventos" onDelete={async () => supabase.from('events').delete().eq('id', id)} />}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12, gap: 2 }}>
      <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: C.text }}>{value}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{label}</Text>
    </View>
  );
}
