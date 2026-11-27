import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowRight, Baby, BookOpen, Calendar, ChevronRight, ClipboardCheck, HeartHandshake, MapPin, Megaphone, Play,
  Sunrise, TrendingUp, Users, Video,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppInstallCard } from '@/components/app-install';
import { Button, C, Card, F, Muted, Screen, Section, Tile, fmtDateTime } from '@/components/ui';
import { todayService } from '@/lib/checkin';
import { loadJourney, stepsDone } from '@/lib/journey';
import { roleLabel, siteBase, useMe } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

const TRAIL = ['Conversa', 'Curso NCC', 'Apresentação', 'Membro'];

type Sermon = { id: string; title: string; preacher: string | null; video_url: string | null; audio_url: string | null; preached_at: string };
type Notice = { id: string; title: string; body: string; sent_at: string };
type Ev = { id: string; title: string; starts_at: string; location: string | null; cover_url: string | null };
type Devo = { id: string; title: string; verse_ref: string | null; body: string };
type Home = {
  brand: { hero_url?: string | null; logo_url?: string | null; tagline?: string | null };
  sermon: Sermon | null; notices: Notice[]; events: Ev[]; devo: Devo | null;
};

const ytId = (u: string | null) => u?.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const greeting = () => {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
const evDay = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' })
  .replace('.', '').toUpperCase();
const evHour = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':00', 'h');
const open = (url: string) => WebBrowser.openBrowserAsync(url);

