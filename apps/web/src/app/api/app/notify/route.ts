import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { dispatchNotification } from "@/lib/push-send";

// Envio de avisos a partir do app (o envio precisa da chave privada, que só existe no servidor).
// O app manda o token da sessão; tudo roda com as permissões da própria pessoa (RLS).
//   { church_id, kind: "aviso", title, body }        → aviso para todos
//   { church_id, kind: "confirmacao", service_id }   → "Você está no culto hoje?" com Sim/Não

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Faça login de novo." }, 401);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Faça login de novo." }, 401);

  const b = (await req.json().catch(() => ({}))) as { church_id?: string; kind?: string; title?: string; body?: string; service_id?: string };
  if (!b.church_id) return json({ error: "Igreja não informada." }, 400);
  const { data: m } = await supabase.from("memberships").select("role").eq("church_id", b.church_id).eq("user_id", user.id).maybeSingle();
  if (!m || !["owner", "admin", "leader"].includes(m.role)) return json({ error: "Só a liderança pode enviar avisos." }, 403);

  let title: string, body: string, url = "/app", checkin: string | undefined;
  if (b.kind === "confirmacao") {
    const { data: church } = await supabase.from("churches").select("lat").eq("id", b.church_id).single();
    if (church?.lat == null) return json({ error: "Antes, marque o local da igreja no painel (Presença no culto)." }, 400);
    const { data: svc } = await supabase.from("services").select("id, title, confirm_sent_at")
      .eq("id", b.service_id ?? "").eq("church_id", b.church_id).maybeSingle();
    if (!svc) return json({ error: "Culto não encontrado." }, 404);
    if (svc.confirm_sent_at) return json({ error: "A confirmação deste culto já foi enviada." }, 409);
    title = "Você está no culto hoje? 🙏";
    body = `Toque em Sim para confirmar sua presença no ${svc.title}.`;
    url = `/app/presenca?s=${svc.id}`;
    checkin = svc.id;
    await supabase.from("services").update({ confirm_sent_at: new Date().toISOString() }).eq("id", svc.id);
  } else {
    title = (b.title ?? "").trim();
    body = (b.body ?? "").trim();
    if (title.length < 2 || body.length < 2) return json({ error: "Preencha o título e a mensagem." }, 400);
  }

  const { data: n, error } = await supabase.from("notifications")
    .insert({ church_id: b.church_id, title, body, link_url: url, created_by: user.id }).select("id").single();
  if (error) return json({ error: error.message }, 400);
  try {
    const r = await dispatchNotification(supabase, n.id, { title, body, url, checkin });
    return json({ sent: r.sent, total: r.total });
  } catch (e) {
    return json({ error: "Salvo, mas o envio falhou: " + (e as Error).message }, 500);
  }
}
