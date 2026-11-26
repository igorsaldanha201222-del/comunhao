"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fromLocalInput, parseMoney } from "@/lib/format";
import type { ActionResult } from "@/components/form";

type Ctx = Awaited<ReturnType<typeof requireStaff>>;

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const req = (f: FormData, k: string) => s(f, k) ?? "";

async function ctx(f: FormData) {
  return requireStaff(req(f, "slug"));
}
function done(c: Ctx, path: string, msg = "Salvo."): ActionResult {
  revalidatePath(`/painel/${c.church.slug}${path}`);
  return { ok: msg };
}
const fail = (e: { message: string } | null): ActionResult | null => (e ? { error: e.message } : null);

/** Sobe um arquivo para o bucket `media` na pasta da igreja e devolve a URL pública. */
async function upload(c: Ctx, file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo maior que 20 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${c.church.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await c.supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return c.supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ------------------------------------------------------------------ Pessoas
export async function savePerson(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const id = s(f, "id");
  const row = {
    church_id: c.church.id,
    full_name: req(f, "full_name"),
    email: s(f, "email"),
    phone: s(f, "phone"),
    birth_date: s(f, "birth_date"),
    gender: s(f, "gender"),
    status: req(f, "status") || "visitante",
    marital_status: s(f, "marital_status"),
    address: s(f, "address"),
    baptized_at: s(f, "baptized_at"),
    notes: s(f, "notes"),
  };
  if (!row.full_name) return { error: "Informe o nome." };
  const { error } = id
    ? await c.supabase.from("people").update(row).eq("id", id)
    : await c.supabase.from("people").insert(row);
  return fail(error) ?? done(c, "/pessoas", id ? "Cadastro atualizado." : "Pessoa cadastrada.");
}

export async function addPastoralCare(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const personId = req(f, "person_id");
  const { error } = await c.supabase.from("pastoral_care").insert({
    church_id: c.church.id, person_id: personId, kind: req(f, "kind"), reason: req(f, "reason"),
    notes: s(f, "notes"), attended_by: c.user.id,
  });
  return fail(error) ?? done(c, `/pessoas/${personId}`, "Atendimento registrado.");
}

// --------------------------------------------------------------- Comunicação
export async function saveSermon(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  try {
    const audio = await upload(c, f.get("audio_file"), "pregacoes");
    const { error } = await c.supabase.from("sermons").insert({
      church_id: c.church.id, title: req(f, "title"), preacher: s(f, "preacher"), series: s(f, "series"),
      description: s(f, "description"), video_url: s(f, "video_url"), audio_url: audio ?? s(f, "audio_url"),
      preached_at: s(f, "preached_at") ?? undefined,
    });
    return fail(error) ?? done(c, "/pregacoes", "Pregação publicada.");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveBanner(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  try {
    const image = await upload(c, f.get("image"), "banners");
    if (!image) return { error: "Envie a imagem do banner." };
    const { error } = await c.supabase.from("banners").insert({
      church_id: c.church.id, title: req(f, "title"), image_url: image, link_url: s(f, "link_url"),
      starts_at: fromLocalInput(f.get("starts_at")), ends_at: fromLocalInput(f.get("ends_at")),
      position: Number(s(f, "position") ?? 0),
    });
    return fail(error) ?? done(c, "/banners", "Banner publicado.");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createNotification(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const { data, error } = await c.supabase.from("notifications").insert({
    church_id: c.church.id, title: req(f, "title"), body: req(f, "body"), link_url: s(f, "link_url"), created_by: c.user.id,
  }).select("id").single();
  if (error) return { error: error.message };
  const { data: sent, error: fnErr } = await c.supabase.functions.invoke("send-notification", {
    body: { notification_id: data.id },
  });
  if (fnErr) return { error: "Salva, mas o envio falhou: " + fnErr.message };
  return done(c, "/notificacoes", `Enviada para ${sent?.sent ?? 0} aparelho(s).`);
}

// ------------------------------------------------------------------ Eventos
export async function saveEvent(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const id = s(f, "id");
  const price = parseMoney(f.get("price"));
  if (Number.isNaN(price)) return { error: "Valor inválido." };
  const startsAt = fromLocalInput(f.get("starts_at"));
  if (!startsAt) return { error: "Informe a data de início." };
  try {
    const cover = await upload(c, f.get("cover"), "eventos");
    const row: Record<string, unknown> = {
      church_id: c.church.id, title: req(f, "title"), description: s(f, "description"), location: s(f, "location"),
      starts_at: startsAt, ends_at: fromLocalInput(f.get("ends_at")),
      capacity: s(f, "capacity") ? Number(s(f, "capacity")) : null,
      price_cents: price, published: f.get("published") === "on",
    };
    if (cover) row.cover_url = cover;
    const q = id
      ? c.supabase.from("events").update(row).eq("id", id).select("id").single()
      : c.supabase.from("events").insert(row).select("id").single();
    const { data, error } = await q;
    if (error) return { error: error.message };
    revalidatePath(`/painel/${c.church.slug}/eventos`);
    if (!id) redirect(`/painel/${c.church.slug}/eventos/${data.id}`);
    return { ok: "Evento salvo." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: (e as Error).message };
  }
}

export async function checkIn(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const code = req(f, "code").replace(/\s/g, "").toLowerCase();
  const { data, error } = await c.supabase.rpc("check_in", { p_code: code });
  if (error) return { error: error.message };
  return done(c, `/eventos/${req(f, "event_id")}`, `Check-in feito: ${data.name}`);
}

// ----------------------------------------------------------------- Oração
export async function markPrayed(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("prayer_requests")
    .update({ prayed_at: new Date().toISOString(), prayed_by: c.user.id }).eq("id", req(f, "id"));
  revalidatePath(`/painel/${c.church.slug}/oracoes`);
}

// ------------------------------------------------------------- Ministérios
export async function saveMinistry(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const id = s(f, "id");
  const row = {
    church_id: c.church.id, name: req(f, "name"), kind: req(f, "kind") || "outro",
    description: s(f, "description"), color: s(f, "color") ?? "#4f46e5",
  };
  if (!row.name) return { error: "Informe o nome." };
  if (id) {
    const { error } = await c.supabase.from("ministries").update({ ...row, kind: undefined }).eq("id", id);
    return fail(error) ?? done(c, `/ministerios/${id}`);
  }
  const { data, error } = await c.supabase.from("ministries").insert(row).select("id").single();
  if (error) return { error: error.message };
  redirect(`/painel/${c.church.slug}/ministerios/${data.id}`);
}

export async function addPosition(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  const { error } = await c.supabase.from("ministry_positions").insert({
    ministry_id: mid, church_id: c.church.id, name: req(f, "name"), position: 99,
  });
  return fail(error) ?? done(c, `/ministerios/${mid}`, "Função adicionada.");
}

export async function removePosition(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("ministry_positions").delete().eq("id", req(f, "id"));
  revalidatePath(`/painel/${c.church.slug}/ministerios/${req(f, "ministry_id")}`);
}

export async function addMinistryMember(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  const personId = req(f, "person_id");
  if (!personId) return { error: "Escolha uma pessoa." };
  const { error } = await c.supabase.from("ministry_members").upsert({
    ministry_id: mid, person_id: personId, church_id: c.church.id,
    is_leader: f.get("is_leader") === "on", position_ids: f.getAll("position_ids").map(String),
  });
  return fail(error) ?? done(c, `/ministerios/${mid}`, "Membro salvo no ministério.");
}

export async function removeMinistryMember(f: FormData) {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  await c.supabase.from("ministry_members").delete().eq("ministry_id", mid).eq("person_id", req(f, "person_id"));
  revalidatePath(`/painel/${c.church.slug}/ministerios/${mid}`);
}

export async function saveSchedule(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  const startsAt = fromLocalInput(f.get("starts_at"));
  if (!startsAt) return { error: "Informe data e hora." };
  const { data, error } = await c.supabase.from("schedules").insert({
    ministry_id: mid, church_id: c.church.id, title: req(f, "title") || "Culto", starts_at: startsAt, notes: s(f, "notes"),
  }).select("id").single();
  if (error) return { error: error.message };
  redirect(`/painel/${c.church.slug}/ministerios/${mid}/escalas/${data.id}`);
}

export async function deleteSchedule(f: FormData) {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  await c.supabase.from("schedules").delete().eq("id", req(f, "schedule_id"));
  redirect(`/painel/${c.church.slug}/ministerios/${mid}`);
}

export async function assignToSchedule(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const sid = req(f, "schedule_id");
  const personId = req(f, "person_id");
  if (!personId) return { error: "Escolha quem vai servir." };
  const { error } = await c.supabase.from("schedule_assignments").insert({
    schedule_id: sid, church_id: c.church.id, person_id: personId, position_id: s(f, "position_id"),
  });
  if (error?.code === "23505") return { error: "Essa pessoa já está escalada nessa função." };
  return fail(error) ?? done(c, `/ministerios/${req(f, "ministry_id")}/escalas/${sid}`, "Escalado.");
}

export async function unassign(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("schedule_assignments").delete().eq("id", req(f, "id"));
  revalidatePath(`/painel/${c.church.slug}/ministerios/${req(f, "ministry_id")}/escalas/${req(f, "schedule_id")}`);
}

export async function saveSong(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const mid = req(f, "ministry_id");
  try {
    const chord = await upload(c, f.get("chord_file"), "repertorio");
    const audio = await upload(c, f.get("audio_file"), "repertorio");
    const { error } = await c.supabase.from("songs").insert({
      church_id: c.church.id, ministry_id: mid, title: req(f, "title"), artist: s(f, "artist"),
      song_key: s(f, "song_key"), bpm: s(f, "bpm") ? Number(s(f, "bpm")) : null,
      link_url: s(f, "link_url"), chord_url: chord, audio_url: audio, lyrics: s(f, "lyrics"),
    });
    return fail(error) ?? done(c, `/ministerios/${mid}`, "Música adicionada ao repertório.");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addSongToSchedule(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const sid = req(f, "schedule_id");
  const { count } = await c.supabase.from("schedule_songs").select("*", { count: "exact", head: true }).eq("schedule_id", sid);
  const { error } = await c.supabase.from("schedule_songs").upsert({
    schedule_id: sid, song_id: req(f, "song_id"), church_id: c.church.id, song_key: s(f, "song_key"), position: count ?? 0,
  });
  return fail(error) ?? done(c, `/ministerios/${req(f, "ministry_id")}/escalas/${sid}`, "Música adicionada.");
}

export async function removeSongFromSchedule(f: FormData) {
  const c = await ctx(f);
  const sid = req(f, "schedule_id");
  await c.supabase.from("schedule_songs").delete().eq("schedule_id", sid).eq("song_id", req(f, "song_id"));
  revalidatePath(`/painel/${c.church.slug}/ministerios/${req(f, "ministry_id")}/escalas/${sid}`);
}

// --------------------------------------------------------------- Solar
export async function createSolarDevice(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const { data, error } = await c.supabase.rpc("create_solar_device", {
    p_church: c.church.id, p_name: req(f, "name"), p_brand: s(f, "brand"), p_model: s(f, "model"),
    p_kw: s(f, "kw") ? Number(String(s(f, "kw")).replace(",", ".")) : null,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(`/painel/${c.church.slug}/solar`);
  return { ok: `Aparelho cadastrado. Token (grave no firmware, ele não será mostrado de novo): ${row.device_token}` };
}

export async function resolveSolarAlert(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("solar_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", req(f, "id"));
  revalidatePath(`/painel/${c.church.slug}/solar`);
}

// ---------------------------------------------------------- Configurações
export async function saveChurch(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  if (!c.isAdmin) return { error: "Só administradores podem alterar a igreja." };
  try {
    const logo = await upload(c, f.get("logo"), "marca");
    const hero = await upload(c, f.get("hero"), "marca");
    const row: Record<string, unknown> = {
      name: req(f, "name"), primary_color: req(f, "primary_color"), accent_color: s(f, "accent_color"),
      tagline: s(f, "tagline"), about: s(f, "about"), service_times: s(f, "service_times"), address: s(f, "address"),
      city: s(f, "city"), state: s(f, "state"), phone: s(f, "phone"), email: s(f, "email"), instagram: s(f, "instagram"),
      youtube_channel: s(f, "youtube_channel"), pix_key: s(f, "pix_key"),
    };
    if (logo) row.logo_url = logo;
    if (hero) row.hero_url = hero;
    const { error } = await c.supabase.from("churches").update(row).eq("id", c.church.id);
    return fail(error) ?? done(c, "/configuracoes", "Dados da igreja atualizados.");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addLeader(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  if (!c.isAdmin) return { error: "Só administradores." };
  try {
    const photo = await upload(c, f.get("photo"), "lideranca");
    const { error } = await c.supabase.from("church_leaders").insert({
      church_id: c.church.id, name: req(f, "name"), title: s(f, "title"), bio: s(f, "bio"), photo_url: photo,
      position: Number(f.get("position") ?? 0) || 0,
    });
    return fail(error) ?? done(c, "/configuracoes", "Líder adicionado ao site.");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function removeLeader(f: FormData) {
  const c = await ctx(f);
  if (!c.isAdmin) return;
  await c.supabase.from("church_leaders").delete().eq("id", req(f, "id")).eq("church_id", c.church.id);
  revalidatePath(`/painel/${c.church.slug}/configuracoes`);
}

export async function setRole(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  if (!c.isAdmin) return { error: "Só administradores podem mudar papéis." };
  const { error } = await c.supabase.from("memberships")
    .update({ role: req(f, "role"), maint_request: f.get("maint_request") === "on", maint_manage: f.get("maint_manage") === "on" })
    .eq("church_id", c.church.id).eq("user_id", req(f, "user_id"));
  return fail(error) ?? done(c, "/configuracoes", "Permissões atualizadas.");
}

export async function addFund(_: ActionResult, f: FormData): Promise<ActionResult> {
  const c = await ctx(f);
  const { error } = await c.supabase.from("donation_funds").insert({ church_id: c.church.id, name: req(f, "name"), position: 99 });
  return fail(error) ?? done(c, "/configuracoes", "Fundo criado.");
}
