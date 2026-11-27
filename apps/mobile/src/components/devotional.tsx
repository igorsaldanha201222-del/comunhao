import { Image } from 'expo-image';
import { Share2 } from 'lucide-react-native';
import { Pressable, Share, Text, View } from 'react-native';

import { C, F } from '@/components/ui';

export type Devotional = {
  id: string; publish_on: string; title: string; verse_ref: string | null; verse_text: string | null;
  body: string; prayer: string | null; author: string | null; image_url: string | null;
};

export const fmtLongDay = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Devocional completo: imagem, versículo, texto, oração e compartilhar. */
export function DevotionalView({ d, color }: { d: Devotional; color: string }) {
  const share = () => Share.share({ message: `🙏 Devocional: ${d.title}${d.verse_ref ? ` (${d.verse_ref})` : ''}\n\n${d.verse_text ? `“${d.verse_text}”\n\n` : ''}${d.body}` });
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      {d.image_url ? <Image source={d.image_url} style={{ width: '100%', aspectRatio: 16 / 8 }} contentFit="cover" /> : <View style={{ height: 6, backgroundColor: color }} />}
      <View style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>Devocional · {fmtLongDay(d.publish_on)}</Text>
        <Text style={{ fontFamily: F.extrabold, fontSize: 24, lineHeight: 30, color: C.text }}>{d.title}</Text>
        {d.verse_text ? (
          <View style={{ backgroundColor: C.tint, borderLeftWidth: 4, borderLeftColor: color, borderRadius: 12, padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: F.medium, fontStyle: 'italic', fontSize: 16, lineHeight: 24, color: C.text }}>“{d.verse_text}”</Text>
            {d.verse_ref ? <Text style={{ fontFamily: F.bold, fontSize: 13, color }}>{d.verse_ref}</Text> : null}
          </View>
        ) : null}
        <Text style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 26, color: C.body }}>{d.body}</Text>
        {d.prayer ? (
          <View style={{ backgroundColor: C.accentTint, borderRadius: 12, padding: 14, gap: 4 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.accentText }}>Oração</Text>
            <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 23, color: C.text }}>{d.prayer}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>{d.author ? `Por ${d.author}` : ''}</Text>
          <Pressable onPress={share} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}>
            <Share2 size={16} color={color} />
            <Text style={{ fontFamily: F.bold, fontSize: 14, color }}>Compartilhar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
