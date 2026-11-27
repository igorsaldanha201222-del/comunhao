import * as Location from 'expo-location';
import { Stack, router, useFocusEffect } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { brToISO, isoToBR, List, Row, todayISO } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Svc = { id: string; title: string; service_date: string; headcount: number | null; att: { count: number }[] };

/** Cultos: criar, abrir a chamada de qualquer culto, contagem do público e o local da igreja (GPS). */
export default function GestaoCultos() {
  const { church, user, color } = useChurch();
  const [title, setTitle] = useState('Culto');
  const [date, setDate] = useState(isoToBR(todayISO()));
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState('');
  const { data, refresh } = useData(async () => {
    const [s, c] = await Promise.all([
      supabase.from('services').select('id, title, service_date, headcount, att:service_attendance(count)').eq('church_id', church.id).order('service_date', { ascending: false }).limit(40),
      supabase.from('churches').select('lat, lng, checkin_radius').eq('id', church.id).maybeSingle(),
    ]);
    return { services: (s.data ?? []) as unknown as Svc[], loc: c.data as { lat: number | null; lng: number | null; checkin_radius: number | null } | null };
  }, { services: [] as Svc[], loc: null as { lat: number | null; lng: number | null; checkin_radius: number | null } | null }, `gcult:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function create() {
    const d = brToISO(date);
    if (!d) return Alert.alert('Data', 'Use dia/mês/ano.');
    setBusy(true);
    const t = title.trim() || 'Culto';
    const found = await supabase.from('services').select('id').eq('church_id', church.id).eq('service_date', d).eq('title', t).maybeSingle();
    const res = found.data ? found : await supabase.from('services').insert({ church_id: church.id, service_date: d, title: t, created_by: user.id }).select('id').single();
    setBusy(false);
    if (res.error || !res.data) return Alert.alert('Não deu', res.error?.message ?? '');
    router.push({ pathname: '/gestao/culto/[id]', params: { id: res.data.id } });
  }

  async function saveLoc(lat: number, lng: number) {
    const { error } = await supabase.rpc('set_church_location', { p_church: church.id, p_lat: lat, p_lng: lng, p_radius: data.loc?.checkin_radius ?? 150 });
    if (error) return Alert.alert('Não deu', error.message);
    Alert.alert('Local da igreja salvo', 'Agora os membros podem confirmar presença pelo GPS.'); setCoords(''); refresh();
  }
  async function useHere() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Localização', 'Permita a localização para usar este botão.');
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    saveLoc(p.coords.latitude, p.coords.longitude);
  }
  function fromText() {
    const n = coords.match(/-?\d+(?:[.,]\d+)?/g)?.map((x) => Number(x.replace(',', '.'))) ?? [];
    if (n.length !== 2 || Math.abs(n[0]) > 90 || Math.abs(n[1]) > 180) return Alert.alert('Coordenadas', 'Cole no formato -3.7319, -38.5267 (no Google Maps, segure o dedo no local da igreja).');
    saveLoc(n[0], n[1]);
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Cultos e presença' }} />
      <Card>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Novo culto</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 3 }}><Input label="Nome" value={title} onChangeText={setTitle} /></View>
          <View style={{ flex: 2 }}><Input label="Data" value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" /></View>
        </View>
        <Button title="Criar culto" color={color} loading={busy} onPress={create} />
      </Card>

      <Section title="Cultos">
        <List>
          {data.services.length === 0 && <Row first title="Nenhum culto registrado." />}
          {data.services.map((s, i) => {
            const n = s.att[0]?.count ?? 0;
            return (
              <Row key={s.id} first={i === 0} title={`${s.title} · ${isoToBR(s.service_date)}`}
                sub={`${n} presente${n === 1 ? '' : 's'} na lista${s.headcount != null ? ` · contagem ${s.headcount}` : ''}`}
                onPress={() => router.push({ pathname: '/gestao/culto/[id]', params: { id: s.id } })} />
            );
          })}
        </List>
      </Section>

      <Section title="Local da igreja (GPS)">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} color={data.loc?.lat != null ? C.ok : C.muted} />
            <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 14, color: C.text }}>
              {data.loc?.lat != null ? `Marcado (${data.loc.lat.toFixed(5)}, ${data.loc.lng?.toFixed(5)}) · raio ${data.loc.checkin_radius ?? 150} m` : 'Ainda não marcado'}
            </Text>
          </View>
          <Muted>Com o local marcado, o membro confirma presença no culto pelo celular quando está na igreja.</Muted>
          <Button title="Estou na igreja: usar minha localização" variant="outline" color={color} onPress={useHere} />
          <Input label="Ou cole as coordenadas do Google Maps" value={coords} onChangeText={setCoords} placeholder="-3.7319, -38.5267" />
          <Button title="Salvar coordenadas" variant="outline" color={color} disabled={coords.trim().length < 5} onPress={fromText} />
        </Card>
      </Section>
    </Screen>
  );
}
