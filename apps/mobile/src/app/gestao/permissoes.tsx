import { Stack } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { Toggle } from '@/components/admin';
import { C, Card, Chips, Empty, F, Input, Muted, Screen } from '@/components/ui';
import { roleLabel, siteBase, type Role } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type T = { user_id: string; role: Role; maint_request: boolean; maint_manage: boolean; name: string; email: string | null };
const ORDER: Role[] = ['owner', 'admin', 'leader', 'treasurer', 'member'];
const EDITABLE: Role[] = ['admin', 'leader', 'treasurer', 'member'];

/** Equipe e permissões: quem acessa o quê. Só administradores alteram. */
export default function Permissoes() {
  const { church, user, color } = useChurch();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, setData } = useData(async () => {
    const { data: m } = await supabase.from('memberships').select('user_id, role, maint_request, maint_manage').eq('church_id', church.id);
    const ids = (m ?? []).map((x) => x.user_id);
    const { data: p } = ids.length ? await supabase.from('people').select('user_id, full_name, email').eq('church_id', church.id).in('user_id', ids) : { data: [] };
    const by = new Map((p ?? []).map((x) => [x.user_id, x]));
    return ((m ?? []) as Omit<T, 'name' | 'email'>[])
      .map((x) => ({ ...x, name: by.get(x.user_id)?.full_name ?? 'Sem cadastro', email: by.get(x.user_id)?.email ?? null }))
      .sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [] as T[], `perm:${church.id}`);

  async function update(t: T, patch: Partial<Pick<T, 'role' | 'maint_request' | 'maint_manage'>>) {
    const before = data;
    setData(data.map((x) => (x.user_id === t.user_id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('memberships').update(patch).eq('church_id', church.id).eq('user_id', t.user_id);
    if (error) { setData(before); Alert.alert('Não deu', error.message); }
  }
  const invite = `${siteBase()}/app/bem-vindo?c=${church.slug}`;
  const list = data.filter((t) => !q || `${t.name} ${t.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Equipe e permissões' }} />
      <Card>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>Quem acessa o quê</Text>
        <Muted>Administração: tudo. Liderança: tudo menos o financeiro. Tesouraria: só o financeiro. Membro: só o app.</Muted>
        <Pressable onPress={() => Share.share({ message: `Entre no app da ${church.name}: ${invite}` })} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <Share2 size={18} color={color} />
          <Text style={{ fontFamily: F.bold, fontSize: 14, color }}>Convidar alguém para o app</Text>
        </Pressable>
      </Card>
      <Input label="Buscar" value={q} onChangeText={setQ} placeholder="Nome ou e-mail" />
      {list.length === 0 && <Empty>Ninguém encontrado.</Empty>}
      {list.map((t) => {
        const editable = t.role !== 'owner' && t.user_id !== user.id;
        const isOpen = open === t.user_id;
        return (
          <Card key={t.user_id}>
            <Pressable onPress={() => editable && setOpen(isOpen ? null : t.user_id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{t.name}</Text>
                {t.email ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{t.email}</Text> : null}
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: t.role === 'member' ? C.muted : color }}>
                {roleLabel(t.role)}{t.maint_manage ? ' · manutenção' : ''}
              </Text>
            </Pressable>
            {isOpen && (
              <View style={{ gap: 10 }}>
                <Chips color={color} value={t.role} onChange={(r) => update(t, { role: r as Role })} options={EDITABLE.map((r) => ({ value: r, label: roleLabel(r) }))} />
                <Toggle label="Abre chamados de manutenção" value={t.maint_request} color={color} onChange={(x) => update(t, { maint_request: x })} />
                <Toggle label="Cuida da manutenção" value={t.maint_manage} color={color} onChange={(x) => update(t, { maint_manage: x })} />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
