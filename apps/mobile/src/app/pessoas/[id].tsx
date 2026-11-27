import { Stack, useLocalSearchParams } from 'expo-router';
import { Crown, MessageCircle, Pencil, Phone, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { PersonForm, type PersonRow } from '@/components/person-form';
import { Button, C, Card, Chips, Empty, F, Input, Muted, Screen, Section, fmtDateTime } from '@/components/ui';
import { fromISODate, STATUS } from '@/lib/people';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Min = { id: string; name: string; color: string };
type Data = {
  person: (PersonRow & { id: string; user_id: string | null }) | null;
  mine: (Min & { is_leader: boolean })[];
  all: Min[];
  care: { id: string; kind: string; reason: string; notes: string | null; happened_at: string }[];
};

/** Ficha da pessoa: dados, ministérios (pôr/tirar/líder) e atendimentos pastorais. */
export default function PessoaFicha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, user, color } = useChurch();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [care, setCare] = useState({ kind: 'pastoral', reason: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const { data, reload } = useData<Data>(async () => {
    const [p, mm, all, pc] = await Promise.all([
      supabase.from('people').select('id, full_name, phone, email, status, birth_date, baptized_at, marital_status, address, notes, user_id').eq('id', id).maybeSingle(),
      supabase.from('ministry_members').select('is_leader, ministries(id, name, color)').eq('person_id', id),
      supabase.from('ministries').select('id, name, color').eq('church_id', church.id).order('name'),
      supabase.from('pastoral_care').select('id, kind, reason, notes, happened_at').eq('person_id', id).order('happened_at', { ascending: false }).limit(30),
    ]);
    return {
      person: p.data as Data['person'],
      mine: (mm.data ?? []).map((x) => ({ ...(x.ministries as unknown as Min), is_leader: x.is_leader })),
      all: (all.data ?? []) as Min[],
      care: (pc.data ?? []) as Data['care'],
    };
  }, { person: null, mine: [], all: [], care: [] }, `pessoa:${id}`);
  const p = data.person;
  if (!p) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;
  const st = STATUS[p.status];
  const digits = (p.phone ?? '').replace(/\D/g, '');
  const wa = digits ? `https://wa.me/${digits.length <= 11 ? '55' + digits : digits}` : null;
  const available = data.all.filter((m) => !data.mine.some((x) => x.id === m.id));

  async function addTo(m: Min) {
    const { error } = await supabase.from('ministry_members').insert({ ministry_id: m.id, person_id: id, church_id: church.id });
    if (error) return Alert.alert('Não deu', error.message);
    setAdding(false); reload();
  }
  async function toggleLeader(m: Min & { is_leader: boolean }) {
    const { error } = await supabase.from('ministry_members').update({ is_leader: !m.is_leader }).eq('ministry_id', m.id).eq('person_id', id);
    if (error) return Alert.alert('Não deu', error.message);
    reload();
  }
  function removeFrom(m: Min) {
    Alert.alert('Tirar do ministério?', `${p!.full_name} sai de ${m.name}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('ministry_members').delete().eq('ministry_id', m.id).eq('person_id', id);
        if (error) Alert.alert('Não deu', error.message); else reload();
      } },
    ]);
  }
  async function addCare() {
    setBusy(true);
    const { error } = await supabase.from('pastoral_care').insert({ church_id: church.id, person_id: id, kind: care.kind, reason: care.reason.trim(), notes: care.notes.trim() || null, attended_by: user.id });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    setCare({ kind: 'pastoral', reason: '', notes: '' }); reload();
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: p.full_name.split(' ')[0] }} />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: st.color }}>{p.full_name.trim()[0]?.toUpperCase()}</Text>
        </View>
        <Text style={{ fontFamily: F.extrabold, fontSize: 21, color: C.text, textAlign: 'center' }}>{p.full_name}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: st.color, backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }}>
          {st.label}{p.user_id ? ' · usa o app' : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {wa && <Action icon={MessageCircle} label="WhatsApp" color={color} onPress={() => Linking.openURL(wa)} />}
        {digits && <Action icon={Phone} label="Ligar" color={color} onPress={() => Linking.openURL(`tel:${digits}`)} />}
        <Action icon={Pencil} label={editing ? 'Fechar' : 'Editar'} color={color} onPress={() => setEditing(!editing)} />
      </View>

      {editing ? (
        <Card><PersonForm person={p} onSaved={() => { setEditing(false); reload(); }} /></Card>
      ) : (
        <Card style={{ gap: 8 }}>
          <Info label="Telefone" value={p.phone} />
          <Info label="E-mail" value={p.email} />
          <Info label="Nascimento" value={fromISODate(p.birth_date)} />
          <Info label="Batismo" value={fromISODate(p.baptized_at)} />
          <Info label="Estado civil" value={p.marital_status} />
          <Info label="Endereço" value={p.address} />
          {p.notes ? <Info label="Observações" value={p.notes} /> : null}
        </Card>
      )}

      <Section title="Ministérios">
        <Card style={{ padding: 0, gap: 0 }}>
          {data.mine.length === 0 && <Text style={{ padding: 16, fontFamily: F.regular, color: C.muted }}>Ainda não serve em nenhum ministério.</Text>}
          {data.mine.map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
              <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text }}>{m.name}</Text>
              <Pressable onPress={() => toggleLeader(m)} accessibilityRole="button" hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: m.is_leader ? C.accentTint : C.bg }}>
                <Crown size={13} color={m.is_leader ? C.accentText : C.muted} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: m.is_leader ? C.accentText : C.muted }}>{m.is_leader ? 'Líder' : 'Tornar líder'}</Text>
              </Pressable>
              <Pressable onPress={() => removeFrom(m)} accessibilityRole="button" accessibilityLabel={`Tirar de ${m.name}`} hitSlop={8}>
                <X size={18} color={C.danger} />
              </Pressable>
            </View>
          ))}
          {adding ? (
            <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#eef1ed' }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Colocar em qual ministério?</Text>
              {available.length === 0 ? <Muted>Já está em todos.</Muted> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {available.map((m) => (
                    <Pressable key={m.id} onPress={() => addTo(m)} accessibilityRole="button"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                      <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }}>{m.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Pressable onPress={() => setAdding(true)} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderTopWidth: 1, borderTopColor: '#eef1ed' }}>
              <Plus size={18} color={color} />
              <Text style={{ fontFamily: F.bold, fontSize: 15, color }}>Colocar em ministério</Text>
            </Pressable>
          )}
        </Card>
      </Section>

      <Section title="Atendimentos">
        <Card>
          <Chips color={color} value={care.kind} onChange={(v) => setCare({ ...care, kind: v })}
            options={[{ value: 'pastoral', label: 'Pastoral' }, { value: 'administrativo', label: 'Administrativo' }]} />
          <Input label="Motivo" value={care.reason} onChangeText={(v) => setCare({ ...care, reason: v })} placeholder="ex.: aconselhamento familiar" />
          <Input label="Anotações (só a equipe vê)" value={care.notes} onChangeText={(v) => setCare({ ...care, notes: v })} multiline />
          <Button title="Registrar atendimento" color={color} loading={busy} disabled={care.reason.trim().length < 3} onPress={addCare} />
        </Card>
        {data.care.length === 0 ? <Empty>Nenhum atendimento registrado.</Empty> : data.care.map((c) => (
          <Card key={c.id} style={{ gap: 4 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>{c.kind === 'pastoral' ? 'Pastoral' : 'Administrativo'} · {fmtDateTime(c.happened_at)}</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{c.reason}</Text>
            {c.notes ? <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.body }}>{c.notes}</Text> : null}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ width: 96, fontFamily: F.medium, fontSize: 13, color: C.muted }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: value ? C.text : '#a5ada8' }}>{value || '—'}</Text>
    </View>
  );
}

function Action({ icon: Icon, label, color, onPress }: { icon: typeof Phone; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.8 : 1 })}>
      <Icon size={20} color={color} />
      <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}>{label}</Text>
    </Pressable>
  );
}
