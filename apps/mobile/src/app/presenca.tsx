import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, C, Card, H2, Muted, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { todayService } from '@/lib/checkin';

type State =
  | { k: 'loading' }
  | { k: 'none' }
  | { k: 'ask'; id: string; title: string }
  | { k: 'busy'; id: string; title: string; label: string }
  | { k: 'done'; title: string; how: 'gps' | 'qr' | 'antes' }
  | { k: 'no' }
  | { k: 'error'; id: string | null; title: string; msg: string };

const errMsg = (e: unknown) => (e as { message?: string })?.message?.replace(/^.*?ERROR:\s*/, '') ?? 'Não foi possível confirmar.';

/**
 * "Você está no culto hoje?" — aberta pela notificação (Sim já confirma), pelo cartão do Início
 * ou pelo QR Code da entrada (?qr=...). Confere a distância até a igreja pelo GPS no servidor.
 */
export default function Presenca() {
  const { church, personId, color } = useChurch();
  const { s, qr, auto } = useLocalSearchParams<{ s?: string; qr?: string; auto?: string }>();
  const [st, setSt] = useState<State>({ k: 'loading' });
  const started = useRef(false);

  const confirmGps = useCallback(async (id: string, title: string) => {
    setSt({ k: 'busy', id, title, label: 'Verificando sua localização…' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setSt({ k: 'error', id, title, msg: 'Para confirmar, permita o acesso à localização (só agora, para ver se você está na igreja).' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error } = await supabase.rpc('self_checkin', {
        p_service: id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy ?? null,
      });
      if (error) throw error;
      setSt({ k: 'done', title, how: 'gps' });
    } catch (e) {
      setSt({ k: 'error', id, title, msg: errMsg(e) });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      if (qr) {
        setSt({ k: 'busy', id: '', title: '', label: 'Confirmando pelo QR Code…' });
        const { data, error } = await supabase.rpc('qr_checkin', { p_token: qr });
        setSt(error ? { k: 'error', id: null, title: '', msg: errMsg(error) } : { k: 'done', title: String(data), how: 'qr' });
        return;
      }
      const svc = await todayService(church.id, personId, s);
      if (!svc) return setSt({ k: 'none' });
      if (svc.present) return setSt({ k: 'done', title: svc.title, how: 'antes' });
      if (auto === '1') return confirmGps(svc.id, svc.title);
      setSt({ k: 'ask', id: svc.id, title: svc.title });
    })();
  }, [church.id, personId, s, qr, auto, confirmGps]);

  return (
    <Screen title="Presença no culto" subtitle={church.name} color={color}>
      {st.k === 'loading' && <Muted>Carregando…</Muted>}

      {st.k === 'none' && (
        <Card><H2>Nenhum culto aberto hoje</H2><Muted>Quando a igreja abrir a chamada do culto, você confirma sua presença por aqui.</Muted></Card>
      )}

      {st.k === 'ask' && (
        <Card style={{ borderColor: color, borderWidth: 2, alignItems: 'stretch' }}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>🙏</Text>
          <H2>Você está no {st.title} hoje?</H2>
          <Muted>Ao tocar em Sim, o app confere pelo GPS se você está na igreja. Sua localização não fica guardada.</Muted>
          <Button title="✅ Sim, estou aqui" color={color} onPress={() => confirmGps(st.id, st.title)} />
          <Button title="Não" variant="outline" color={C.muted} onPress={() => setSt({ k: 'no' })} />
        </Card>
      )}

      {st.k === 'busy' && <Card><H2>{st.label}</H2><Muted>Isso leva poucos segundos.</Muted></Card>}

      {st.k === 'done' && (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <H2>{st.how === 'antes' ? 'Sua presença já está confirmada' : 'Presença confirmada!'}</H2>
          <Muted>{st.title ? `${st.title} · ` : ''}Que bom ter você aqui. Bom culto! 💙</Muted>
          <View style={{ alignSelf: 'stretch' }}><Button title="Voltar ao início" color={color} onPress={() => router.replace('/')} /></View>
        </Card>
      )}

      {st.k === 'no' && (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>💙</Text>
          <H2>Tudo bem!</H2>
          <Muted>Sentimos sua falta. Você pode assistir ao vivo pelo site da igreja.</Muted>
          <View style={{ alignSelf: 'stretch' }}><Button title="Voltar ao início" color={color} onPress={() => router.replace('/')} /></View>
        </Card>
      )}

      {st.k === 'error' && (
        <Card>
          <H2>Não deu para confirmar</H2>
          <Text style={{ color: C.danger }}>{st.msg}</Text>
          {st.id && <Button title="Tentar de novo" color={color} onPress={() => confirmGps(st.id!, st.title)} />}
          <Muted>Se precisar, peça para a recepção marcar sua presença na lista.</Muted>
        </Card>
      )}
    </Screen>
  );
}
