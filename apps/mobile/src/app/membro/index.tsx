import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, C, Card, Input, Muted, Screen } from '@/components/ui';
import { level, loadJourney, maxXp, STEPS, stepsDone, xp, XP_NCC_LESSON } from '@/lib/journey';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const fmt = (v: string, time = false) =>
  new Date(time ? v : v.length === 10 ? v + 'T12:00:00' : v).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

export default function QueroSerMembro() {
  const { church, user, color } = useChurch();
  const [phone, setPhone] = useState<string | null>(null);
  const [motivation, setMotivation] = useState('');
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const { data, reload, refresh, refreshing } = useData(() => loadJourney(church.id, user.id),
    { journey: null, isMember: false, phone: '', lessons: [], attended: [] }, `${church.id}:${user.id}`);
  const { journey: j, lessons } = data;
  const attended = new Set(data.attended);
  const done = j ? stepsDone(j) : -1;
  const nccDone = lessons.filter((l) => attended.has(l.id)).length;
  const total = maxXp(lessons.length);
  const points = j ? xp(j, nccDone) : 0;

  async function start() {
    setBusy(true);
    const { error } = await supabase.rpc('journey_start', { p_church: church.id, p_phone: phone ?? data.phone, p_motivation: motivation });
    setBusy(false);
    if (error) return Alert.alert('Ops', error.message);
    setCelebrate(true);
    reload();
  }

  const detail = (i: number): string | null => {
    if (!j) return null;
    if (i === 1) return j.talk_done_at ? `Conversa feita em ${fmt(j.talk_done_at)} ✔`
      : j.talk_at ? `📅 Marcada: ${fmt(j.talk_at, true)}${j.talk_with ? ` com ${j.talk_with}` : ''}` : 'A liderança vai falar com você para marcar.';
    if (i === 2 && done >= 2) return j.ncc_done_at ? `Curso concluído ✔` : `${nccDone} de ${lessons.length} encontros${j.ncc_class ? ` · Turma: ${j.ncc_class}` : ''}`;
    if (i === 3 && done >= 3) return j.presented_at ? `Apresentado(a) em ${fmt(j.presented_at)} ✔`
      : j.presentation_date ? `🗓 Sua apresentação: culto de ${fmt(j.presentation_date)}` : 'A data será combinada com você.';
    return null;
  };

  if (data.isMember && !j) {
    return (
      <Screen title="Quero ser membro" color={color}>
        <Card><Text style={{ fontSize: 40, textAlign: 'center' }}>🏆</Text><Text style={{ textAlign: 'center', fontWeight: '700', color: C.text }}>Você já é membro da {church.name}!</Text></Card>
      </Screen>
    );
  }

  return (
    <Screen title="Quero ser membro" subtitle="4 etapas para fazer parte da família" color={color} refreshing={refreshing} onRefresh={refresh}>
      {celebrate && (
        <Card style={{ backgroundColor: '#ecfdf5', borderColor: '#6ee7b7', borderWidth: 2 }}>
          <Text style={{ fontSize: 36, textAlign: 'center' }}>🎉</Text>
          <Text style={{ textAlign: 'center', fontWeight: '800', color: '#065f46' }}>Primeira etapa concluída! +100 pontos</Text>
          <Muted>A liderança já foi avisada e vai marcar a conversa com o pastor.</Muted>
        </Card>
      )}

      {j ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Muted>Nível</Muted>
            <Text style={{ color, fontWeight: '700' }}>{points} / {total} pontos</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.text }}>{done >= 4 ? '🏆 ' : '⭐ '}{level(j)}</Text>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: color, width: `${Math.round((points / total) * 100)}%` }} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>Vamos começar? 🚀</Text>
          <Input label="Celular / WhatsApp" value={phone ?? data.phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Input label="Por que quer ser membro? (opcional)" value={motivation} onChangeText={setMotivation} multiline />
          <Button title="🙋 Quero ser membro!" color={color} onPress={start} loading={busy} />
        </Card>
      )}

      {STEPS.map((s, i) => {
        const state = i < done ? 'ok' : i === done ? 'now' : 'locked';
        const d = detail(i);
        return (
          <View key={s.title} style={{ flexDirection: 'row', gap: 12, opacity: state === 'locked' ? 0.55 : 1 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
              backgroundColor: state === 'ok' ? '#10b981' : state === 'now' ? color : '#e4e4e7' }}>
              <Text style={{ fontSize: 24 }}>{state === 'ok' ? '✅' : state === 'locked' ? '🔒' : s.icon}</Text>
            </View>
            <Card style={{ flex: 1, ...(state === 'now' ? { borderColor: color, borderWidth: 2 } : {}) }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>
                ETAPA {i + 1}{state === 'now' ? ' · VOCÊ ESTÁ AQUI' : ''}  ·  +{i === 2 ? `${XP_NCC_LESSON}/encontro` : s.xp}
              </Text>
              <Text style={{ fontWeight: '700', color: C.text }}>{s.title}</Text>
              <Muted>{s.text}</Muted>
              {d ? <Text style={{ fontWeight: '600', color: C.text, backgroundColor: '#f4f4f5', padding: 8, borderRadius: 8 }}>{d}</Text> : null}
              {i === 2 && lessons.map((l, n) => (
                <Text key={l.id} style={{ color: attended.has(l.id) ? '#047857' : C.muted }}>
                  {attended.has(l.id) ? '✅' : `${n + 1}.`} {l.title}
                </Text>
              ))}
            </Card>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 12, opacity: done >= 4 ? 1 : 0.55 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: done >= 4 ? '#fbbf24' : '#e4e4e7' }}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
        </View>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: C.text }}>{done >= 4 ? 'Bem-vindo(a) à família! Agora você é membro. 🎊' : 'Membro da igreja'}</Text>
        </Card>
      </View>
    </Screen>
  );
}
