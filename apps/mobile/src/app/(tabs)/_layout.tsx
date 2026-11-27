import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';

import { registerPush } from '@/lib/push';
import { useChurch } from '@/lib/session';

export default function TabsLayout() {
  const { church, user, color } = useChurch();

  useEffect(() => {
    registerPush(church.id, user.id);
  }, [church.id, user.id]);

  // No navegador (app instalado na tela inicial): barra de abas embaixo, como num app.
  if (Platform.OS === 'web') {
    const icon = (e: string) => function TabIcon({ focused }: { focused: boolean }) {
      return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{e}</Text>;
    };
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color, tabBarStyle: { height: 64, paddingBottom: 8 } }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('🏠') }} />
        <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icon('📅') }} />
        <Tabs.Screen name="escalas" options={{ title: 'Escalas', tabBarIcon: icon('👥') }} />
        <Tabs.Screen name="contribuir" options={{ title: 'Contribuir', tabBarIcon: icon('💝') }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('👤') }} />
      </Tabs>
    );
  }

  return (
    <NativeTabs tintColor={color} labelStyle={{ selected: { color } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agenda">
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="escalas">
        <NativeTabs.Trigger.Label>Escalas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contribuir">
        <NativeTabs.Trigger.Label>Contribuir</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="volunteer_activism" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
