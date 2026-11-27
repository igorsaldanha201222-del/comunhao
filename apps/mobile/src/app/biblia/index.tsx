import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { C, Chips, F, Screen } from '@/components/ui';
import { BOOKS, OT_COUNT } from '@/lib/bible';
import { useChurch } from '@/lib/session';

/** Lista dos livros da Bíblia (Antigo e Novo Testamento). */
export default function Biblia() {
  const { color } = useChurch();
  const [t, setT] = useState<'at' | 'nt'>('nt');
  const list = t === 'at' ? BOOKS.slice(0, OT_COUNT) : BOOKS.slice(OT_COUNT);
  return (
    <Screen color={color}>
      <Chips color={color} value={t} onChange={setT} options={[{ value: 'at', label: 'Antigo Testamento' }, { value: 'nt', label: 'Novo Testamento' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map(([slug, name, chapters]) => (
          <Pressable key={slug} onPress={() => router.push({ pathname: '/biblia/[livro]', params: { livro: slug } })} accessibilityRole="button"
            style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{name}</Text>
            <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{chapters} {chapters === 1 ? 'capítulo' : 'capítulos'}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
