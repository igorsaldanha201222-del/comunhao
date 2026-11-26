import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, C, Card, Chips, H2, Input, Muted, Screen } from '@/components/ui';
import { LOCATIONS, PRIORITIES, randomKey, uploadPhoto, type MaintPriority } from '@/lib/maintenance';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Photo = { uri: string; mime: string };
const MAX = 6;

export default function NovoChamado() {
  const { church, color } = useChurch();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<MaintPriority>('normal');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permissão negada', camera ? 'Libere a câmera nas configurações.' : 'Libere as fotos nas configurações.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: !camera, selectionLimit: MAX - photos.length };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    setPhotos((p) => [...p, ...res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' }))].slice(0, MAX));
  }

  async function send() {
    setBusy(true);
    try {
      const folder = randomKey();
      const paths: string[] = [];
      for (const p of photos) paths.push(await uploadPhoto(church.id, folder, p.uri, p.mime));
      const { error } = await supabase.from('maintenance_requests').insert({
        church_id: church.id, title: title.trim(), location: location.trim() || null, priority,
        description: description.trim() || null, photos: paths,
      });
      if (error) throw error;
      Alert.alert('Chamado enviado ✅', 'A equipe de manutenção já recebeu no quadro.');
      router.back();
    } catch (e) {
      Alert.alert('Não deu para enviar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Novo chamado" subtitle="Tire uma foto e diga o que precisa ser feito" color={color}>
      <Card>
        <H2>Fotos</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p, i) => (
            <Pressable key={p.uri} onLongPress={() => setPhotos((l) => l.filter((_, j) => j !== i))}>
              <Image source={{ uri: p.uri }} style={{ width: 92, height: 92, borderRadius: 10 }} contentFit="cover" />
            </Pressable>
          ))}
        </View>
        {photos.length > 0 && <Muted>Segure uma foto para remover.</Muted>}
        {photos.length < MAX && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="📷 Câmera" color={color} onPress={() => pick(true)} /></View>
            <View style={{ flex: 1 }}><Button title="🖼 Galeria" variant="outline" color={color} onPress={() => pick(false)} /></View>
          </View>
        )}
      </Card>

      <Card>
        <Input label="O que precisa ser feito?" value={title} onChangeText={setTitle} maxLength={120}
          placeholder="ex.: Trocar lâmpada queimada do palco" />
        <Input label="Onde?" value={location} onChangeText={setLocation} maxLength={120} placeholder="ex.: Salão social" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {LOCATIONS.map((l) => (
            <Pressable key={l} onPress={() => setLocation(l)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: location === l ? color : C.bg }}>
              <Text style={{ fontSize: 13, color: location === l ? '#fff' : C.text }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: C.muted }}>Urgência</Text>
        <Chips color={priority === 'urgente' ? C.danger : color} value={priority} onChange={setPriority} options={PRIORITIES} />
        <Input label="Detalhes (como fazer, o que comprar…)" value={description} onChangeText={setDescription} multiline maxLength={4000} />
      </Card>

      <Button title="Enviar chamado" color={color} onPress={send} loading={busy} disabled={title.trim().length < 3} />
    </Screen>
  );
}
