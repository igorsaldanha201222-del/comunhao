import { Stack, router, type Href } from 'expo-router';
import {
  Baby, CalendarDays, Church, ClipboardCheck, Clock, Contact, Footprints, HandHeart, Image as ImageIcon, Layers, Megaphone, Mic, Radio,
  Sun, Sunrise, TrendingUp, Users, Wrench, type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { HubItem } from '@/components/admin';
import { C, F, Screen } from '@/components/ui';
import { useMe } from '@/lib/role';
import { useChurch } from '@/lib/session';

type Item = { icon: LucideIcon; label: string; sub: string; href: Href; who: 'staff' | 'finance' | 'admin' };
const GROUPS: [string, Item[]][] = [
  ['Pessoas', [
    { icon: Contact, label: 'Pessoas', sub: 'Membros e visitantes', href: '/pessoas', who: 'staff' },
    { icon: Users, label: 'Visitantes', sub: 'Quem chegou e o contato', href: '/visitantes', who: 'staff' },
    { icon: Footprints, label: 'Novos membros', sub: 'Trilha: conversa, NCC, apresentação', href: '/gestao/membresia', who: 'staff' },
    { icon: HandHeart, label: 'Pedidos de oração', sub: 'Orar e marcar', href: '/gestao/oracoes', who: 'staff' },
  ]],
  ['Cultos e ministérios', [
    { icon: Church, label: 'Cultos e presença', sub: 'Criar culto, chamada, contagem', href: '/gestao/cultos', who: 'staff' },
    { icon: ClipboardCheck, label: 'Chamada', sub: 'Presença do culto', href: '/chamada', who: 'staff' },
    { icon: Layers, label: 'Ministérios', sub: 'Equipes e líderes', href: '/ministerios', who: 'staff' },
    { icon: Megaphone, label: 'Enviar aviso', sub: 'Notificação no celular', href: '/aviso', who: 'staff' },
  ]],
  ['Conteúdo', [
    { icon: CalendarDays, label: 'Eventos', sub: 'Criar, inscritos, check-in', href: '/gestao/eventos', who: 'staff' },
    { icon: Radio, label: 'Ao vivo', sub: 'Ligar a transmissão', href: '/gestao/aovivo', who: 'staff' },
    { icon: Mic, label: 'Pregações', sub: 'Vídeos e áudios', href: '/gestao/pregacoes', who: 'staff' },
    { icon: Sunrise, label: 'Devocionais', sub: 'Escrever e agendar', href: '/gestao/devocionais', who: 'staff' },
    { icon: ImageIcon, label: 'Banners', sub: 'Destaques do site', href: '/gestao/banners', who: 'staff' },
  ]],
  ['Finanças e equipe', [
    { icon: TrendingUp, label: 'Financeiro', sub: 'Saldo, lançamentos, contas', href: '/financeiro', who: 'finance' },
    { icon: Clock, label: 'Quem está trabalhando', sub: 'Ponto da equipe', href: '/equipe', who: 'staff' },
  ]],
  ['Igreja', [
    { icon: Baby, label: 'Kids', sub: 'Crianças e check-in', href: '/kids', who: 'staff' },
    { icon: Wrench, label: 'Manutenção', sub: 'Chamados', href: '/manutencao', who: 'staff' },
    { icon: Sun, label: 'Energia solar', sub: 'Geração e alertas', href: '/energia', who: 'staff' },
  ]],
];

export default function Gestao() {
  const { color } = useChurch();
  const me = useMe();
  const isAdmin = me.role === 'owner' || me.role === 'admin';
  const can = (w: Item['who']) => (w === 'admin' ? isAdmin : w === 'finance' ? me.canFinance : me.isStaff);

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: 'Administração' }} />
      {GROUPS.map(([title, items]) => {
        const list = items.filter((i) => can(i.who));
        if (!list.length) return null;
        return (
          <View key={title} style={{ gap: 10, marginBottom: 6 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {list.map((i) => <HubItem key={i.label} icon={i.icon} label={i.label} sub={i.sub} color={color} onPress={() => router.push(i.href)} />)}
            </View>
          </View>
        );
      })}
      {!me.isStaff && !me.canFinance && <Text style={{ fontFamily: F.regular, color: C.muted }}>A administração é só para a liderança.</Text>}
    </Screen>
  );
}
