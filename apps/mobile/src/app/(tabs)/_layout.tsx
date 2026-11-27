import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { Calendar, HeartHandshake, House, User, Users, type LucideIcon } from 'lucide-react-native';
import { Platform } from 'react-native';

import { C, F } from '@/components/ui';

import { registerPush } from '@/lib/push';
import { useChurch } from '@/lib/session';

export default function TabsLayout() {
  const { church, user, color } = useChurch();

  useEffect(() => {
    registerPush(church.id, user.id);
  }, [church.id, user.id]);

  // No navegador (app instalado na tela inicial): barra de abas embaixo, como num app.
  if (Platform.OS === 'web') {
    const icon = (Icon: LucideIcon) => function TabIcon({ color: c, focused }: { color: unknown; focused: boolean }) {
      return <Icon size={24} color={String(c)} strokeWidth={focused ? 2.2 : 1.8} />;
    };
    return (
      <Tabs screenOptions={{
        headerShown: false, tabBarActiveTintColor: color, tabBarInactiveTintColor: '#6b766f',
        tabBarStyle: { height: 68, paddingBottom: 10, paddingTop: 6, borderTopColor: C.border, backgroundColor: '#fff' },
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 11 },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon(House) }} />
        <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icon(Calendar) }} />
        <Tabs.Screen name="escalas" options={{ title: 'Escalas', tabBarIcon: icon(Users) }} />
        <Tabs.Screen name="contribuir" options={{ title: 'Contribuir', tabBarIcon: icon(HeartHandshake) }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon(User) }} />
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
