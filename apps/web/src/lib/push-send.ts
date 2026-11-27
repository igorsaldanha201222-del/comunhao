import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type Target = { kind: "web" | "expo"; endpoint: string; p256dh: string | null; auth: string | null };

/**
 * Envia um aviso já salvo para todos os aparelhos da igreja:
 * app pelo navegador (Web Push) e app nativo (Expo Push). Retorna quantos receberam.
 */
export async function dispatchNotification(supabase: SupabaseClient, id: string, msg: { title: string; body: string; url: string; checkin?: string }) {
  const { data, error } = await supabase.rpc("notification_dispatch", { p_notification: id });
  if (error) throw new Error(error.message);
  const targets = (data ?? []) as Target[];
  const dead: string[] = [];
  let sent = 0;

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const web = targets.filter((t) => t.kind === "web");
  if (web.length && pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://comunhao-psi.vercel.app", pub, priv);
    const payload = JSON.stringify(msg);
    await Promise.all(web.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh!, auth: t.auth! } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(t.endpoint); // celular desinstalou ou bloqueou
      }
    }));
  }

  const expo = targets.filter((t) => t.kind === "expo").map((t) => t.endpoint);
  for (let i = 0; i < expo.length; i += 100) {
    const chunk = expo.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk.map((to) => ({ to, title: msg.title, body: msg.body, sound: "default", data: { link: msg.url } }))),
      });
      const out = await res.json().catch(() => ({ data: [] }));
      (out.data ?? []).forEach((r: { status: string; details?: { error?: string } }, idx: number) => {
        if (r.status === "ok") sent++;
        else if (r.details?.error === "DeviceNotRegistered") dead.push(chunk[idx]);
      });
    } catch { /* serviço da Expo fora: segue com os demais */ }
  }

  await supabase.rpc("notification_result", { p_notification: id, p_sent: sent, p_dead: dead });
  return { sent, total: targets.length };
}
