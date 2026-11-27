import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { ChevronRight, ImagePlus, Plus, Trash2, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { C, F } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------- datas (fuso de Brasília, sem horário de verão)
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
/** dd/mm/aaaa → aaaa-mm-dd (ou null). */
export function brToISO(v: string) {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
export const isoToBR = (v: string | null | undefined) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '');
/** dd/mm/aaaa + hh:mm (Brasília) → ISO com fuso. */
export function brDateTimeToISO(d: string, t: string) {
  const day = brToISO(d);
  const m = t.trim().match(/^(\d{1,2}):?(\d{2})?$/);
  if (!day || !m) return null;
  return `${day}T${m[1].padStart(2, '0')}:${m[2] ?? '00'}:00-03:00`;
}
export const isoToBRTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '';
export const isoToBRDateTZ = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';

/** Volta para a tela anterior; se a tela foi aberta direto (link), vai para `fallback`. */
export function goBack(fallback: Href = '/gestao') {
  if (router.canGoBack()) router.back(); else router.replace(fallback);
}

// ---------------------------------------------------------------- arquivos
/** Sobe uma imagem para o bucket público `media` e devolve o endereço público. */
export async function uploadMedia(churchId: string, folder: string, uri: string, mime = 'image/jpeg') {
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${churchId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('media').upload(path, body, { contentType: mime });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export type Picked = { uri: string; mime: string } | null;
export async function pickImage(aspect?: [number, number]): Promise<Picked> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: !!aspect, aspect });
  return res.canceled ? null : { uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' };
}

// ---------------------------------------------------------------- componentes
export function ImageField({ label, url, onPick, onClear, aspect = 16 / 8 }: { label: string; url: string | null; onPick: () => void; onClear?: () => void; aspect?: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>{label}</Text>
      <Pressable onPress={onPick} accessibilityRole="button" accessibilityLabel={label}
        style={{ width: '100%', aspectRatio: aspect, borderRadius: 14, overflow: 'hidden', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderStyle: url ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <Image source={url} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : (
          <View style={{ alignItems: 'center', gap: 6 }}><ImagePlus size={26} color={C.muted} /><Text style={{ fontFamily: F.medium, color: C.muted }}>Escolher imagem</Text></View>
        )}
      </Pressable>
      {url && onClear ? <Pressable onPress={onClear} hitSlop={6}><Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.danger }}>Tirar imagem</Text></Pressable> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, color, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; color: string; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: color }} />
    </View>
  );
}

/** Caixa de lista com linhas separadas por fio. */
export function List({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>{children}</View>;
}

export function Row({ title, sub, right, onPress, first, left }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void; first?: boolean; left?: ReactNode }) {
  const body = (
    <>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color="#9aa39d" /> : null)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: first ? 0 : 1, borderTopColor: '#eef1ed' };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [style, { backgroundColor: pressed ? C.bg : C.card }]}>{body}</Pressable>
  ) : <View style={style}>{body}</View>;
}

/** Botão "+ Novo …" no topo das listas. */
export function AddButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: color, opacity: pressed ? 0.85 : 1 })}>
      <Plus size={20} color="#fff" />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}

/** Apagar com confirmação; volta para a tela anterior ao terminar. */
export function DeleteButton({ what, onDelete, fallback }: { what: string; onDelete: () => Promise<{ error: { message: string } | null }>; fallback?: Href }) {
  return (
    <Pressable accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
      onPress={() => Alert.alert(`Apagar ${what}?`, 'Não dá para desfazer.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: async () => {
          const { error } = await onDelete();
          if (error) Alert.alert('Não deu', error.message); else goBack(fallback);
        } },
      ])}>
      <Trash2 size={18} color={C.danger} />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.danger }}>Apagar {what}</Text>
    </Pressable>
  );
}

/** Quadradinho de ícone usado no menu de administração. */
export function HubItem({ icon: Icon, label, sub, onPress, color }: { icon: LucideIcon; label: string; sub?: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} strokeWidth={1.9} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: F.regular, fontSize: 11, color: C.muted }} numberOfLines={2}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
