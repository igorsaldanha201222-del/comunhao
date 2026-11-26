// Envia uma notificação push (Expo Push) para todos os aparelhos da igreja.
// Chamada pelo painel com { notification_id }; só equipe da igreja pode enviar.
import { adminClient, cors, isStaff, json, requestUser } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await requestUser(req);
  if (!user) return json({ error: "faça login" }, 401);

  const { notification_id } = await req.json().catch(() => ({}));
  const db = adminClient();
  const { data: n } = await db.from("notifications").select("*").eq("id", notification_id).maybeSingle();
  if (!n) return json({ error: "notificação não encontrada" }, 404);
  if (!(await isStaff(db, n.church_id, user.id))) return json({ error: "sem permissão" }, 403);
  if (n.sent_at) return json({ error: "já enviada" }, 409);

  // Marca antes de enviar para evitar envio duplo em cliques repetidos.
  const { data: locked } = await db.from("notifications")
    .update({ sent_at: new Date().toISOString() }).eq("id", n.id).is("sent_at", null).select("id");
  if (!locked?.length) return json({ error: "já enviada" }, 409);

  const { data: tokens } = await db.from("push_tokens").select("token").eq("church_id", n.church_id);
  const all = (tokens ?? []).map((t) => t.token);
  let sent = 0;
  const invalid: string[] = [];

  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(chunk.map((to) => ({
        to, title: n.title, body: n.body, sound: "default", data: { link: n.link_url },
      }))),
    });
    const out = await res.json().catch(() => ({ data: [] }));
    (out.data ?? []).forEach((r: { status: string; details?: { error?: string } }, idx: number) => {
      if (r.status === "ok") sent++;
      else if (r.details?.error === "DeviceNotRegistered") invalid.push(chunk[idx]);
    });
  }

  if (invalid.length) await db.from("push_tokens").delete().in("token", invalid);
  await db.from("notifications").update({ sent_count: sent }).eq("id", n.id);
  return json({ sent, total: all.length });
});
