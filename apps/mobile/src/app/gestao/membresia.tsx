import { Stack, router, useFocusEffect } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { List, Row } from '@/components/admin';
import { C, Card, Chips, Empty, F, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type J = { id: string; full_name: string; step: 'conversa' | 'ncc' | 'apresentacao' | 'concluido'; gave_up: boolean; talk_at: string | null; ncc_class: string | null; presentation_date: string | null; created_at: string };
type Tab = J['step'] | 'desistentes';
const TABS: { value: Tab; label: string }[] = [
  { value: 'conversa', label: 'Conversa' }, { value: 'ncc', label: 'NCC' }, { value: 'apresentacao', label: 'Apresentação' },
  { value: 'concluido', label: 'Novos membros' }, { value: 'desistentes', label: 'Desistentes' },
];

/** Trilha "Quero ser membro": quem está em cada etapa, e as aulas do NCC. */
export default function GestaoMembresia() {
  const { church, color } = useChurch();
  const [tab, setTab] = useState<Tab>('conversa');
  const [lesson, setLesson] = useState('');
  const { data, refresh } = useData(async () => {
    const [j, l] = await Promise.all([
      supabase.from('member_journeys').select('id, full_name, step, gave_up, talk_at, ncc_class, presentation_date, created_at').eq('church_id', church.id).order('created_at'),
      supabase.from('ncc_lessons').select('id, title, position').eq('church_id', church.id).order('position'),
    ]);
    return { journeys: (j.data ?? []) as J[], lessons: (l.data ?? []) as { id: string; title: string; position: number }[] };
  }, { journeys: [] as J[], lessons: [] as { id: string; title: string; position: number }[] }, `gmem:${church.id}`);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const list = data.journeys.filter((j) => (tab === 'desistentes' ? j.gave_up : !j.gave_up && j.step === tab));
  const count = (t: Tab) => data.journeys.filter((j) => (t === 'desistentes' ? j.gave_up : !j.gave_up && j.step === t)).length;
  const sub = (j: J) => {
    const d = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }).replace('.', '');
    if (j.step === 'conversa') return j.talk_at ? `conversa marcada ${d(j.talk_at)}` : 'falta marcar a conversa';
    if (j.step === 'ncc') return j.ncc_class ? `turma ${j.ncc_class}` : 'falta definir a turma';
    if (j.step === 'apresentacao') return j.presentation_date ? `apresentação ${d(j.presentation_date + 'T12:00:00')}` : 'falta marcar a apresentação';
    return `desde ${d(j.created_at)}`;
  };

  async function addLesson() {
    const { error } = await supabase.from('ncc_lessons').insert({ church_id: church.id, title: lesson.trim(), position: data.lessons.length + 1 });
    if (error) return Alert.alert('Não deu', error.message);
    setLesson(''); refresh();
  }
  function removeLesson(l: { id: string; title: string }) {
    Alert.alert('Apagar aula?', l.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('ncc_lessons').delete().eq('id', l.id);
      if (error) Alert.alert('Não deu', error.message); else refresh();
    } }]);
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Novos membros' }} />
      <Chips color={color} value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: `${t.label} ${count(t.value)}` }))} />
      {list.length === 0 ? <Empty>Ninguém nesta etapa.</Empty> : (
        <List>
          {list.map((j, i) => (
            <Row key={j.id} first={i === 0} title={j.full_name} sub={sub(j)} onPress={() => router.push({ pathname: '/gestao/trilha/[id]', params: { id: j.id } })} />
          ))}
        </List>
      )}
      <Section title={`Aulas do NCC (${data.lessons.length})`}>
        <Card>
          {data.lessons.map((l, i) => (
            <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 22, fontFamily: F.bold, color: C.muted }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: C.text }}>{l.title}</Text>
              <Pressable onPress={() => removeLesson(l)} hitSlop={8} accessibilityLabel={`Apagar aula ${l.title}`}><Trash2 size={16} color={C.danger} /></Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={lesson} onChangeText={setLesson} placeholder="Nova aula" placeholderTextColor="#8a948e"
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15, color: C.text }} />
            <Pressable onPress={addLesson} disabled={lesson.trim().length < 2} accessibilityRole="button"
              style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: lesson.trim().length < 2 ? 0.4 : 1 }}>
              <Text style={{ fontFamily: F.bold, color: '#fff' }}>Adicionar</Text>
            </Pressable>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
