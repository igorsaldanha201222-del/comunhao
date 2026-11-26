"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/form";

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
