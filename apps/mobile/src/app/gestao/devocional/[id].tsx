import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { brToISO, DeleteButton, goBack, ImageField, isoToBR, pickImage, todayISO, Toggle, uploadMedia, type Picked } from '@/components/admin';
import { Button, Card, Input, Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const EMPTY = { title: '', date: isoToBR(todayISO()), verse_ref: '', verse_text: '', body: '', prayer: '', author: '', image_url: null as string | null, published: true };

/** Escrever/editar devocional (id = "novo" para criar). */
export default function EditarDevocional() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'novo';
  const { church, user, color } = useChurch();
  const [f, setF] = useState(EMPTY);
  const [img, setImg] = useState<Picked>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (isNew) return;
    supabase.from('devotionals').select('*').eq('id', id).maybeSingle().then(({ data: d }) => {
      if (d) setF({ title: d.title, date: isoToBR(d.publish_on), verse_ref: d.verse_ref ?? '', verse_text: d.verse_text ?? '', body: d.body, prayer: d.prayer ?? '', author: d.author ?? '', image_url: d.image_url, published: d.published });
    });
  }, [id, isNew]);

  async function save() {
    const day = brToISO(f.date);
    if (!day) return Alert.alert('Data', 'Use dia/mês/ano.');
    setBusy(true);
    try {
      const image_url = img ? await uploadMedia(church.id, 'devocional', img.uri, img.mime) : f.image_url;
      const row = {
        church_id: church.id, title: f.title.trim(), publish_on: day, verse_ref: f.verse_ref.trim() || null, verse_text: f.verse_text.trim() || null,
        body: f.body.trim(), prayer: f.prayer.trim() || null, author: f.author.trim() || null, image_url, published: f.published, updated_at: new Date().toISOString(),
      };
      const { error } = isNew
        ? await supabase.from('devotionals').insert({ ...row, created_by: user.id })
        : await supabase.from('devotionals').update(row).eq('id', id);
      if (error) throw error;
      goBack('/gestao/devocionais');
    } catch (e) {
      Alert.alert('Não deu para salvar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: isNew ? 'Novo devocional' : 'Editar devocional' }} />
      <Card>
        <Input label="Título" value={f.title} onChangeText={set('title')} />
        <Input label="Publicar no dia" value={f.date} onChangeText={set('date')} placeholder="dd/mm/aaaa" />
        <Input label="Referência do versículo" value={f.verse_ref} onChangeText={set('verse_ref')} placeholder="Salmos 23:1" />
        <Input label="Texto do versículo" value={f.verse_text} onChangeText={set('verse_text')} multiline />
        <Input label="Mensagem" value={f.body} onChangeText={set('body')} multiline />
        <Input label="Oração (opcional)" value={f.prayer} onChangeText={set('prayer')} multiline />
        <Input label="Autor (opcional)" value={f.author} onChangeText={set('author')} />
        <ImageField label="Imagem (opcional)" url={img?.uri ?? f.image_url} onPick={async () => { const p = await pickImage([16, 8]); if (p) setImg(p); }}
          onClear={() => { setImg(null); setF((o) => ({ ...o, image_url: null })); }} />
        <Toggle label="Publicado" hint="Desligado = rascunho, ninguém vê" value={f.published} onChange={(v) => setF((o) => ({ ...o, published: v }))} color={color} />
        <Button title="Salvar devocional" color={color} loading={busy} disabled={f.title.trim().length < 3 || !f.body.trim()} onPress={save} />
      </Card>
      {!isNew && <DeleteButton what="devocional" fallback="/gestao/devocionais" onDelete={async () => supabase.from('devotionals').delete().eq('id', id)} />}
    </Screen>
  );
}
