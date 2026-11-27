import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { AddButton, ImageField, pickImage, uploadMedia, type Picked } from '@/components/admin';
import { Button, C, Card, Empty, F, Input, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type B = { id: string; title: string; image_url: string; link_url: string | null; position: number; active: boolean };

/** Banners de destaque do site e do app. */
export default function GestaoBanners() {
  const { church, color } = useChurch();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [img, setImg] = useState<Picked>(null);
  const [busy, setBusy] = useState(false);
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('banners').select('id, title, image_url, link_url, position, active').eq('church_id', church.id).order('position').order('created_at', { ascending: false });
    return (rows ?? []) as B[];
  }, [] as B[], `gban:${church.id}`);

  async function save() {
    if (!img) return Alert.alert('Imagem', 'Escolha a imagem do banner.');
    setBusy(true);
    try {
      const image_url = await uploadMedia(church.id, 'banners', img.uri, img.mime);
      const { error } = await supabase.from('banners').insert({ church_id: church.id, title: title.trim(), image_url, link_url: link.trim() || null, position: data.length });
      if (error) throw error;
      setTitle(''); setLink(''); setImg(null); setOpen(false); reload();
    } catch (e) {
      Alert.alert('Não deu', (e as Error).message);
    } finally { setBusy(false); }
  }
  async function toggle(b: B) {
    const { error } = await supabase.from('banners').update({ active: !b.active }).eq('id', b.id);
    if (error) Alert.alert('Não deu', error.message); else reload();
  }
  function remove(b: B) {
    Alert.alert('Apagar banner?', b.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('banners').delete().eq('id', b.id);
      if (error) Alert.alert('Não deu', error.message); else reload();
    } }]);
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Banners' }} />
      {open ? (
        <Card>
          <ImageField label="Imagem (formato largo)" url={img?.uri ?? null} onPick={async () => { const p = await pickImage([16, 6]); if (p) setImg(p); }} aspect={16 / 6} />
          <Input label="Título" value={title} onChangeText={setTitle} />
          <Input label="Link ao tocar (opcional)" value={link} onChangeText={setLink} autoCapitalize="none" />
          <Button title="Publicar banner" color={color} loading={busy} disabled={title.trim().length < 2 || !img} onPress={save} />
          <Button title="Cancelar" variant="outline" onPress={() => setOpen(false)} />
        </Card>
      ) : <AddButton label="Novo banner" color={color} onPress={() => setOpen(true)} />}
      {data.length === 0 && <Empty>Nenhum banner.</Empty>}
      {data.map((b) => (
        <View key={b.id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden', opacity: b.active ? 1 : 0.55 }}>
          <Image source={b.image_url} style={{ width: '100%', aspectRatio: 16 / 6 }} contentFit="cover" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 14, color: C.text }} numberOfLines={1}>{b.title}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{b.active ? 'No ar' : 'Pausado'}</Text>
            <Switch value={b.active} onValueChange={() => toggle(b)} trackColor={{ true: color }} />
            <Pressable onPress={() => remove(b)} hitSlop={8} accessibilityLabel={`Apagar ${b.title}`}><Trash2 size={18} color={C.danger} /></Pressable>
          </View>
        </View>
      ))}
    </Screen>
  );
}
