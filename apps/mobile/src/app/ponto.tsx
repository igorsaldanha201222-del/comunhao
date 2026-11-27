import * as Location from 'expo-location';
import { Clock, LogIn, LogOut, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { C, Card, Empty, F, Muted, Screen, Section } from '@/components/ui';
import { useMe } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { DAYS, hhmm, hours, loadPunches, worked } from '@/lib/work';

/** Ponto do funcionário: uma batida alterna entrada/saída, conferida pelo GPS. */
export default function Ponto() {
  const { church, color } = useChurch();
  const me = useMe();
  const emp = me.employee;
  const { data, refresh, refreshing } = useData(() => (emp ? loadPunches(emp.id) : Promise.resolve(null)), null, `ponto:${emp?.id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!emp) return <Screen><Empty>Esta área é dos funcionários da igreja.</Empty></Screen>;
  const w = worked(data?.today ?? []);
  const next = w.working ? 'saida' : 'entrada';

  async function punch() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Para bater o ponto, permita a localização (só para ver se você está na igreja).');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data: r, error } = await supabase.rpc('clock_punch', {
        p_church: church.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy ?? null,
      });
      if (error) throw error;
      const p = r as { kind: string; at: string };
      setMsg({ ok: true, text: `${p.kind === 'entrada' ? 'Entrada' : 'Saída'} registrada às ${hhmm(p.at)}` });
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const Icon = next === 'entrada' ? LogIn : LogOut;
  const worksToday = emp.work_days.includes(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay());

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 22, gap: 6 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{emp.job_title} · hoje</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff' }}>{w.working ? 'Trabalhando' : (data?.today.length ? 'Expediente encerrado' : 'Ainda não bateu')}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          {hours(w.total)} hoje{emp.start_time && emp.end_time ? ` · escala ${emp.start_time.slice(0, 5)}–${emp.end_time.slice(0, 5)}` : ''}
        </Text>
      </View>

      <Pressable onPress={punch} disabled={busy} accessibilityRole="button"
        style={({ pressed }) => ({
          height: 120, borderRadius: 24, backgroundColor: next === 'entrada' ? color : C.text, alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: busy ? 0.6 : pressed ? 0.9 : 1,
        })}>
        <Icon size={30} color="#fff" strokeWidth={2} />
        <Text style={{ fontFamily: F.extrabold, fontSize: 20, color: '#fff' }}>
          {busy ? 'Verificando localização…' : next === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}
        </Text>
      </Pressable>
      {msg && <Text style={{ fontFamily: F.semibold, fontSize: 14, color: msg.ok ? C.ok : C.danger, textAlign: 'center' }}>{msg.text}</Text>}
      {!worksToday && <Muted>Hoje não está na sua escala. Se veio trabalhar, pode bater normalmente.</Muted>}

      <Section title="Batidas de hoje">
        {!data?.today.length ? <Empty>Nenhuma batida hoje.</Empty> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {data.today.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                {p.kind === 'entrada' ? <LogIn size={18} color={C.ok} /> : <LogOut size={18} color={C.body} />}
                <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text }}>{p.kind === 'entrada' ? 'Entrada' : 'Saída'}</Text>
                {p.source === 'gps' ? <MapPin size={14} color={C.muted} /> : <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.muted }}>lançada</Text>}
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{hhmm(p.at)}</Text>
              </View>
            ))}
          </Card>
        )}
      </Section>

      <Section title="Minha escala">
        <Card>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAYS.map((d, i) => {
              const on = emp.work_days.includes(i);
              return (
                <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: on ? C.tint : C.bg }}>
                  <Text style={{ fontFamily: on ? F.bold : F.regular, fontSize: 12, color: on ? color : C.muted }}>{d}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={C.muted} />
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.body }}>
              {emp.start_time && emp.end_time ? `${emp.start_time.slice(0, 5)} às ${emp.end_time.slice(0, 5)}` : 'Horário a combinar'}
            </Text>
          </View>
          <Muted>{`Neste mês: ${data?.monthDays ?? 0} dia(s), ${hours(data?.monthMin ?? 0)} trabalhadas.`}</Muted>
        </Card>
      </Section>
    </Screen>
  );
}
