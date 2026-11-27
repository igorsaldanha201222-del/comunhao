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

async function ctx(f: FormData) {
  const c = await requireStaff(String(f.get("slug") ?? ""));
  if (!c.canFinance) throw new Error("Só o pastor, a administração e a tesouraria cuidam dos funcionários.");
  return c;
}

export async function saveEmployee(_: ActionResult, f: FormData): Promise<ActionResult> {
  let c;
  try { c = await ctx(f); } catch (e) { return { error: (e as Error).message }; }
  const id = s(f, "id");
  const salary = parseMoney(f.get("salary"));
  if (Number.isNaN(salary) || salary < 0) return { error: "Salário inválido." };
  const name = s(f, "full_name");
  const job = s(f, "job_title");
  if (!name || !job) return { error: "Preencha nome e cargo." };
  const days = f.getAll("work_days").map(Number).filter((d) => d >= 0 && d <= 6);
  const row = {
    church_id: c.church.id,
    person_id: s(f, "person_id"),
    full_name: name,
    job_title: job,
    salary_cents: salary,
    pay_day: Math.min(31, Math.max(1, Number(s(f, "pay_day") ?? 5))),
    pix_key: s(f, "pix_key"),
    admission_date: s(f, "admission_date"),
    work_days: days,
    start_time: s(f, "start_time"),
    end_time: s(f, "end_time"),
    punch_required: f.get("punch_required") === "on",
    active: id ? f.get("active") === "on" : true,
    notes: s(f, "notes"),
  };
  const { error } = id
    ? await c.supabase.from("employees").update(row).eq("id", id).eq("church_id", c.church.id)
    : await c.supabase.from("employees").insert(row);
  if (error) return { error: error.message.includes("employees_church_id_user_id_key") ? "Essa pessoa já está cadastrada como funcionário." : error.message };
  // salário do mês já entra nas contas a pagar
  await c.supabase.rpc("payroll_generate", { p_church: c.church.id });
  revalidatePath(`/painel/${c.church.slug}/funcionarios`);
  if (id) redirect(`/painel/${c.church.slug}/funcionarios`);
  return { ok: "Funcionário cadastrado. O salário deste mês já está em Contas a pagar." };
}

/** Correção de ponto: quando o funcionário esqueceu de bater. */
export async function addPunch(_: ActionResult, f: FormData): Promise<ActionResult> {
  let c;
  try { c = await ctx(f); } catch (e) { return { error: (e as Error).message }; }
  const at = s(f, "at");
  if (!at) return { error: "Informe data e hora." };
  const { error } = await c.supabase.from("time_punches").insert({
    church_id: c.church.id, employee_id: s(f, "employee_id"), kind: s(f, "kind") === "saida" ? "saida" : "entrada",
    at: new Date(`${at}:00-03:00`).toISOString(), source: "manual", note: s(f, "note"), created_by: c.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/painel/${c.church.slug}/funcionarios`);
  return { ok: "Batida registrada." };
}
