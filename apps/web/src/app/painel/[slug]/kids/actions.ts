"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/form";
import type { Attachment } from "@/lib/kids";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function kidsCtx(slug: string) {
  const c = await requireStaff(slug);
  if (!c.canKids) throw new Error("Só a equipe do ministério Kids.");
  return c;
}
const refresh = (slug: string, sub = "") => revalidatePath(`/painel/${slug}/kids${sub}`, "layout");

// ------------------------------------------------------------- Check-in
export async function checkIn(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  const { data, error } = await c.supabase.rpc("kids_checkin", { p_child: String(f.get("child_id")), p_room: s(f, "room_id") });
  if (error) throw new Error(error.message);
  refresh(slug);
  redirect(`/painel/${slug}/kids?ok=${data.id}`);
}

export async function checkOut(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const slug = String(f.get("slug"));
    const c = await kidsCtx(slug);
    const { error } = await c.supabase.rpc("kids_checkout", {
      p_checkin: String(f.get("id")), p_code: String(f.get("code") ?? ""), p_picked_up_by: s(f, "picked_up_by"),
    });
    if (error) return { error: error.message };
    refresh(slug);
    return { ok: "Retirada registrada." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelCheckin(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  await c.supabase.rpc("kids_cancel", { p_checkin: String(f.get("id")) });
  refresh(slug);
}

// ------------------------------------------------------------- Crianças
export async function saveChild(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const slug = String(f.get("slug"));
    const c = await kidsCtx(slug);
    const id = s(f, "id");
    const row = {
      church_id: c.church.id, full_name: s(f, "full_name"), birth_date: s(f, "birth_date"),
      allergies: s(f, "allergies"), medical_notes: s(f, "medical_notes"), notes: s(f, "notes"),
    };
    if (!row.full_name) return { error: "Informe o nome da criança." };
    if (id) {
      const { error } = await c.supabase.from("kids_children").update(row).eq("id", id);
      if (error) return { error: error.message };
      refresh(slug);
      return { ok: "Cadastro atualizado." };
    }
    const { data, error } = await c.supabase.from("kids_children").insert(row).select("id").single();
    if (error) return { error: error.message };
    const gName = s(f, "guardian_name");
    if (gName) {
      await c.supabase.from("kids_guardians").insert({
        child_id: data.id, church_id: c.church.id, name: gName, phone: s(f, "guardian_phone"), relationship: s(f, "guardian_relationship"),
      });
    }
    refresh(slug);
    redirect(`/painel/${slug}/kids/criancas/${data.id}`);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: (e as Error).message };
  }
}

export async function addGuardian(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  const name = s(f, "name");
  if (!name) return { error: "Informe o nome." };
  const { error } = await c.supabase.from("kids_guardians").insert({
    child_id: String(f.get("child_id")), church_id: c.church.id, name, phone: s(f, "phone"),
    relationship: s(f, "relationship"), can_pickup: f.get("can_pickup") === "on",
  });
  if (error) return { error: error.message };
  refresh(slug);
  return { ok: "Responsável adicionado." };
}

export async function removeGuardian(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  await c.supabase.from("kids_guardians").delete().eq("id", String(f.get("id")));
  refresh(slug);
}

export async function deleteChild(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  await c.supabase.from("kids_children").delete().eq("id", String(f.get("id")));
  refresh(slug);
  redirect(`/painel/${slug}/kids/criancas`);
}

export async function addRoom(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  const { error } = await c.supabase.from("kids_rooms").insert({
    church_id: c.church.id, name: s(f, "name"), min_age: Number(f.get("min_age") ?? 0), max_age: Number(f.get("max_age") ?? 12),
    color: s(f, "color") ?? "#f59e0b", position: 99,
  });
  if (error) return { error: error.message };
  refresh(slug);
  return { ok: "Turma criada." };
}

export async function toggleRoom(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  await c.supabase.from("kids_rooms").update({ active: f.get("active") === "1" }).eq("id", String(f.get("id")));
  refresh(slug);
}

// ------------------------------------------------------------- Aulas
async function uploadFiles(c: Awaited<ReturnType<typeof kidsCtx>>, files: FormDataEntryValue[]) {
  const out: Attachment[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > 20 * 1024 * 1024) throw new Error(`"${file.name}" passa de 20 MB.`);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${c.church.id}/kids/${crypto.randomUUID()}.${ext}`;
    const { error } = await c.supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    out.push({ name: file.name, url: c.supabase.storage.from("media").getPublicUrl(path).data.publicUrl });
  }
  return out;
}

export async function saveLesson(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const slug = String(f.get("slug"));
    const c = await kidsCtx(slug);
    const id = s(f, "id");
    const title = s(f, "title");
    if (!title || title.length < 3) return { error: "Dê um título para a aula." };
    const added = await uploadFiles(c, f.getAll("files"));
    const keep = f.getAll("keep").map(String);
    let attachments: Attachment[] = added;
    if (id) {
      const { data: cur } = await c.supabase.from("kids_lessons").select("attachments").eq("id", id).single();
      attachments = [...((cur?.attachments ?? []) as Attachment[]).filter((a) => keep.includes(a.url)), ...added];
    }
    const row = {
      church_id: c.church.id, room_id: s(f, "room_id"), lesson_date: s(f, "lesson_date") ?? undefined, title,
      bible_verse: s(f, "bible_verse"), plan: s(f, "plan"), home_activity: s(f, "home_activity"), materials: s(f, "materials"),
      attachments, published: f.get("published") === "on", updated_at: new Date().toISOString(),
    };
    const { data, error } = id
      ? await c.supabase.from("kids_lessons").update(row).eq("id", id).select("id").single()
      : await c.supabase.from("kids_lessons").insert(row).select("id").single();
    if (error) return { error: error.message };
    refresh(slug);
    if (!id) redirect(`/painel/${slug}/kids/aulas/${data.id}?salvo=1`);
    return { ok: row.published ? "Aula salva e publicada para os pais." : "Aula salva como rascunho." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: (e as Error).message };
  }
}

export async function deleteLesson(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await kidsCtx(slug);
  await c.supabase.from("kids_lessons").delete().eq("id", String(f.get("id")));
  refresh(slug);
  redirect(`/painel/${slug}/kids/aulas`);
}
