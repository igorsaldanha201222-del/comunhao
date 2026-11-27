// Recursos do app quando roda no navegador (instalado na tela inicial): instalar e notificações.
// No app nativo nada disto é usado (Platform.OS !== 'web').
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (isWeb) {
  // O Android/Chrome avisa quando dá para instalar; guardamos para o botão "Instalar app".
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app/sw.js', { scope: '/app' }).catch(() => {});
}

export const isIOS = () => isWeb && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () =>
  isWeb && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const pushSupported = () => isWeb && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Pede permissão, inscreve este celular e salva para a igreja. Retorna um erro legível ou null. */
export async function enablePush(churchId: string, userId: string): Promise<string | null> {
  if (!pushSupported()) {
    return isIOS() && !isStandalone()
      ? 'No iPhone, primeiro adicione o app à Tela de Início e abra pelo ícone.'
      : 'Este navegador não recebe notificações.';
  }
  const key = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return 'Notificações ainda não configuradas.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Você não permitiu as notificações. Dá para liberar depois nos ajustes do celular.';
  const reg = await navigator.serviceWorker.register('/app/sw.js', { scope: '/app' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('web_push_subscriptions').upsert({
    endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: userId, church_id: churchId,
    user_agent: navigator.userAgent.slice(0, 200),
  });
  return error ? error.message : null;
}

/** Estado do app no navegador, atualizado quando o Chrome libera a instalação. */
export function useWebApp() {
  const [, force] = useState(0);
  const granted = () => pushSupported() && Notification.permission === 'granted';
  // null = verificando (só quando já há permissão); false = ainda não ativou
  const [subscribed, setSubscribed] = useState<boolean | null>(() => (granted() ? null : false));
  useEffect(() => {
    if (!isWeb) return;
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (granted()) {
      navigator.serviceWorker.getRegistration('/app')
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setSubscribed(!!s))
        .catch(() => setSubscribed(false));
    }
    return () => { listeners.delete(l); };
  }, []);
  return {
    isWeb,
    standalone: isStandalone(),
    ios: isIOS(),
    canPrompt: !!deferred,
    pushOk: pushSupported(),
    permission: isWeb && 'Notification' in window ? Notification.permission : 'default',
    subscribed,
    setSubscribed,
  };
}
