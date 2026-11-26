import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading, session, church } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
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
