import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
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
  if (path && path !== '/' && !/^\/(login|igreja|bem-vindo)\b/.test(path)) pendingPath = path;
}

/** Abre o link de entrada uma única vez (fora do componente: o React Compiler não mexe aqui). */
function openPendingPath() {
  const p = pendingPath;
  pendingPath = null;
  if (p) setTimeout(() => router.replace(p as never), 0);
}

function RootNavigator() {
  const { loading: sessionLoading, session, church } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  // Sem a fonte (erro de rede), segue com a do sistema em vez de travar na abertura.
  const loading = sessionLoading || (!fontsLoaded && !fontError);

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
      <Stack.Screen name="bem-vindo" />
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
        <Stack.Screen name="contribuicoes" options={{ headerShown: true, title: 'Minhas contribuições', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="pessoas/index" options={{ headerShown: true, title: 'Pessoas', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="pessoas/nova" options={{ headerShown: true, title: 'Nova pessoa', headerBackTitle: 'Voltar', presentation: 'modal' }} />
        <Stack.Screen name="pessoas/[id]" options={{ headerShown: true, title: 'Pessoa', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="ministerios/index" options={{ headerShown: true, title: 'Ministérios', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="ministerios/[id]" options={{ headerShown: true, title: 'Ministério', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="energia" options={{ headerShown: true, title: 'Energia solar', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="biblia/index" options={{ headerShown: true, title: 'Bíblia', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="biblia/[livro]" options={{ headerShown: true, title: 'Bíblia', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="devocional/index" options={{ headerShown: true, title: 'Devocional', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="devocional/[id]" options={{ headerShown: true, title: 'Devocional', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="aovivo" options={{ headerShown: true, title: 'Ao vivo e pregações', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="ponto" options={{ headerShown: true, title: 'Meu ponto', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="equipe" options={{ headerShown: true, title: 'Equipe', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="visitantes" options={{ headerShown: true, title: 'Visitantes', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="qr-entrada" options={{ headerShown: true, title: 'QR Code da entrada', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="chamada" options={{ headerShown: true, title: 'Chamada do culto', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="aviso" options={{ headerShown: true, title: 'Enviar aviso', headerBackTitle: 'Voltar', presentation: 'modal' }} />
        <Stack.Screen name="financeiro/index" options={{ headerShown: true, title: 'Financeiro', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="financeiro/novo" options={{ headerShown: true, title: 'Novo lançamento', headerBackTitle: 'Voltar', presentation: 'modal' }} />
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
