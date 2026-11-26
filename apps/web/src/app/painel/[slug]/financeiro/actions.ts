"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { parseMoney } from "@/lib/format";
import type { ActionResult } from "@/components/form";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function finCtx(f: FormData) {
  const c = await requireStaff(String(f.get("slug") ?? ""));
  if (!c.canFinance) throw new Error("Sem acesso ao financeiro.");
  return c;
}

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/** Sobe a nota/comprovante para o bucket privado `finance`. */
async function uploadDoc(c: Awaited<ReturnType<typeof finCtx>>, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 15 * 1024 * 1024) throw new Error("Anexo maior que 15 MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Anexo deve ser PDF ou imagem.");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const ym = new Date().toISOString().slice(0, 7);
  const path = `${c.church.id}/${ym}/${crypto.randomUUID()}.${ext}`;
  const { error } = await c.supabase.storage.from("finance").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function saveEntry(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await finCtx(f);
    const id = s(f, "id");
    const amount = parseMoney(f.get("amount"));
    if (!amount || Number.isNaN(amount) || amount <= 0) return { error: "Informe um valor válido." };
    if (!s(f, "description")) return { error: "Descreva o lançamento." };

    const row: Record<string, unknown> = {
      church_id: c.church.id,
      type: s(f, "type") ?? "saida",
      status: s(f, "status") ?? "pago",
      entry_date: s(f, "entry_date") ?? new Date().toISOString().slice(0, 10),
      due_date: s(f, "due_date"),
      amount_cents: amount,
      description: s(f, "description"),
      category_id: s(f, "category_id"),
      account_id: s(f, "account_id"),
      counterparty: s(f, "counterparty"),
      counterparty_doc: s(f, "counterparty_doc"),
      document_type: s(f, "document_type"),
      document_number: s(f, "document_number"),
      payment_method: s(f, "payment_method"),
      notes: s(f, "notes"),
    };
    const doc = await uploadDoc(c, f.get("attachment"));
    if (doc) row.attachment_path = doc;

    if (id) {
      const { error } = await c.supabase.from("finance_entries").update(row).eq("id", id);
      if (error) return { error: error.message };
      revalidatePath(`/painel/${c.church.slug}/financeiro`);
      return { ok: "Lançamento atualizado." };
    }
    row.created_by = c.user.id;
    const { error } = await c.supabase.from("finance_entries").insert(row);
    if (error) return { error: error.message };
    revalidatePath(`/painel/${c.church.slug}/financeiro`);
    return { ok: "Lançamento registrado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteEntry(f: FormData) {
  const c = await finCtx(f);
  await c.supabase.from("finance_entries").delete().eq("id", String(f.get("id")));
  redirect(`/painel/${c.church.slug}/financeiro`);
}

export async function markPaid(f: FormData) {
  const c = await finCtx(f);
  await c.supabase.from("finance_entries")
    .update({ status: "pago", entry_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) })
    .eq("id", String(f.get("id")));
  revalidatePath(`/painel/${c.church.slug}/financeiro`);
}

export async function addCategory(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await finCtx(f);
    const { error } = await c.supabase.from("finance_categories").insert({ church_id: c.church.id, type: s(f, "type"), name: s(f, "name") });
    if (error) return { error: error.code === "23505" ? "Essa categoria já existe." : error.message };
    revalidatePath(`/painel/${c.church.slug}/financeiro`);
    return { ok: "Categoria criada." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addAccount(_: ActionResult, f: FormData): Promise<ActionResult> {
  try {
    const c = await finCtx(f);
    const opening = parseMoney(f.get("opening"));
    const { error } = await c.supabase.from("finance_accounts").insert({
      church_id: c.church.id, name: s(f, "name"), kind: s(f, "kind") ?? "banco", opening_cents: Number.isNaN(opening) ? 0 : opening,
    });
    if (error) return { error: error.code === "23505" ? "Essa conta já existe." : error.message };
    revalidatePath(`/painel/${c.church.slug}/financeiro`);
    return { ok: "Conta criada." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
