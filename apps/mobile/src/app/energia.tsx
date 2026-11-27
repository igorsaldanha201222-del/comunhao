import { useFocusEffect } from 'expo-router';
import { CircleCheck, Sun, TriangleAlert, WifiOff, Zap } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { C, Card, Empty, F, Screen, Section, fmtDateTime } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Device = { id: string; name: string; inverter_brand: string | null; inverter_model: string | null; rated_power_kw: number | null; last_seen_at: string | null; last_power_w: number | null; last_status: string | null };
type Reading = { device_id: string; measured_at: string; power_w: number | null; energy_today_kwh: number | null };
type AlertRow = { id: string; kind: string; message: string; opened_at: string; resolved_at: string | null; solar_devices: { name: string } | null };

const TZ = 'America/Sao_Paulo';
const dayKey = (t: string | Date) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
const num = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const offline = (d: Device) => !d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() > 15 * 60_000;
const ALERT_LABEL: Record<string, string> = { falha: 'Falha no inversor', offline: 'Sem comunicação', sem_geracao: 'Sem geração' };
const STATUS = {
  gerando: { label: 'Gerando', color: C.ok, Icon: Sun },
  parado: { label: 'Parado', color: C.accentText, Icon: Zap },
  falha: { label: 'Falha', color: C.danger, Icon: TriangleAlert },
  offline: { label: 'Sem comunicação', color: C.muted, Icon: WifiOff },
} as const;

/** Monitoramento do sistema solar da igreja (equipe). */
export default function Energia() {
  const { church, color } = useChurch();
  const { data, refresh, refreshing } = useData(async () => {
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [d, a, r] = await Promise.all([
      supabase.from('solar_devices').select('id, name, inverter_brand, inverter_model, rated_power_kw, last_seen_at, last_power_w, last_status').eq('church_id', church.id).order('name'),
      supabase.from('solar_alerts').select('id, kind, message, opened_at, resolved_at, solar_devices(name)').eq('church_id', church.id)
        .order('resolved_at', { ascending: true, nullsFirst: true }).order('opened_at', { ascending: false }).limit(20),
      supabase.from('solar_readings').select('device_id, measured_at, power_w, energy_today_kwh').eq('church_id', church.id).gte('measured_at', weekAgo).order('measured_at').limit(20000),
    ]);
    return { devices: (d.data ?? []) as Device[], alerts: (a.data ?? []) as unknown as AlertRow[], readings: (r.data ?? []) as Reading[], ok: !d.error };
  }, { devices: [], alerts: [], readings: [], ok: true }, `solar:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const { devices, alerts, readings } = data;
  const today = dayKey(new Date());
  const perDay = new Map<string, Map<string, number>>();
  for (const r of readings) {
    if (r.energy_today_kwh == null) continue;
    const k = dayKey(r.measured_at);
    const m = perDay.get(k) ?? new Map<string, number>();
    m.set(r.device_id, Math.max(m.get(r.device_id) ?? 0, Number(r.energy_today_kwh)));
    perDay.set(k, m);
  }
  const days = [...perDay].map(([d, m]) => ({ d, kwh: [...m.values()].reduce((s, v) => s + v, 0) })).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 7);
  const todayKwh = days.find((x) => x.d === today)?.kwh ?? 0;
  const weekKwh = days.reduce((s, x) => s + x.kwh, 0);
  const nowKw = devices.filter((d) => !offline(d)).reduce((s, d) => s + Number(d.last_power_w ?? 0), 0) / 1000;
  const open = alerts.filter((a) => !a.resolved_at);

  function resolve(a: AlertRow) {
    Alert.alert('Marcar como resolvido?', `${ALERT_LABEL[a.kind] ?? a.kind}: ${a.message}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Resolvido', onPress: async () => {
        const { error } = await supabase.from('solar_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', a.id);
        if (error) Alert.alert('Não deu', error.message); else refresh();
      } },
    ]);
  }

  if (data.ok && devices.length === 0) {
    return <Screen color={color}><Empty>Nenhum aparelho de monitoramento cadastrado ainda. O cadastro do aparelho é feito no painel, no computador.</Empty></Screen>;
  }

  return (
    <Screen color={color} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20, gap: 14 }}>
        <View>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Potência agora</Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 34, color: '#fff' }}>{num(nowKw, 2)} kW</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Mini label="Hoje" value={`${num(todayKwh)} kWh`} />
          <Mini label="7 dias" value={`${num(weekKwh)} kWh`} />
          <Mini label="Economia 7 dias" value={`R$ ${num(weekKwh * 0.9, 0)}`} />
        </View>
      </View>

      {open.length > 0 && (
        <Section title={`Alertas abertos (${open.length})`}>
          {open.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fbeaea', borderRadius: 16, padding: 14 }}>
              <TriangleAlert size={20} color={C.danger} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{ALERT_LABEL[a.kind] ?? a.kind} · {a.solar_devices?.name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.body }}>{a.message} · desde {fmtDateTime(a.opened_at)}</Text>
              </View>
              <Pressable onPress={() => resolve(a)} accessibilityRole="button" hitSlop={6}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ok }}>Resolvido</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      )}

      {devices.map((d) => {
        const st = offline(d) ? STATUS.offline : STATUS[(d.last_status as keyof typeof STATUS) ?? 'parado'] ?? STATUS.parado;
        const pts = readings.filter((r) => r.device_id === d.id && dayKey(r.measured_at) === today && r.power_w != null).map((r) => ({ t: r.measured_at, w: Number(r.power_w) }));
        return (
          <Card key={d.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{d.name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>
                  {[d.inverter_brand, d.inverter_model, d.rated_power_kw && `${num(Number(d.rated_power_kw))} kW`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <st.Icon size={15} color={st.color} />
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: st.color }}>{st.label}</Text>
              </View>
            </View>
            <PowerChart points={pts} ratedKw={d.rated_power_kw ? Number(d.rated_power_kw) : null} color={color} />
            <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>Última leitura: {d.last_seen_at ? fmtDateTime(d.last_seen_at) : 'nunca'}</Text>
          </Card>
        );
      })}

      <Section title="Energia por dia">
        <Card style={{ padding: 0, gap: 0 }}>
          {days.length === 0 && <Text style={{ padding: 16, fontFamily: F.regular, color: C.muted }}>Sem dados.</Text>}
          {days.map((x, i) => (
            <View key={x.d} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
              <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text }}>{x.d === today ? 'Hoje' : x.d.split('-').reverse().slice(0, 2).join('/')}</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{num(x.kwh)} kWh</Text>
            </View>
          ))}
        </Card>
      </Section>

      {alerts.some((a) => a.resolved_at) && (
        <Section title="Alertas resolvidos">
          <Card style={{ padding: 0, gap: 0 }}>
            {alerts.filter((a) => a.resolved_at).slice(0, 8).map((a, i) => (
              <View key={a.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <CircleCheck size={16} color={C.ok} />
                <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 13, color: C.body }}>{ALERT_LABEL[a.kind] ?? a.kind} · {a.solar_devices?.name} · {fmtDateTime(a.opened_at)}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 10, gap: 2 }}>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{label}</Text>
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: '#fff' }}>{value}</Text>
    </View>
  );
}

