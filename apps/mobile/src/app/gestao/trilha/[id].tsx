import { Stack, useLocalSearchParams } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { brDateTimeToISO, brToISO, isoToBR, isoToBRDateTZ, isoToBRTime } from '@/components/admin';
import { Button, C, Card, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type J = {
  id: string; full_name: string; phone: string | null; motivation: string | null; step: string; gave_up: boolean;
  talk_at: string | null; talk_with: string | null; talk_done_at: string | null; ncc_class: string | null; ncc_done_at: string | null;
  presentation_date: string | null; presented_at: string | null;
};

/** Acompanhar uma pessoa na trilha de membresia (conversa → NCC → apresentação). */
export default function Trilha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church, color } = useChurch();
  const [edit, setEdit] = useState<Record<string, string>>({});
  const { data, reload } = useData(async () => {
    const [j, l, a] = await Promise.all([
      supabase.from('member_journeys').select('*').eq('id', id).maybeSingle(),
      supabase.from('ncc_lessons').select('id, title').eq('church_id', church.id).order('position'),
      supabase.from('ncc_attendance').select('lesson_id').eq('journey_id', id),
    ]);
    return { j: j.data as J | null, lessons: (l.data ?? []) as { id: string; title: string }[], done: new Set((a.data ?? []).map((x) => x.lesson_id)) };
  }, { j: null as J | null, lessons: [] as { id: string; title: string }[], done: new Set<string>() }, `trl:${id}`);
  const j = data.j;
  if (!j) return <Screen color={color}><Muted>Carregando…</Muted></Screen>;
  const v = (k: string, fallback: string) => edit[k] ?? fallback;
  const set = (k: string) => (x: string) => setEdit((o) => ({ ...o, [k]: x }));

  async function patch(row: Record<string, unknown>) {
    const { error } = await supabase.from('member_journeys').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return Alert.alert('Não deu', error.message);
    setEdit({}); reload();
  }
  async function toggleLesson(lessonId: string) {
    const { error } = data.done.has(lessonId)
      ? await supabase.from('ncc_attendance').delete().eq('journey_id', id).eq('lesson_id', lessonId)
      : await supabase.from('ncc_attendance').upsert({ journey_id: id, lesson_id: lessonId, church_id: church.id });
    if (error) Alert.alert('Não deu', error.message); else reload();
  }
  const digits = (j.phone ?? '').replace(/\D/g, '');

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: j.full_name.split(' ')[0] }} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: C.text }}>{j.full_name}</Text>
        {j.motivation ? <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.body }}>“{j.motivation}”</Text> : null}
      </View>
      {digits.length >= 10 && (
        <Button title="Falar no WhatsApp" variant="outline" color={color} onPress={() => Linking.openURL(`https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}`)} />
      )}

      <Section title="1. Conversa com o pastor">
        <Card>
          <Step done={!!j.talk_done_at} label={j.talk_done_at ? `Conversa feita em ${isoToBRDateTZ(j.talk_done_at)}` : 'Conversa ainda não feita'} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 3 }}><Input label="Dia" value={v('talk_d', isoToBRDateTZ(j.talk_at))} onChangeText={set('talk_d')} placeholder="dd/mm/aaaa" /></View>
            <View style={{ flex: 2 }}><Input label="Hora" value={v('talk_t', isoToBRTime(j.talk_at))} onChangeText={set('talk_t')} placeholder="19:30" /></View>
          </View>
          <Input label="Com quem" value={v('talk_with', j.talk_with ?? '')} onChangeText={set('talk_with')} placeholder="Pr. Marcos" />
          <Button title="Marcar conversa" variant="outline" color={color} onPress={() => {
            const at = brDateTimeToISO(v('talk_d', isoToBRDateTZ(j.talk_at)), v('talk_t', isoToBRTime(j.talk_at)) || '19:00');
            if (!at) return Alert.alert('Data', 'Use dd/mm/aaaa e hh:mm.');
            patch({ talk_at: at, talk_with: v('talk_with', j.talk_with ?? '').trim() || null });
          }} />
          <Button title={j.talk_done_at ? 'Desfazer: conversa não foi feita' : 'Conversa feita'} color={j.talk_done_at ? C.muted : color}
            onPress={() => patch({ talk_done_at: j.talk_done_at ? null : new Date().toISOString() })} />
        </Card>
      </Section>

      <Section title="2. NCC">
        <Card>
          <Input label="Turma (dia e horário)" value={v('ncc', j.ncc_class ?? '')} onChangeText={set('ncc')} placeholder="Quartas, 19h30" />
          <Button title="Salvar turma" variant="outline" color={color} onPress={() => patch({ ncc_class: v('ncc', j.ncc_class ?? '').trim() || null })} />
          {data.lessons.length === 0 ? <Muted>Cadastre as aulas do NCC na tela Novos membros.</Muted> : data.lessons.map((l) => (
            <Pressable key={l.id} onPress={() => toggleLesson(l.id)} accessibilityRole="checkbox" accessibilityState={{ checked: data.done.has(l.id) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              {data.done.has(l.id) ? <Check size={20} color={C.ok} strokeWidth={3} /> : <Circle size={20} color={C.line} />}
              <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: C.text }}>{l.title}</Text>
            </Pressable>
          ))}
          {j.ncc_done_at ? <Step done label={`NCC concluído em ${isoToBRDateTZ(j.ncc_done_at)}`} /> : null}
        </Card>
      </Section>

      <Section title="3. Apresentação à igreja">
        <Card>
          <Input label="Culto da apresentação" value={v('pres', isoToBR(j.presentation_date))} onChangeText={set('pres')} placeholder="dd/mm/aaaa" />
          <Button title="Salvar data" variant="outline" color={color} onPress={() => {
            const d = v('pres', isoToBR(j.presentation_date)).trim();
            if (d && !brToISO(d)) return Alert.alert('Data', 'Use dd/mm/aaaa.');
            patch({ presentation_date: d ? brToISO(d) : null });
          }} />
          <Button title={j.presented_at ? 'Desfazer apresentação' : 'Foi apresentado(a): agora é membro'} color={j.presented_at ? C.muted : color}
            onPress={() => patch({ presented_at: j.presented_at ? null : new Date().toISOString() })} />
        </Card>
      </Section>

      <Button title={j.gave_up ? 'Voltou: retomar a trilha' : 'Marcar como desistente'} variant="outline" color={C.danger} onPress={() => patch({ gave_up: !j.gave_up })} />
    </Screen>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {done ? <Check size={18} color={C.ok} strokeWidth={3} /> : <Circle size={18} color={C.line} />}
      <Text style={{ fontFamily: F.semibold, fontSize: 14, color: done ? C.ok : C.muted }}>{label}</Text>
    </View>
  );
}
