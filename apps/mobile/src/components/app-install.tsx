import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Bell, BellOff, CircleCheck, Smartphone } from 'lucide-react-native';

import { Button, C, Card, F, Muted } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { enablePush, promptInstall, useWebApp } from '@/lib/webapp';

/** Cartão "Instalar o app" + "Ativar notificações" (só aparece no app aberto pelo navegador). */
export function AppInstallCard({ showDone = false }: { showDone?: boolean }) {
  const { church, user, color } = useChurch();
  const w = useWebApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!w.isWeb) return null;

  const needsInstall = !w.standalone;
  const needsPush = w.subscribed === false && w.permission !== 'denied' && (w.pushOk || (w.ios && needsInstall));
  if (!needsInstall && !needsPush) {
    if (w.permission === 'denied') {
      return <Card><Title icon={<BellOff size={20} color={C.danger} />}>Notificações bloqueadas</Title><Muted>Para receber os avisos da igreja, libere as notificações do app nos ajustes do celular.</Muted></Card>;
    }
    return showDone && w.subscribed ? <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><CircleCheck size={20} color={C.ok} /><Text style={{ fontFamily: F.semibold, color: C.ok }}>App instalado e notificações ativadas</Text></Card> : null;
  }

  async function activate() {
    setBusy(true);
    setMsg(null);
    const err = await enablePush(church.id, user.id);
    setBusy(false);
    if (err) setMsg(err); else { w.setSubscribed(true); setMsg('Pronto! Você vai receber os avisos da igreja.'); }
  }

  return (
    <Card style={{ backgroundColor: C.tint, borderColor: C.tint }}>
      {needsInstall && w.ios && (
        <>
          <Title icon={<Smartphone size={20} color={color} />}>Instale o app no iPhone</Title>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: F.regular, color: C.text, lineHeight: 21 }}>1. No <Text style={{ fontFamily: F.bold }}>Safari</Text>, toque no botão Compartilhar <Text style={{ fontFamily: F.bold }}>⬆︎</Text> (embaixo da tela).</Text>
            <Text style={{ fontFamily: F.regular, color: C.text, lineHeight: 21 }}>2. Toque em <Text style={{ fontFamily: F.bold }}>“Adicionar à Tela de Início”</Text> e depois em Adicionar.</Text>
            <Text style={{ fontFamily: F.regular, color: C.text, lineHeight: 21 }}>3. Abra o app pelo ícone <Text style={{ fontFamily: F.bold }}>Comunhão</Text> e toque em <Text style={{ fontFamily: F.bold }}>Ativar notificações</Text>.</Text>
          </View>
          <Muted>No iPhone as notificações só funcionam com o app instalado (iOS 16.4 ou mais novo).</Muted>
        </>
      )}
      {needsInstall && !w.ios && (
        <>
          <Title icon={<Smartphone size={20} color={color} />}>Instale o app</Title>
          <Muted>Fica com ícone na tela do celular e abre como um aplicativo.</Muted>
          {w.canPrompt
            ? <Button title="Instalar app" color={color} onPress={() => promptInstall()} />
            : <Muted>No menu do navegador (⋮), toque em “Instalar app” ou “Adicionar à tela inicial”.</Muted>}
        </>
      )}
      {needsPush && !(w.ios && needsInstall) && (
        <>
          <Title icon={<Bell size={20} color={color} />}>Avisos da igreja</Title>
          <Muted>Receba no celular os avisos, lembretes de escala e o devocional.</Muted>
          <Button title="Ativar notificações" color={color} onPress={activate} loading={busy} />
        </>
      )}
      {msg && <Text style={{ fontFamily: F.semibold, color: msg.startsWith('Pronto') ? C.ok : C.danger }}>{msg}</Text>}
    </Card>
  );
}

function Title({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{children}</Text>
    </View>
  );
}
