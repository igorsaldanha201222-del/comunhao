import { Stack } from 'expo-router';

import { C, F } from '@/components/ui';

/** Área de administração da igreja (tudo o que o painel do computador faz). */
export default function GestaoLayout() {
  return (
    <Stack screenOptions={{
      headerShown: true, headerBackTitle: 'Voltar', headerShadowVisible: false,
      headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { fontFamily: F.bold, color: C.text },
      contentStyle: { backgroundColor: C.bg },
    }} />
  );
}
