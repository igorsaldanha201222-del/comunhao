import { router } from 'expo-router';
import { Baby, ChevronRight, Clock, LogOut, type LucideIcon, Repeat, ShieldCheck, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { AppInstallCard } from '@/components/app-install';
import { Button, C, Card, Chips, F, Input, Muted, Screen, Section, fmtDateTime } from '@/components/ui';
import { useMaintAccess } from '@/lib/maintenance';
import { roleLabel, useMe } from '@/lib/role';
import { useChurch, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const CATEGORIES = ['Saúde', 'Família', 'Casamento', 'Finanças', 'Trabalho', 'Espiritual', 'Outros'];
type Prayer = { id: string; category: string; body: string; created_at: string; prayed_at: string | null };

export default function Perfil() {
  const { church, user, color } = useChurch();
  const { selectChurch } = useSession();
  const me = useMe();
  const [category, setCategory] = useState('Saúde');
  const [body, setBody] = useState('');
  const [isPrivate, setPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const anon = !!user.is_anonymous;
  const name = (user.user_metadata?.full_name as string) ?? user.email ?? 'Você';
  const maint = useMaintAccess();

  const { data: mine, reload: load } = useData<Prayer[]>(async () => {
    const { data } = await supabase.from('prayer_requests').select('id, category, body, created_at, prayed_at')
      .eq('church_id', church.id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    return data ?? [];
  }, [], `${church.id}:${user.id}`);

  async function sendPrayer() {
    setBusy(true);
    const { error } = await supabase.from('prayer_requests').insert({
      church_id: church.id, user_id: user.id, author_name: name, category, body: body.trim(), is_private: isPrivate,
    });
    setBusy(false);
    if (error) return Alert.alert('Ops', error.message);
    setBody('');
    Alert.alert('Pedido enviado', 'A equipe de intercessão vai orar por você. 🙏');
    load();
  }

  function signOut() {
    const go = () => { selectChurch(null); supabase.auth.signOut(); };
    if (!anon) return go();
    Alert.alert('Sair da conta?', 'Você entrou sem e-mail. Se sair, não vai conseguir voltar para esta conta. Proteja com e-mail antes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair mesmo assim', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <Screen color={color}>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.extrabold, fontSize: 32, color: '#fff' }}>{(me.firstName.replace(/^(pr|pra|dr|dra|ev|ap)\.?\s+/i, '') || name).trim()[0]?.toUpperCase()}</Text>
        </View>
        <Text style={{ fontFamily: F.extrabold, fontSize: 22, color: C.text, textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, textAlign: 'center' }}>
          {[me.role && me.role !== 'member' ? roleLabel(me.role) : me.isVisitor ? 'Visitante' : 'Membro', me.employee?.job_title, church.name].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {anon && <ProtectAccount color={color} />}

      <Card style={{ padding: 0, gap: 0 }}>
        {me.employee && <MenuRow icon={Clock} label="Meu ponto" sub="Bater ponto e ver minha escala" onPress={() => router.push('/ponto')} color={color} first />}
        <MenuRow icon={Baby} label="Kids" sub="Filhos, check-in e atividades" onPress={() => router.push('/kids')} color={color} first={!me.employee} />
        {maint.request && (
          <MenuRow icon={Wrench} label="Manutenção" sub={maint.manage ? 'Ver e mover os chamados' : 'Viu algo quebrado? Abra um chamado'} onPress={() => router.push(maint.manage ? '/manutencao' : '/manutencao/novo')} color={color} />
        )}
        <MenuRow icon={Repeat} label="Trocar de igreja" onPress={() => selectChurch(null)} color={color} />
      </Card>

      <AppInstallCard showDone />

      <Section title="Pedido de oração">
        <Card>
          <Chips color={color} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <Input label="Como podemos orar por você?" value={body} onChangeText={setBody} multiline maxLength={1000} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text }}>Só a liderança pode ver</Text>
            <Switch value={isPrivate} onValueChange={setPrivate} trackColor={{ true: color }} />
          </View>
          <Button title="Enviar pedido" color={color} onPress={sendPrayer} loading={busy} disabled={body.trim().length < 5} />
        </Card>
      </Section>

      {mine.length > 0 && (
        <Section title="Meus pedidos">
          <Card style={{ padding: 0, gap: 0 }}>
            {mine.map((p, i) => (
              <View key={p.id} style={{ padding: 16, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: '#eef1ed' }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>{p.category} · {fmtDateTime(p.created_at)}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.text }} numberOfLines={2}>{p.body}</Text>
                {p.prayed_at && <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.ok }}>A igreja orou por você 🙏</Text>}
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Pressable onPress={signOut} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 50, opacity: pressed ? 0.6 : 1 })}>
        <LogOut size={18} color={C.danger} />
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.danger }}>Sair</Text>
      </Pressable>
    </Screen>
  );
}

function MenuRow({ icon: Icon, label, sub, onPress, color, first }: { icon: LucideIcon; label: string; sub?: string; onPress: () => void; color: string; first?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: '#eef1ed', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color="#9aa39d" />
    </Pressable>
  );
}

/** Visitante que entrou sem e-mail: coloca e-mail e senha para não perder a conta. */
function ProtectAccount({ color }: { color: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) return Alert.alert('Não deu para salvar', error.message.includes('registered') ? 'Esse e-mail já tem conta. Use outro.' : error.message);
    setSent(true);
  }

  return (
    <View style={{ backgroundColor: C.accentTint, borderRadius: 20, padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={20} color={C.accentText} />
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Proteja sua conta</Text>
      </View>
      {sent ? (
        <Muted>Enviamos um link para {email}. Abra o e-mail e confirme: depois você entra com e-mail e senha em qualquer celular.</Muted>
      ) : (
        <>
          <Muted>Você entrou sem senha. Coloque um e-mail e uma senha para não perder o acesso se trocar de celular.</Muted>
          <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Senha (mínimo 6)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Button title="Proteger minha conta" color={color} loading={busy} disabled={!email.includes('@') || password.length < 6} onPress={save} />
        </>
      )}
    </View>
  );
}
