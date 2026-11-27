"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/form";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function saveDevotional(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const slug = String(f.get("slug"));
    const c = await requireStaff(slug);
    if (!c.isStaff) return { error: "Só a liderança." };
    const id = s(f, "id");
    const title = s(f, "title");
    const body = s(f, "body");
    if (!title || title.length < 3 || !body) return { error: "Preencha o título e o texto." };
    const row: Record<string, unknown> = {
      church_id: c.church.id, title, body, publish_on: s(f, "publish_on") ?? undefined,
      verse_ref: s(f, "verse_ref"), verse_text: s(f, "verse_text"), prayer: s(f, "prayer"), author: s(f, "author"),
      published: f.get("published") === "on", updated_at: new Date().toISOString(),
    };
    const img = f.get("image");
    if (img instanceof File && img.size > 0) {
      if (img.size > 5 * 1024 * 1024) return { error: "A imagem passa de 5 MB." };
      const path = `${c.church.id}/devocional/${crypto.randomUUID()}.${img.name.split(".").pop()?.toLowerCase() || "jpg"}`;
      const { error } = await c.supabase.storage.from("media").upload(path, img, { contentType: img.type });
      if (error) return { error: error.message };
      row.image_url = c.supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    if (f.get("remove_image")) row.image_url = null;
    if (!id) row.created_by = c.user.id;
    const { data, error } = id
      ? await c.supabase.from("devotionals").update(row).eq("id", id).select("id").single()
      : await c.supabase.from("devotionals").insert(row).select("id").single();
    if (error) return { error: error.message };
    revalidatePath(`/painel/${slug}/devocionais`, "layout");
    revalidatePath(`/i/${slug}`, "layout");
    if (!id) redirect(`/painel/${slug}/devocionais/${data.id}?salvo=1`);
    return { ok: "Devocional salvo." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: (e as Error).message };
  }
}

export async function deleteDevotional(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await requireStaff(slug);
  await c.supabase.from("devotionals").delete().eq("id", String(f.get("id"))).eq("church_id", c.church.id);
  revalidatePath(`/i/${slug}`, "layout");
  redirect(`/painel/${slug}/devocionais`);
}
