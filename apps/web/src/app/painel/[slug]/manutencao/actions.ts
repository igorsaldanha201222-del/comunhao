"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { parseMoney } from "@/lib/format";
import type { ActionResult } from "@/components/form";
import type { MaintStatus } from "@/lib/maintenance";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const STATUSES: MaintStatus[] = ["aberta", "em_andamento", "aguardando", "concluida", "cancelada"];
const PRIORITIES = ["baixa", "normal", "alta", "urgente"];
const MAX_PHOTOS = 6;

type Ctx = Awaited<ReturnType<typeof requireStaff>>;
async function maintCtx(slug: string) {
  const c = await requireStaff(slug);
  if (!c.canMaintRequest) throw new Error("Você não tem permissão para a manutenção.");
  return c;
}
const refresh = (c: Ctx, id?: string) => {
  revalidatePath(`/painel/${c.church.slug}/manutencao`);
  if (id) revalidatePath(`/painel/${c.church.slug}/manutencao/${id}`);
};

/** Sobe fotos para o bucket privado `maintenance` em <igreja>/<chamado>/<arquivo>. */
async function uploadPhotos(c: Ctx, requestId: string, files: FormDataEntryValue[]) {
  const list = files.filter((f): f is File => f instanceof File && f.size > 0);
  if (list.length > MAX_PHOTOS) throw new Error(`Envie no máximo ${MAX_PHOTOS} fotos.`);
  const paths: string[] = [];
  for (const file of list) {
    if (!file.type.startsWith("image/")) throw new Error("Envie apenas fotos (JPG, PNG, HEIC…).");
    if (file.size > 10 * 1024 * 1024) throw new Error("Cada foto pode ter no máximo 10 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${c.church.id}/${requestId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await c.supabase.storage.from("maintenance").upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}

export async function createRequest(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await maintCtx(String(f.get("slug")));
    const title = s(f, "title");
    if (!title || title.length < 3) return { error: "Diga em poucas palavras o que precisa ser feito." };
    const id = crypto.randomUUID();
    const photos = await uploadPhotos(c, id, f.getAll("photos"));
    const priority = PRIORITIES.includes(String(f.get("priority"))) ? String(f.get("priority")) : "normal";
    const { error } = await c.supabase.from("maintenance_requests").insert({
      id, church_id: c.church.id, title, description: s(f, "description"), location: s(f, "location"), priority, photos,
    });
    if (error) {
      if (photos.length) await c.supabase.storage.from("maintenance").remove(photos);
      return { error: error.message };
    }
    refresh(c);
    return { ok: "Chamado aberto! A equipe de manutenção já pode ver no quadro." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Arrastar no quadro: muda a etapa e a posição do cartão. */
export async function moveRequest(slug: string, id: string, status: MaintStatus, position: number): Promise<ActionResult> {
  try {
    const c = await maintCtx(slug);
    if (!STATUSES.includes(status) || !Number.isFinite(position)) return { error: "Movimento inválido." };
    const { data, error } = await c.supabase.from("maintenance_requests").update({ status, position }).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Só quem cuida da manutenção ou o responsável pelo chamado pode mover este cartão." };
    refresh(c, id);
    return { ok: "Movido." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateRequest(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await maintCtx(String(f.get("slug")));
    const id = String(f.get("id"));
    const status = String(f.get("status")) as MaintStatus;
    if (!STATUSES.includes(status)) return { error: "Etapa inválida." };
    const row: Record<string, unknown> = { status, resolution: s(f, "resolution") };
    if (c.canMaintManage) {
      const cost = s(f, "cost") ? parseMoney(f.get("cost")) : null;
      if (cost !== null && (Number.isNaN(cost) || cost < 0)) return { error: "Custo inválido." };
      Object.assign(row, {
        title: s(f, "title"), description: s(f, "description"), location: s(f, "location"),
        priority: PRIORITIES.includes(String(f.get("priority"))) ? String(f.get("priority")) : "normal",
        assigned_to: s(f, "assigned_to"), due_date: s(f, "due_date"), cost_cents: cost,
      });
      if (!row.title) return { error: "O chamado precisa de um título." };
    }
    const extra = await uploadPhotos(c, id, f.getAll("photos"));
    if (extra.length) {
      const { data: cur } = await c.supabase.from("maintenance_requests").select("photos").eq("id", id).single();
      row.photos = [...(cur?.photos ?? []), ...extra].slice(0, 10);
    }
    const { data, error } = await c.supabase.from("maintenance_requests").update(row).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Você não pode alterar este chamado." };
    refresh(c, id);
    return { ok: "Chamado atualizado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addComment(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await maintCtx(String(f.get("slug")));
    const id = String(f.get("id"));
    const body = s(f, "body");
    const [photo] = await uploadPhotos(c, id, f.getAll("photo").slice(0, 1));
    if (!body && !photo) return { error: "Escreva algo ou anexe uma foto." };
    const { error } = await c.supabase.from("maintenance_updates").insert({
      request_id: id, user_id: c.user.id, body, photo_path: photo ?? null,
    });
    if (error) return { error: error.message };
    refresh(c, id);
    return { ok: "Comentário enviado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteRequest(f: FormData) {
  const c = await maintCtx(String(f.get("slug")));
  if (!c.canMaintManage) throw new Error("Sem permissão.");
  const id = String(f.get("id"));
  const [{ data: r }, { data: ups }] = await Promise.all([
    c.supabase.from("maintenance_requests").select("photos").eq("id", id).single(),
    c.supabase.from("maintenance_updates").select("photo_path").eq("request_id", id).not("photo_path", "is", null),
  ]);
  const files = [...(r?.photos ?? []), ...(ups ?? []).map((u) => u.photo_path as string)];
  await c.supabase.from("maintenance_requests").delete().eq("id", id);
  if (files.length) await c.supabase.storage.from("maintenance").remove(files);
  refresh(c);
  redirect(`/painel/${c.church.slug}/manutencao`);
}
