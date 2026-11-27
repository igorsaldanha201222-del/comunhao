import { useLocalSearchParams } from 'expo-router';
import { Check, MapPin, QrCode, Search, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button, C, Card, Empty, F, Input, Muted, Screen } from '@/components/ui';
import { todayBR } from '@/lib/checkin';
import { sendNotify } from '@/lib/notify';
import { useMe } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Person = { id: string; full_name: string; status: string };
type Svc = { id: string; title: string; confirm_sent_at: string | null };
type Roll = { svc: Svc | null; people: Person[]; present: Record<string, string>; error: string | null };

/** Culto de hoje + lista de pessoas e quem já está presente. Sem culto hoje, a tela oferece começar um. */
async function loadRoll(churchId: string, serviceId?: string): Promise<Roll> {
  const base = supabase.from('services').select('id, title, confirm_sent_at').eq('church_id', churchId);
  const { data: svc } = await (serviceId ? base.eq('id', serviceId) : base.eq('service_date', todayBR()).order('created_at').limit(1)).maybeSingle();
  if (!svc) return { svc: null, people: [], present: {}, error: null };
  const [p, a] = await Promise.all([
    supabase.rpc('attendance_people', { p_church: churchId }),
    supabase.from('service_attendance').select('person_id, source').eq('service_id', svc!.id),
  ]);
  return {
    svc: svc as Svc,
    people: (p.data ?? []) as Person[],
    present: Object.fromEntries(((a.data ?? []) as { person_id: string; source: string }[]).map((x) => [x.person_id, x.source])),
    error: null,
  };
}

export default function Chamada() {
  const { church, color, user } = useChurch();
  const me = useMe();
  const { s: serviceId } = useLocalSearchParams<{ s?: string }>();
  const { data, setData, refresh, refreshing } = useData(() => loadRoll(church.id, serviceId),
    { svc: null, people: [], present: {}, error: null } as Roll, `roll:${church.id}:${serviceId ?? ''}`);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [svcTitle, setSvcTitle] = useState('Culto');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const ps = t ? data.people.filter((p) => p.full_name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(t)) : data.people;
    return [...ps].sort((a, b) => Number(!!data.present[b.id]) - Number(!!data.present[a.id]) || a.full_name.localeCompare(b.full_name));
  }, [q, data.people, data.present]);
  const count = Object.keys(data.present).length;

  async function toggle(p: Person) {
    if (!data.svc) return;
    const on = !data.present[p.id];
    const next = { ...data.present };
    if (on) next[p.id] = 'manual'; else delete next[p.id];
    setData({ ...data, present: next }); // marca na hora, confirma depois
    const { error } = on
      ? await supabase.from('service_attendance').upsert({ service_id: data.svc.id, person_id: p.id, church_id: church.id })
      : await supabase.from('service_attendance').delete().eq('service_id', data.svc.id).eq('person_id', p.id);
    if (error) { Alert.alert('Não deu para salvar', error.message); refresh(); }
  }

  async function addVisitor() {
    if (!data.svc || name.trim().length < 2) return Alert.alert('Visitante', 'Digite o nome do visitante.');
    setBusy('visit');
    const { error } = await supabase.rpc('attendance_add_visitor', { p_service: data.svc.id, p_name: name.trim(), p_phone: phone.trim() });
    setBusy(null);
    if (error) return Alert.alert('Não deu para cadastrar', error.message);
    setName(''); setPhone(''); refresh();
  }

  async function askConfirm() {
    if (!data.svc) return;
    setBusy('confirm');
    try {
      const r = await sendNotify({ church_id: church.id, kind: 'confirmacao', service_id: data.svc.id });
      Alert.alert('Pedido enviado ✅', `Chegou em ${r.sent} de ${r.total} celular(es). Quem tocar em Sim entra na lista sozinho.`);
      refresh();
    } catch (e) {
      Alert.alert('Não deu para enviar', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function startToday() {
    if (svcTitle.trim().length < 2) return Alert.alert('Culto', 'Dê um nome, ex.: Culto da Família');
    setBusy('start');
    const { error } = await supabase.from('services').insert({ church_id: church.id, service_date: todayBR(), title: svcTitle.trim(), created_by: user.id });
    setBusy(null);
    if (error) return Alert.alert('Não deu para começar', error.message.includes('row-level') ? 'Você não tem permissão para fazer a chamada.' : error.message);
    refresh();
  }

  if (data.error) return <Screen><Empty>{data.error}</Empty></Screen>;
  if (!data.svc) {
    return (
      <Screen color={color}>
        <Card>
          <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text }}>Ainda não tem culto hoje</Text>
          <Muted>Comece a chamada para marcar quem veio. Ele aparece para os membros confirmarem a presença.</Muted>
          <Input label="Nome do culto" value={svcTitle} onChangeText={setSvcTitle} maxLength={80} />
          <Button title="Começar chamada de hoje" color={color} loading={busy === 'start'} onPress={startToday} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Hoje · {data.svc?.title ?? '…'}</Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff' }}>{count} presente{count === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {me.isStaff && data.svc && (
        data.svc.confirm_sent_at
          ? <Muted>✓ Pedido de confirmação já enviado hoje. Quem tocar em Sim aparece com o alfinete.</Muted>
          : <Button title="Pedir confirmação pelo app" color={color} loading={busy === 'confirm'} onPress={askConfirm} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 }}>
        <Search size={18} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar pelo nome" placeholderTextColor="#8a948e"
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.text }} />
      </View>

      {list.length === 0 ? <Empty>{q ? 'Ninguém com esse nome. Cadastre como visitante abaixo.' : 'Nenhuma pessoa cadastrada.'}</Empty> : (
        <Card style={{ padding: 0, gap: 0 }}>
          {list.slice(0, 200).map((p, i) => {
            const src = data.present[p.id];
            return (
              <Pressable key={p.id} onPress={() => toggle(p)} accessibilityRole="checkbox" accessibilityState={{ checked: !!src }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed', opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: src ? 0 : 1.5, borderColor: C.line, backgroundColor: src ? color : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {src ? <Check size={18} color="#fff" strokeWidth={3} /> : null}
                </View>
                <Text style={{ flex: 1, fontFamily: src ? F.semibold : F.regular, fontSize: 15, color: C.text }} numberOfLines={1}>{p.full_name}</Text>
                {p.status === 'visitante' && <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.accentText, backgroundColor: C.accentTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>visitante</Text>}
                {src === 'gps' && <MapPin size={16} color={C.ok} />}
                {src === 'qr' && <QrCode size={16} color={C.ok} />}
              </Pressable>
            );
          })}
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <UserPlus size={18} color={color} />
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Visitante novo</Text>
        </View>
        <Input label="Nome" value={name} onChangeText={setName} maxLength={120} placeholder="Nome completo" />
        <Input label="WhatsApp (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="(85) 9 0000-0000" />
        <Button title="Cadastrar e marcar presente" variant="outline" color={color} loading={busy === 'visit'} onPress={addVisitor} />
      </Card>
    </Screen>
  );
}