export default function Inicio() {
  const { church, color, user, personId } = useChurch();
  const me = useMe();
  const insets = useSafeAreaInsets();
  const site = `${siteBase()}/i/${church.slug}`;

  const { data, refresh, refreshing } = useData<Home>(async () => {
    const [c, s, n, e, d] = await Promise.all([
      supabase.from('churches').select('hero_url, logo_url, tagline').eq('id', church.id).maybeSingle(),
      supabase.from('sermons').select('id, title, preacher, video_url, audio_url, preached_at').eq('church_id', church.id).order('preached_at', { ascending: false }).limit(1),
      supabase.from('notifications').select('id, title, body, sent_at').eq('church_id', church.id).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(2),
      supabase.from('events').select('id, title, starts_at, location, cover_url').eq('church_id', church.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(6),
      supabase.from('devotionals').select('id, title, verse_ref, body').eq('church_id', church.id).eq('published', true).lte('publish_on', todayBR())
        .order('publish_on', { ascending: false }).limit(1),
    ]);
    return {
      brand: (c.data ?? {}) as { hero_url?: string | null; logo_url?: string | null; tagline?: string | null },
      sermon: ((s.data ?? []) as Sermon[])[0] ?? (null as Sermon | null),
      notices: (n.data ?? []) as Notice[],
      events: (e.data ?? []) as Ev[],
      devo: ((d.data ?? []) as Devo[])[0] ?? (null as Devo | null),
    };
  }, { brand: {}, sermon: null as Sermon | null, notices: [] as Notice[], events: [] as Ev[], devo: null as Devo | null }, church.id);
  const { brand, sermon, notices, events, devo } = data;

  const { data: trail } = useData(() => loadJourney(church.id, user.id),
    { journey: null, isMember: false, phone: '', lessons: [], attended: [] }, `trail:${church.id}:${user.id}`);
  const { data: culto, refresh: refreshCulto } = useData(() => todayService(church.id, personId), null, `culto:${church.id}:${personId}`);

  // Números da liderança (só carrega para quem é da liderança)
  const { data: stats } = useData(async () => {
    if (!me.isStaff) return null;
    const monthStart = todayBR().slice(0, 8) + '01';
    const [v, j] = await Promise.all([
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', church.id).eq('status', 'visitante').gte('created_at', monthStart),
      supabase.from('member_journeys').select('id', { count: 'exact', head: true }).eq('church_id', church.id).neq('step', 'concluido').eq('gave_up', false),
    ]);
    return { visitors: v.count ?? 0, trail: j.count ?? 0 };
  }, null, `stats:${church.id}:${me.isStaff}`);

  const tj = trail.journey;
  // Trilha de membro: só para quem ainda não serve na igreja (liderança e tesouraria já são da casa).
  const showJourney = !trail.isMember && !me.isStaff && !me.canFinance && (me.isVisitor || !!tj || me.role === 'member');
  const done = tj ? stepsDone(tj) : 0;

  const header = (
    <View style={{ minHeight: 300 + insets.top, backgroundColor: C.dark }}>
      {brand.hero_url ? <Image source={brand.hero_url} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(7, 22, 14, 0.9)' }} />
      <View style={{ paddingTop: insets.top + 28, paddingHorizontal: 20, paddingBottom: culto ? 56 : 32, gap: 22 }}>
        {brand.logo_url
          ? <Image source={brand.logo_url} style={{ width: 120, height: 76 }} contentFit="contain" contentPosition="left" accessibilityLabel={church.name} />
          : <Text style={{ fontFamily: F.extrabold, fontSize: 18, color: '#fff' }}>{church.name}</Text>}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{greeting()},</Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 32, color: '#fff', letterSpacing: -0.5 }} numberOfLines={1}>{me.firstName || 'bem-vindo'}</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            {me.role && me.role !== 'member' ? `${roleLabel(me.role)} · ` : ''}{brand.tagline ?? church.name}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Screen header={header} color={color} refreshing={refreshing} onRefresh={() => { refresh(); refreshCulto(); }}>
      {culto && (
        <Card style={{ marginTop: -32, borderWidth: 0, shadowColor: '#14201a', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={22} color={color} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.accentText, textTransform: 'uppercase', letterSpacing: 0.6 }}>Hoje</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{culto.title}</Text>
            </View>
          </View>
          {culto.present
            ? <Text style={{ fontFamily: F.semibold, color: C.ok }}>✓ Sua presença está confirmada</Text>
            : <Button title="Estou no culto" color={color} onPress={() => router.push({ pathname: '/presenca', params: { s: culto.id } })} />}
        </Card>
      )}

      {(me.isStaff || me.canFinance) && (
        <Section title={me.isStaff ? 'Sua igreja hoje' : 'Tesouraria'}>
          {me.isStaff && <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>Visitantes no mês</Text>
              <Text style={{ fontFamily: F.extrabold, fontSize: 28, color: C.text }}>{stats?.visitors ?? '–'}</Text>
            </Card>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>Na trilha de membro</Text>
              <Text style={{ fontFamily: F.extrabold, fontSize: 28, color: C.text }}>{stats?.trail ?? '–'}</Text>
            </Card>
          </View>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {me.canFinance && <QuickAction label="Financeiro" icon={TrendingUp} color={color} solid onPress={() => router.push('/financeiro')} />}
            {me.canFinance && <QuickAction label="Lançar" icon={HeartHandshake} color={color} onPress={() => router.push('/financeiro/novo')} />}
            {me.isStaff && <QuickAction label="Abrir chamada" icon={ClipboardCheck} color={color} solid={!me.canFinance} onPress={() => router.push('/chamada')} />}
            {me.isStaff && <QuickAction label="Enviar aviso" icon={Megaphone} color={color} onPress={() => router.push('/aviso')} />}
          </View>
        </Section>
      )}

      {showJourney && (
        <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 22, gap: 14, marginTop: culto ? 6 : 0 }}>
          <Text style={{ alignSelf: 'flex-start', fontFamily: F.bold, fontSize: 12, color: C.text, backgroundColor: C.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' }}>
            {tj ? `Passo ${Math.min(done + 1, 4)} de 4` : 'Próximo passo'}
          </Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 22, lineHeight: 28, color: '#fff' }}>
            {tj ? 'Sua jornada para ser membro' : `Quer fazer parte da família ${church.name.split(' ')[0]}?`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {TRAIL.map((st, i) => (
              <View key={st} style={{ flex: 1, gap: 6 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: i < done ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                <Text style={{ fontFamily: F.semibold, fontSize: 11, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{st}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => router.push('/membro')} accessibilityRole="button"
            style={({ pressed }) => ({ height: 50, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ fontFamily: F.extrabold, fontSize: 15, color: C.dark }}>{tj ? 'Ver minha trilha' : 'Quero ser membro'}</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 6 }}>
        <Tile icon={BookOpen} label="Bíblia" color={color} onPress={() => open(`${site}/biblia`)} />
        <Tile icon={Video} label="Ao vivo" color={color} onPress={() => open(`${site}/aovivo`)} />
        <Tile icon={Sunrise} label="Devocional" color={color} onPress={() => open(`${site}/devocional`)} />
        <Tile icon={Baby} label="Kids" color={color} onPress={() => router.push('/kids')} />
        <Tile icon={Calendar} label="Agenda" color={color} onPress={() => router.push('/agenda')} />
        <Tile icon={Users} label="Escalas" color={color} onPress={() => router.push('/escalas')} />
        <Tile icon={HeartHandshake} label="Contribuir" color={color} onPress={() => router.push('/contribuir')} />
        <Tile icon={MapPin} label="Presença" color={color} onPress={() => router.push('/presenca')} />
      </View>

      <AppInstallCard />

      {notices.length > 0 && (
        <Section title="Avisos">
          {notices.map((n) => (
            <Card key={n.id} style={{ gap: 6 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{n.title}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: C.body }}>{n.body}</Text>
              <Muted>{fmtDateTime(n.sent_at)}</Muted>
            </Card>
          ))}
        </Section>
      )}

      {devo && (
        <Section title="Devocional de hoje" action="Ver todos" onAction={() => open(`${site}/devocional`)}>
          <Card>
            {devo.verse_ref ? (
              <Text style={{ alignSelf: 'flex-start', fontFamily: F.bold, fontSize: 12, color, backgroundColor: C.tint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' }}>{devo.verse_ref}</Text>
            ) : null}
            <Text style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 24, color: C.text }}>{devo.title}</Text>
            <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.body }} numberOfLines={3}>{devo.body}</Text>
            <Pressable onPress={() => open(`${site}/devocional/${devo.id}`)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color }}>Ler devocional</Text>
              <ArrowRight size={16} color={color} strokeWidth={2} />
            </Pressable>
          </Card>
        </Section>
      )}

      {events.length > 0 && (
        <Section title="Próximos eventos" action="Agenda" onAction={() => router.push('/agenda')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
            {events.map((ev, i) => (
              <Pressable key={ev.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: ev.id } })} accessibilityRole="button"
                style={{ width: 240, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ height: 110, backgroundColor: i % 2 ? C.accentText : C.dark, justifyContent: 'flex-end', padding: 14 }}>
                  {ev.cover_url ? <Image source={ev.cover_url} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
                  <Text style={{ alignSelf: 'flex-start', fontFamily: F.bold, fontSize: 12, color: C.text, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' }}>
                    {evDay(ev.starts_at)} · {evHour(ev.starts_at)}
                  </Text>
                </View>
                <View style={{ padding: 14, gap: 4 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={1}>{ev.title}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }} numberOfLines={1}>{ev.location ?? 'Na igreja'}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      {sermon && (
        <Section title="Última pregação">
          <Pressable onPress={() => { const u = sermon.video_url ?? sermon.audio_url; if (u) open(u); }} accessibilityRole="button"
            style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 12, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 88, height: 88, borderRadius: 14, backgroundColor: C.text, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {ytId(sermon.video_url) ? <Image source={`https://i.ytimg.com/vi/${ytId(sermon.video_url)}/hqdefault.jpg`} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={16} color={C.text} fill={C.text} />
              </View>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={2}>{sermon.title}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }} numberOfLines={1}>
                {[sermon.preacher, new Date(sermon.preached_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <ChevronRight size={18} color="#9aa39d" />
          </Pressable>
        </Section>
      )}
    </Screen>
  );
}

function QuickAction({ label, icon: Icon, color, solid, onPress }: {
  label: string; icon: typeof Users; color: string; solid?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({
        flexGrow: 1, flexBasis: '45%', height: 52, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: solid ? color : C.card, borderWidth: solid ? 0 : 1, borderColor: C.line, opacity: pressed ? 0.85 : 1,
      })}>
      <Icon size={18} color={solid ? '#fff' : C.text} strokeWidth={2} />
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: solid ? '#fff' : C.text }}>{label}</Text>
    </Pressable>
  );
}
