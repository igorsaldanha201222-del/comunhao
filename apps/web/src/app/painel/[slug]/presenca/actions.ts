"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/form";
import { dispatchNotification } from "@/lib/push-send";

async function ctx(slug: string) {
  const c = await requireStaff(slug);
  if (!c.canAttendance) throw new Error("Só a liderança e o diaconato/recepção.");
  return c;
}

export async function createService(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = String(f.get("slug"));
  const c = await ctx(slug);
  const service_date = String(f.get("service_date") || "");
  const title = String(f.get("title") || "").trim() || "Culto";
  if (!service_date) return { error: "Escolha a data." };
  const { data: existing } = await c.supabase.from("services").select("id")
    .eq("church_id", c.church.id).eq("service_date", service_date).eq("title", title).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await c.supabase.from("services")
      .insert({ church_id: c.church.id, service_date, title, created_by: c.user.id }).select("id").single();
    if (error) return { error: error.message };
    id = data.id;
  }
  redirect(`/painel/${slug}/presenca/${id}`);
}

export async function togglePresence(slug: string, serviceId: string, personId: string, on: boolean) {
  const c = await ctx(slug);
  const { error } = on
    ? await c.supabase.from("service_attendance").upsert({ service_id: serviceId, person_id: personId, church_id: c.church.id })
    : await c.supabase.from("service_attendance").delete().eq("service_id", serviceId).eq("person_id", personId);
  if (error) throw new Error(error.message);
  revalidatePath(`/painel/${slug}/presenca`, "layout");
}

export async function addVisitor(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = String(f.get("slug"));
  const c = await ctx(slug);
  const { error } = await c.supabase.rpc("attendance_add_visitor", {
    p_service: String(f.get("service_id")), p_name: String(f.get("name") ?? ""), p_phone: String(f.get("phone") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath(`/painel/${slug}/presenca`, "layout");
  return { ok: "Visitante cadastrado e marcado presente. 👋" };
}

export async function saveHeadcount(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await ctx(slug);
  const v = String(f.get("headcount") ?? "").trim();
  await c.supabase.from("services").update({ headcount: v === "" ? null : Math.max(0, Number(v)) })
    .eq("id", String(f.get("id"))).eq("church_id", c.church.id);
  revalidatePath(`/painel/${slug}/presenca`, "layout");
}

export async function deleteService(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await ctx(slug);
  await c.supabase.from("services").delete().eq("id", String(f.get("id"))).eq("church_id", c.church.id);
  revalidatePath(`/painel/${slug}/presenca`, "layout");
  redirect(`/painel/${slug}/presenca`);
}

// ------------------------------------------------ Confirmação pelo celular (GPS / QR)
/** Aceita "-3.7319, -38.5267" (copiado do Google Maps) ou os dois campos separados. */
export async function saveChurchLocation(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await requireStaff(String(f.get("slug")));
  if (!c.isStaff) return { error: "Só a liderança." };
  const nums = String(f.get("coords") ?? "").match(/-?\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(",", "."))) ?? [];
  if (nums.length !== 2 || Math.abs(nums[0]) > 90 || Math.abs(nums[1]) > 180) {
    return { error: "Cole as coordenadas no formato -3.7319, -38.5267 (no Google Maps: segure o dedo no local da igreja)." };
  }
  const radius = Number(f.get("radius") || 150);
  const { error } = await c.supabase.rpc("set_church_location", { p_church: c.church.id, p_lat: nums[0], p_lng: nums[1], p_radius: radius });
  if (error) return { error: error.message };
  revalidatePath(`/painel/${c.church.slug}/presenca`, "layout");
  return { ok: "Local da igreja salvo." };
}

export async function requestConfirmation(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await requireStaff(String(f.get("slug")));
  if (!c.isStaff) return { error: "Só a liderança pode enviar avisos." };
  if (c.church.lat == null) return { error: "Antes, marque o local da igreja na página Presença no culto." };
  const id = String(f.get("id"));
  const { data: svc } = await c.supabase.from("services").select("id, title, confirm_sent_at")
    .eq("id", id).eq("church_id", c.church.id).maybeSingle();
  if (!svc) return { error: "Culto não encontrado." };
  if (svc.confirm_sent_at) return { error: "A confirmação deste culto já foi enviada." };
  const title = "Você está no culto hoje? 🙏";
  const body = `Toque em Sim para confirmar sua presença no ${svc.title}.`;
  const url = `/app/presenca?s=${svc.id}`;
  const { data: n, error } = await c.supabase.from("notifications")
    .insert({ church_id: c.church.id, title, body, link_url: url, created_by: c.user.id }).select("id").single();
  if (error) return { error: error.message };
  await c.supabase.from("services").update({ confirm_sent_at: new Date().toISOString() }).eq("id", svc.id);
  try {
    const r = await dispatchNotification(c.supabase, n.id, { title, body, url, checkin: svc.id });
    revalidatePath(`/painel/${c.church.slug}/presenca/${svc.id}`);
    return { ok: r.total ? `Pedido enviado para ${r.sent} celular(es). As confirmações aparecem na lista com 📍.` : "Nenhum celular ativou as notificações ainda. Use o QR Code na entrada." };
  } catch (e) {
    return { error: "O envio falhou: " + (e as Error).message };
  }
}
