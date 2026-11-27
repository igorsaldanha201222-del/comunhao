import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, C, Card, H2, Muted } from '@/components/ui';
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
      return <Card><H2>🔕 Notificações bloqueadas</H2><Muted>Para receber os avisos da igreja, libere as notificações do app nos ajustes do celular.</Muted></Card>;
    }
    return showDone && w.subscribed ? <Card><Text style={{ color: C.ok, fontWeight: '600' }}>✅ App instalado e notificações ativadas</Text></Card> : null;
  }

  async function activate() {
    setBusy(true);
    setMsg(null);
    const err = await enablePush(church.id, user.id);
    setBusy(false);
    if (err) setMsg(err); else { w.setSubscribed(true); setMsg('🔔 Pronto! Você vai receber os avisos da igreja.'); }
  }

  return (
    <Card style={{ borderColor: color, borderWidth: 2 }}>
      {needsInstall && w.ios && (
        <>
          <H2>📲 Instale o app no iPhone</H2>
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.text }}>1. No <Text style={{ fontWeight: '700' }}>Safari</Text>, toque no botão Compartilhar <Text style={{ fontWeight: '700' }}>⬆︎</Text> (embaixo da tela).</Text>
            <Text style={{ color: C.text }}>2. Toque em <Text style={{ fontWeight: '700' }}>“Adicionar à Tela de Início”</Text> e depois em Adicionar.</Text>
            <Text style={{ color: C.text }}>3. Abra o app pelo ícone <Text style={{ fontWeight: '700' }}>Comunhão</Text> e toque em <Text style={{ fontWeight: '700' }}>Ativar notificações</Text>.</Text>
          </View>
          <Muted>No iPhone as notificações só funcionam com o app instalado (iOS 16.4 ou mais novo).</Muted>
        </>
      )}
      {needsInstall && !w.ios && (
        <>
          <H2>📲 Instale o app</H2>
          <Muted>Fica com ícone na tela do celular e abre como um aplicativo.</Muted>
          {w.canPrompt
            ? <Button title="Instalar app" color={color} onPress={() => promptInstall()} />
            : <Muted>No menu do navegador (⋮), toque em “Instalar app” ou “Adicionar à tela inicial”.</Muted>}
        </>
      )}
      {needsPush && !(w.ios && needsInstall) && (
        <>
          <H2>🔔 Avisos da igreja</H2>
          <Muted>Receba no celular os avisos, lembretes de escala e o devocional.</Muted>
          <Button title="Ativar notificações" color={color} onPress={activate} loading={busy} />
        </>
      )}
      {msg && <Text style={{ color: msg.startsWith('🔔') ? C.ok : C.danger, fontWeight: '600' }}>{msg}</Text>}
    </Card>
  );
}
