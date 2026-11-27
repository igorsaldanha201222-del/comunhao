import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { brToISO, DeleteButton, isoToBR } from '@/components/admin';
import { Button, C, Card, Chips, H2, Input, Muted, Screen, fmtBRL, fmtDateTime } from '@/components/ui';
import { STATUS, statusOf, uploadPhoto, useMaintAccess, type MaintStatus } from '@/lib/maintenance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Detail = {
  req: {
    id: string; number: number; title: string; description: string | null; location: string | null; priority: string;
    status: MaintStatus; photos: string[]; assigned_to: string | null; requested_by: string | null; resolution: string | null;
    due_date: string | null; created_at: string; cost_cents: number | null;
  } | null;
  updates: { id: string; user_id: string | null; kind: string; body: string | null; photo_path: string | null; created_at: string }[];
  names: Record<string, string>;
  urls: Record<string, string>;
};

export default function Chamado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, user, color } = useChurch();
  const access = useMaintAccess();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, reload, refresh, refreshing } = useData<Detail>(async () => {
    const [{ data: req }, { data: updates }, { data: people }] = await Promise.all([
      supabase.from('maintenance_requests').select('*').eq('id', id).maybeSingle(),
      supabase.from('maintenance_updates').select('id, user_id, kind, body, photo_path, created_at').eq('request_id', id).order('created_at'),
      supabase.rpc('maintenance_people', { p_church: church.id }),
    ]);
    const paths = [...(req?.photos ?? []), ...(updates ?? []).map((u) => u.photo_path).filter(Boolean)] as string[];
    const { data: signed } = paths.length ? await supabase.storage.from('maintenance').createSignedUrls(paths, 3600) : { data: [] };
    return {
      req, updates: updates ?? [],
      names: Object.fromEntries(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name])),
      urls: Object.fromEntries((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl as string])),
    };
  }, { req: null, updates: [], names: {}, urls: {} }, `${id}`);

  const r = data.req;
  if (!r) return <Screen title="Chamado" color={color}><Muted>Carregando…</Muted></Screen>;
  const canMove = access.manage || r.assigned_to === user.id;
  const st = statusOf(r.status);

  async function setStatus(status: MaintStatus) {
    const { error } = await supabase.from('maintenance_requests').update({ status }).eq('id', id);
    if (error) Alert.alert('Ops', error.message);
    reload();
  }

  async function send(withPhoto: boolean) {
    setBusy(true);
    try {
      let photo_path: string | null = null;
      if (withPhoto) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
        if (res.canceled) return;
        photo_path = await uploadPhoto(church.id, id, res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg');
      }
      if (!comment.trim() && !photo_path) return;
      const { error } = await supabase.from('maintenance_updates').insert({ request_id: id, user_id: user.id, body: comment.trim() || null, photo_path });
      if (error) throw error;
      setComment('');
      reload();
    } catch (e) {
      Alert.alert('Ops', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const describe = (u: Detail['updates'][number]) =>
    u.kind === 'status' ? `moveu para ${statusOf(u.body ?? '').label}`
      : u.kind === 'atribuicao' ? (u.body ? `passou para ${data.names[u.body] ?? '—'}` : 'tirou o responsável')
      : u.kind === 'criada' ? 'abriu o chamado' : u.body;

  return (
    <Screen title={`#${r.number} ${r.title}`} subtitle={r.location ? `📍 ${r.location}` : undefined} color={color} refreshing={refreshing} onRefresh={refresh}>
      {r.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {r.photos.map((p) => data.urls[p] && (
            <Image key={p} source={{ uri: data.urls[p] }} style={{ width: 260, height: 200, borderRadius: 14 }} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      <Card>
        <Text style={{ color: st.color, fontWeight: '700' }}>● {st.label}{r.priority === 'urgente' ? '  ·  ⚠ Urgente' : r.priority === 'alta' ? '  ·  Prioridade alta' : ''}</Text>
        <Muted>Aberto por {data.names[r.requested_by ?? ''] ?? '—'} · {fmtDateTime(r.created_at)}</Muted>
        <Muted>Responsável: {r.assigned_to ? data.names[r.assigned_to] ?? '—' : 'ainda não definido'}</Muted>
        {r.description ? <Text style={{ color: C.text, marginTop: 4 }}>{r.description}</Text> : null}
        {r.resolution ? <Text style={{ color: C.ok }}>Solução: {r.resolution}</Text> : null}
      </Card>

      {canMove && r.status !== 'cancelada' && (
        <Card>
          <H2>Mover para</H2>
          <Chips color={color} value={r.status} onChange={setStatus} options={STATUS.map((s) => ({ value: s.value, label: s.label }))} />
        </Card>
      )}

      {access.manage && <Manage key={`${r.id}:${r.priority}:${r.assigned_to}:${r.due_date}:${r.cost_cents}:${r.resolution}`} r={r} churchId={church.id} color={color} onSaved={reload} />}
      {r.cost_cents != null && !access.manage ? <Muted>Custo: {fmtBRL(Number(r.cost_cents))}</Muted> : null}

      <Card>
        <H2>Andamento</H2>
        {data.updates.map((u) => (
          <View key={u.id} style={{ borderLeftWidth: 2, borderColor: C.border, paddingLeft: 10, gap: 2 }}>
            <Muted>{data.names[u.user_id ?? ''] ?? 'Alguém'} · {fmtDateTime(u.created_at)}</Muted>
            {describe(u) ? <Text style={{ color: u.kind === 'comentario' ? C.text : C.muted }}>{describe(u)}</Text> : null}
            {u.photo_path && data.urls[u.photo_path] && (
              <Image source={{ uri: data.urls[u.photo_path] }} style={{ width: 160, height: 120, borderRadius: 10 }} contentFit="cover" />
            )}
          </View>
        ))}
        <Input label="Comentar" value={comment} onChangeText={setComment} multiline maxLength={4000} placeholder="Recado ou como ficou…" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Enviar" color={color} onPress={() => send(false)} loading={busy} disabled={!comment.trim()} /></View>
          <View style={{ flex: 1 }}><Button title="📷 Com foto" variant="outline" color={color} onPress={() => send(true)} disabled={busy} /></View>
        </View>
      </Card>
    </Screen>
  );
}

const PRIORITIES = [{ value: 'baixa', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }];

/** Quem cuida da manutenção: prioridade, responsável, prazo, custo, solução e apagar. */
function Manage({ r, churchId, color, onSaved }: { r: NonNullable<Detail['req']>; churchId: string; color: string; onSaved: () => void }) {
  const [priority, setPriority] = useState(r.priority);
  const [assigned, setAssigned] = useState(r.assigned_to ?? '');
  const [due, setDue] = useState(isoToBR(r.due_date));
  const [cost, setCost] = useState(r.cost_cents != null ? (Number(r.cost_cents) / 100).toFixed(2).replace('.', ',') : '');
  const [resolution, setResolution] = useState(r.resolution ?? '');
  const [busy, setBusy] = useState(false);
  const { data: team } = useData(async () => {
    const { data: rows } = await supabase.rpc('maintenance_people', { p_church: churchId });
    return ((rows ?? []) as { user_id: string; full_name: string; can_manage: boolean }[]).filter((x) => x.can_manage || x.user_id === r.assigned_to);
  }, [] as { user_id: string; full_name: string; can_manage: boolean }[], `mteam:${churchId}`);
  async function save() {
    if (due.trim() && !brToISO(due)) return Alert.alert('Prazo', 'Use dd/mm/aaaa.');
    const c = cost.trim() ? Math.round(Number(cost.replace(/\./g, '').replace(',', '.')) * 100) : null;
    if (c !== null && (!Number.isFinite(c) || c < 0)) return Alert.alert('Custo', 'Digite um valor, ex.: 150,00');
    setBusy(true);
    const { error } = await supabase.from('maintenance_requests').update({
      priority, assigned_to: assigned || null, due_date: due.trim() ? brToISO(due) : null, cost_cents: c, resolution: resolution.trim() || null,
    }).eq('id', r.id);
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message);
    Alert.alert('Salvo', 'Chamado atualizado.'); onSaved();
  }
  return (
    <>
      <Card>
        <H2>Gerenciar</H2>
        <Muted>Prioridade</Muted>
        <Chips color={color} value={priority} onChange={setPriority} options={PRIORITIES} />
        <Muted>Responsável</Muted>
        <Chips color={color} value={assigned} onChange={setAssigned}
          options={[{ value: '', label: 'Ninguém' }, ...team.map((x) => ({ value: x.user_id, label: x.full_name.split(' ').slice(0, 2).join(' ') }))]} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Input label="Prazo" value={due} onChangeText={setDue} placeholder="dd/mm/aaaa" /></View>
          <View style={{ flex: 1 }}><Input label="Custo (R$)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0,00" /></View>
        </View>
        <Input label="Solução / como ficou" value={resolution} onChangeText={setResolution} multiline />
        <Button title="Salvar" color={color} loading={busy} onPress={save} />
      </Card>
      <DeleteButton what="chamado" fallback="/manutencao" onDelete={async () => supabase.from('maintenance_requests').delete().eq('id', r.id)} />
    </>
  );
}
