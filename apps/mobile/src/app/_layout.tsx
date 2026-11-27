import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import '@/lib/webapp'; // no navegador: registra o service worker e a instalação o quanto antes

SplashScreen.preventAutoHideAsync();

// No navegador, o endereço de entrada (link da notificação ou do QR Code) se perde enquanto a
// sessão carrega. Guardamos e abrimos quando a pessoa estiver logada e com a igreja escolhida.
let pendingPath: string | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const entry = (window as Window & { __entryPath?: string }).__entryPath ?? window.location.pathname + window.location.search;
  const path = '/' + entry.replace(/^\/app\/?/, '');
  if (path && path !== '/' && !/^\/(login|igreja)/.test(path)) pendingPath = path;
}

/** Abre o link de entrada uma única vez (fora do componente: o React Compiler não mexe aqui). */
function openPendingPath() {
  const p = pendingPath;
  pendingPath = null;
  if (p) setTimeout(() => router.replace(p as never), 0);
}

function RootNavigator() {
  const { loading, session, church } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  const ready = !loading && !!session && !!church;
  useEffect(() => {
    if (ready) openPendingPath();
  }, [ready]);
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !church}>
        <Stack.Screen name="igreja" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!church}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="evento/[id]" options={{ headerShown: true, title: 'Evento', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="escala/[id]" options={{ headerShown: true, title: 'Escala', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="presenca" options={{ headerShown: true, title: 'Presença', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="membro/index" options={{ headerShown: true, title: 'Quero ser membro', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="kids/index" options={{ headerShown: true, title: 'Kids', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="kids/novo" options={{ headerShown: true, title: 'Cadastrar filho', headerBackTitle: 'Voltar', presentation: 'modal' }} />
        <Stack.Screen name="manutencao/index" options={{ headerShown: true, title: 'Manutenção', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="manutencao/novo" options={{ headerShown: true, title: 'Novo chamado', headerBackTitle: 'Voltar', presentation: 'modal' }} />
        <Stack.Screen name="manutencao/[id]" options={{ headerShown: true, title: 'Chamado', headerBackTitle: 'Voltar' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}