/** Potência ao longo do dia (05h–20h): área + linha 2px; tocar/arrastar mostra o valor. */
function PowerChart({ points, ratedKw, color }: { points: { t: string; w: number }[]; ratedKw: number | null; color: string }) {
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const H = 170, PL = 34, PR = 8, PT = 10, PB = 22;
  if (!points.length) return <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, paddingVertical: 24, textAlign: 'center' }}>Sem leituras hoje.</Text>;

  const start = new Date(new Date(points[0].t).toLocaleString('en-US', { timeZone: TZ }));
  start.setHours(5, 0, 0, 0);
  const offset = new Date(points[0].t).getTime() - new Date(new Date(points[0].t).toLocaleString('en-US', { timeZone: TZ })).getTime();
  const t0 = start.getTime() + offset, span = 15 * 3600_000;
  const maxW = Math.max(ratedKw ? ratedKw * 1000 : 0, ...points.map((p) => p.w), 1000);
  const x = (t: string) => PL + Math.min(1, Math.max(0, (new Date(t).getTime() - t0) / span)) * (w - PL - PR);
  const y = (v: number) => PT + (1 - v / maxW) * (H - PT - PB);
  const xs = points.map((p) => x(p.t)), ys = points.map((p) => y(p.w));
  const line = xs.map((px, i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${ys[i].toFixed(1)}`).join('');
  const area = `${line}L${xs[xs.length - 1]},${H - PB}L${xs[0]},${H - PB}Z`;
  const kw = (v: number) => `${num(v / 1000, 2)} kW`;
  const pick = (px: number) => { let b = 0; xs.forEach((xx, i) => { if (Math.abs(xx - px) < Math.abs(xs[b] - px)) b = i; }); setHover(b); };
  const peak = Math.max(...points.map((p) => p.w));
  const h = hover != null ? points[hover] : null;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ gap: 6 }}>
      <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>
        {h ? `${new Date(h.t).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} · ${kw(h.w)}` : `Pico hoje: ${kw(peak)}`}
      </Text>
      {w > 0 && (
        <View onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)} onResponderMove={(e) => pick(e.nativeEvent.locationX)} onResponderRelease={() => setHover(null)}
          accessibilityLabel={`Potência hoje, pico de ${kw(peak)}`}>
          <Svg width={w} height={H}>
            {[0, 0.5, 1].map((f) => (
              <Line key={f} x1={PL} x2={w - PR} y1={y(maxW * f)} y2={y(maxW * f)} stroke="#e3e7e2" strokeWidth={1} />
            ))}
            {[0, 0.5, 1].map((f) => (
              <SvgText key={`t${f}`} x={PL - 6} y={y(maxW * f) + 4} fontSize={10} fill="#5b6660" textAnchor="end">{num((maxW * f) / 1000)}</SvgText>
            ))}
            {[6, 9, 12, 15, 18].map((hh) => (
              <SvgText key={hh} x={PL + ((hh - 5) / 15) * (w - PL - PR)} y={H - 6} fontSize={10} fill="#5b6660" textAnchor="middle">{hh}h</SvgText>
            ))}
            <Path d={area} fill={color} fillOpacity={0.12} />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {hover != null && <Line x1={xs[hover]} x2={xs[hover]} y1={PT} y2={H - PB} stroke="#14201a" strokeWidth={1} strokeDasharray="3,3" />}
          </Svg>
        </View>
      )}
    </View>
  );
}
