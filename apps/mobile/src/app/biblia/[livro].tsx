import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, F } from '@/components/ui';
import { BIBLE_CREDIT, findBook } from '@/lib/bible';
import { siteBase } from '@/lib/role';
import { useChurch } from '@/lib/session';

const cache = new Map<string, string[][]>();

/** Leitura de um livro: capítulos no topo, versículos numerados, anterior/próximo. */
export default function Livro() {
  const { livro, cap } = useLocalSearchParams<{ livro: string; cap?: string }>();
  const { color } = useChurch();
  const book = findBook(livro);
  const [chapter, setChapter] = useState(Math.max(1, Number(cap) || 1));
  const [text, setText] = useState<string[][] | null>(cache.get(livro) ?? null);
  const [err, setErr] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (cache.has(livro)) return;
    fetch(`${siteBase()}/biblia/blivre/${livro}.json`).then((r) => r.json())
      .then((j: string[][]) => { cache.set(livro, j); setText(j); })
      .catch(() => setErr(true));
  }, [livro]);

  if (!book) return null;
  const total = book[2];
  const go = (n: number) => { setChapter(n); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const verses = text?.[chapter - 1] ?? [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: `${book[1]} ${chapter}` }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <Pressable key={n} onPress={() => go(n)} accessibilityRole="button" accessibilityLabel={`Capítulo ${n}`}
            style={{ minWidth: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: n === chapter ? color : C.bg }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: n === chapter ? '#fff' : C.text }}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 22, paddingBottom: 40, gap: 4, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontFamily: F.extrabold, fontSize: 26, color: C.text, marginBottom: 10 }}>{book[1]} {chapter}</Text>
        {err && <Text style={{ fontFamily: F.regular, color: C.danger }}>Não deu para carregar. Verifique a internet.</Text>}
        {!text && !err && <ActivityIndicator color={color} style={{ marginTop: 30 }} />}
        {verses.map((v, i) => (
          <Text key={i} style={{ fontFamily: F.regular, fontSize: 18, lineHeight: 30, color: C.text }}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color }}>{i + 1} </Text>{v}
          </Text>
        ))}
        {text && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            <Nav disabled={chapter <= 1} onPress={() => go(chapter - 1)} label="Anterior" left color={color} />
            <Nav disabled={chapter >= total} onPress={() => go(chapter + 1)} label="Próximo" color={color} />
          </View>
        )}
        <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 24 }}>{BIBLE_CREDIT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Nav({ label, onPress, disabled, left, color }: { label: string; onPress: () => void; disabled: boolean; left?: boolean; color: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={{ flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: disabled ? 0.35 : 1 }}>
      {left && <ChevronLeft size={18} color={color} />}
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{label}</Text>
      {!left && <ChevronRight size={18} color={color} />}
    </Pressable>
  );
}
