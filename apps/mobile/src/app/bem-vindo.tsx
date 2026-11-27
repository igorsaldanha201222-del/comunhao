import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, CircleCheck, HandHeart, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, C, Chips, F, Input } from '@/components/ui';
import { useSession, type Church } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Welcome = Church & { hero_url: string | null; tagline: string | null };
const HOW = ['Amigo ou família', 'Instagram', 'Passando na rua', 'Google', 'Outro'] as const;
const GREEN = '#007a3d';

/** Tela aberta pelo QR Code da entrada: o visitante se cadastra em 1 minuto e já entra no app. */
export default function BemVindo() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const slug = (c ?? '').toLowerCase();
  const { session, selectChurch } = useSession();
  const insets = useSafeAreaInsets();
  const { data: church } = useData(async () => {
    const { data } = await supabase.rpc('church_welcome', { p_slug: slug });
    return ((data ?? []) as Welcome[])[0] ?? null;
  }, null as Welcome | null, `welcome:${slug}`);

  // Quem já é da igreja (ex.: membro clicando em "Quero ser membro" no site) vai direto para o app.
  useEffect(() => {
    if (!session || !church) return;
    supabase.from('memberships').select('church_id').eq('user_id', session.user.id).eq('church_id', church.id).maybeSingle()
      .then(({ data }) => { if (data) { selectChurch(church); router.replace('/'); } });
  }, [session, church, selectChurch]);

  const metaName = (session?.user.user_metadata?.full_name as string | undefined) ?? '';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [how, setHow] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const shownName = name || metaName;

  async function submit() {
    setErr('');
    if (shownName.trim().length < 2) return setErr('Digite seu nome.');
    if (!church) return;
    setBusy(true);
    try {
      if (!session) {
        // Conta sem e-mail e sem senha: a sessão fica guardada neste celular.
        const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: shownName.trim(), phone: phone.trim() || null } } });
        if (error) throw new Error(error.message.toLowerCase().includes('anonymous') ? 'Cadastro rápido ainda não liberado pela igreja. Peça ajuda na recepção.' : error.message);
      }
      const { data, error } = await supabase.rpc('welcome_visit', { p_slug: slug, p_name: shownName.trim(), p_phone: phone, p_how: how || null });
      if (error) throw error;
      const ch = data as Church;
      selectChurch({ id: ch.id, slug: ch.slug, name: ch.name, logo_url: ch.logo_url, primary_color: ch.primary_color });
      setDone(shownName.trim().split(/\s+/)[0]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!slug || church === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.muted, textAlign: 'center' }}>
          {slug ? 'Carregando…' : 'Aponte a câmera para o QR Code da entrada da igreja.'}
        </Text>
      </View>
    );
  }

  const hero = (
    <View style={{ backgroundColor: C.dark, paddingTop: insets.top + 36, paddingBottom: 44, paddingHorizontal: 24, alignItems: 'center', gap: 14 }}>
      {church.hero_url ? <Image source={church.hero_url} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(7, 22, 14, 0.9)' }} />
      {church.logo_url
        ? <Image source={church.logo_url} style={{ width: 170, height: 120 }} contentFit="contain" accessibilityLabel={church.name} />
        : <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: '#fff' }}>{church.name}</Text>}
      <Text style={{ fontFamily: F.extrabold, fontSize: 30, color: '#fff', textAlign: 'center', letterSpacing: -0.5 }}>
        {done ? `Prontinho, ${done}!` : 'Seja bem-vindo!'}
      </Text>
      <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
        {done ? 'Sua visita está registrada. Que alegria ter você aqui hoje!' : 'Que alegria ter você aqui. Deixe seu contato e acompanhe a igreja pelo celular.'}
      </Text>
    </View>
  );

  if (done) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        {hero}
        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18, gap: 14 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>No app você tem</Text>
            {[
              { icon: BookOpen, t: 'Bíblia e devocional do dia' },
              { icon: Video, t: 'Cultos ao vivo e pregações' },
              { icon: HandHeart, t: 'Pedido de oração' },
              { icon: CircleCheck, t: 'Sua jornada para fazer parte da família' },
            ].map(({ icon: Icon, t }) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={GREEN} strokeWidth={1.8} />
                </View>
                <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text, flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
          <Button title="Entrar no app" color={GREEN} onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {hero}
        <View style={{ padding: 20, gap: 14, marginTop: -24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, gap: 14, shadowColor: '#14201a', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
            <Input label="Seu nome" value={shownName} onChangeText={setName} autoComplete="name" maxLength={120} placeholder="Como podemos te chamar?" />
            <Input label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={20} placeholder="(85) 9 0000-0000" />
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.body }}>Como conheceu a igreja?</Text>
            <Chips color={GREEN} value={how} onChange={setHow} options={HOW.map((h) => ({ value: h, label: h }))} />
            {err ? <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.danger }}>{err}</Text> : null}
            <Button title="Entrar no app" color={GREEN} loading={busy} onPress={submit} />
            <Text style={{ fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: C.muted, textAlign: 'center' }}>
              Sem senha para lembrar. Usamos seu contato só para falar com você sobre a igreja.
            </Text>
          </View>
          {!session && (
            <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={{ padding: 10 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text, textAlign: 'center' }}>Já tenho conta. Entrar</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
