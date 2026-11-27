import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { brl } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Empty, Field, PageHeader, Stat } from "@/components/ui";
import { addPunch, saveEmployee } from "./actions";

export const metadata = { title: "Funcionários" };

type Emp = {
  id: string; person_id: string | null; user_id: string | null; full_name: string; job_title: string; salary_cents: number; pay_day: number;
  pix_key: string | null; admission_date: string | null; work_days: number[]; start_time: string | null; end_time: string | null;
  punch_required: boolean; active: boolean; notes: string | null;
};
type Punch = { employee_id: string; kind: "entrada" | "saida"; at: string; source: string };

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const tz = "America/Sao_Paulo";
const dayKey = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: tz });
const hhmm = (v: string) => new Date(v).toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
const hours = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

/** Minutos trabalhados no dia: soma dos pares entrada → saída. */
function worked(ps: Punch[]) {
  let total = 0, open: number | null = null;
  for (const p of [...ps].sort((a, b) => a.at.localeCompare(b.at))) {
    const t = new Date(p.at).getTime();
    if (p.kind === "entrada") open = t;
    else if (open !== null) { total += (t - open) / 60000; open = null; }
  }
  return { total, open: open !== null };
}

export default async function Funcionarios({ params, searchParams }: PageProps<"/painel/[slug]/funcionarios">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { church, supabase, canFinance } = await requireStaff(slug);
  if (!canFinance) redirect(`/painel/${slug}`);

  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : new Date().toLocaleDateString("en-CA", { timeZone: tz }).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString();
  const to = new Date(Date.UTC(y, m, 1, 3)).toISOString();

  await supabase.rpc("payroll_generate", { p_church: church.id }); // garante o salário do mês em Contas a pagar
  const [{ data: emps }, { data: people }, { data: punches }, { data: pay }] = await Promise.all([
    supabase.from("employees").select("*").eq("church_id", church.id).order("active", { ascending: false }).order("full_name"),
    supabase.rpc("employee_people", { p_church: church.id }),
    supabase.from("time_punches").select("employee_id, kind, at, source").eq("church_id", church.id).gte("at", from).lt("at", to).order("at"),
    supabase.from("finance_entries").select("employee_id, status, due_date").eq("church_id", church.id).eq("competence", `${month}-01`),
  ]);
  const list = (emps ?? []) as Emp[];
  const editing = typeof sp.editar === "string" ? list.find((e) => e.id === sp.editar) : undefined;
  const opts = (people ?? []) as { id: string; full_name: string; has_app: boolean }[];
  const active = list.filter((e) => e.active);
  const payroll = active.reduce((a, e) => a + Number(e.salary_cents), 0);
  const paid = new Map(((pay ?? []) as { employee_id: string; status: string }[]).map((p) => [p.employee_id, p.status]));

  // ponto do mês por funcionário e dia
  const byEmp = new Map<string, Map<string, Punch[]>>();
  for (const p of (punches ?? []) as Punch[]) {
    const d = byEmp.get(p.employee_id) ?? new Map<string, Punch[]>();
    const k = dayKey(p.at);
    d.set(k, [...(d.get(k) ?? []), p]);
    byEmp.set(p.employee_id, d);
  }
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const monthLabel = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Funcionários" subtitle="Cadastro, folha de pagamento e ponto pelo app" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Funcionários ativos" value={active.length} />
        <Stat label="Folha do mês" value={brl(payroll)} hint="entra sozinha em Contas a pagar" />
        <Stat label="Batem ponto pelo app" value={active.filter((e) => e.punch_required && e.user_id).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card overflow-x-auto p-0">
            {list.length === 0 ? <div className="p-4"><Empty>Nenhum funcionário cadastrado ainda.</Empty></div> : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr><th className="p-3">Nome</th><th className="p-3">Cargo</th><th className="p-3">Escala</th><th className="p-3 text-right">Salário</th><th className="p-3">Mês</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className={`border-t border-zinc-100 ${e.active ? "" : "opacity-50"}`}>
                      <td className="p-3 font-medium">
                        {e.full_name}
                        {!e.user_id && e.punch_required && <div className="text-xs font-normal text-amber-700">sem conta no app: não bate ponto</div>}
                      </td>
                      <td className="p-3">{e.job_title}</td>
                      <td className="p-3 text-xs text-zinc-600">
                        {e.work_days.map((d) => DAYS[d]).join(", ")}
                        {e.start_time && e.end_time ? <div>{e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}</div> : null}
                      </td>
                      <td className="p-3 text-right tabular-nums">{brl(Number(e.salary_cents))}<div className="text-xs text-zinc-500">dia {e.pay_day}</div></td>
                      <td className="p-3">{!e.active ? <Badge>inativo</Badge> : paid.get(e.id) === "pago" ? <Badge tone="green">pago</Badge> : paid.get(e.id) ? <Badge tone="amber">a pagar</Badge> : <Badge>—</Badge>}</td>
                      <td className="p-3 text-right"><Link href={`?editar=${e.id}`} className="text-xs underline">editar</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Ponto de {monthLabel}</h2>
              <div className="flex gap-2 text-sm print:hidden">
                <Link href={`?mes=${prev}`} className="btn-ghost">←</Link>
                <Link href={`?mes=${next}`} className="btn-ghost">→</Link>
              </div>
            </div>
            {active.filter((e) => e.punch_required).length === 0 ? <Empty>Ninguém bate ponto ainda.</Empty> : (
              <div className="space-y-5">
                {active.filter((e) => e.punch_required).map((e) => {
                  const days = [...(byEmp.get(e.id) ?? new Map<string, Punch[]>()).entries()].sort(([a], [b]) => a.localeCompare(b));
                  const total = days.reduce((a, [, ps]) => a + worked(ps).total, 0);
                  return (
                    <div key={e.id}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <h3 className="font-medium">{e.full_name}</h3>
                        <span className="text-sm tabular-nums text-zinc-600">{days.length} dia(s) · {hours(total)}</span>
                      </div>
                      {days.length === 0 ? <p className="text-xs text-zinc-500">Sem batidas neste mês.</p> : (
                        <table className="w-full text-xs">
                          <tbody>
                            {days.map(([d, ps]) => {
                              const w = worked(ps);
                              return (
                                <tr key={d} className="border-t border-zinc-100">
                                  <td className="py-1 pr-2 text-zinc-500">{new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                                  <td className="py-1">{ps.map((p) => <span key={p.at} className={`mr-2 ${p.kind === "entrada" ? "text-emerald-700" : "text-zinc-700"}`}>{p.kind === "entrada" ? "▶" : "■"} {hhmm(p.at)}{p.source === "manual" ? "*" : ""}</span>)}</td>
                                  <td className="py-1 text-right tabular-nums">{w.open ? <span className="text-amber-700">sem saída</span> : hours(w.total)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-zinc-500">* batida lançada à mão pela administração.</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold">{editing ? `Editar: ${editing.full_name}` : "Novo funcionário"}</h2>
            <ActionForm action={saveEmployee} reset={!editing} className="grid gap-3" key={editing?.id ?? "novo"}>
              <input type="hidden" name="slug" value={slug} />
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Pessoa (cadastro da igreja)">
                <select name="person_id" defaultValue={editing?.person_id ?? ""} className="input">
                  <option value="">— não está no cadastro —</option>
                  {opts.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.has_app ? "" : " (sem app)"}</option>)}
                </select>
              </Field>
              <Field label="Nome"><input name="full_name" required defaultValue={editing?.full_name} className="input" /></Field>
              <Field label="Cargo"><input name="job_title" required defaultValue={editing?.job_title} placeholder="ex.: Secretária, Zelador" className="input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Salário (R$)"><input name="salary" inputMode="decimal" defaultValue={editing ? (editing.salary_cents / 100).toFixed(2).replace(".", ",") : ""} placeholder="0,00" className="input text-right" /></Field>
                <Field label="Dia do pagamento"><input name="pay_day" type="number" min={1} max={31} defaultValue={editing?.pay_day ?? 5} className="input" /></Field>
              </div>
              <Field label="Chave Pix (para pagar)"><input name="pix_key" defaultValue={editing?.pix_key ?? ""} className="input" /></Field>
              <Field label="Admissão"><input name="admission_date" type="date" defaultValue={editing?.admission_date ?? ""} className="input" /></Field>
              <Field label="Dias de trabalho">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => (
                    <label key={d} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="work_days" value={i} defaultChecked={(editing?.work_days ?? [1, 2, 3, 4, 5]).includes(i)} /> {d}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Entrada"><input name="start_time" type="time" defaultValue={editing?.start_time?.slice(0, 5) ?? "08:00"} className="input" /></Field>
                <Field label="Saída"><input name="end_time" type="time" defaultValue={editing?.end_time?.slice(0, 5) ?? "17:00"} className="input" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="punch_required" defaultChecked={editing?.punch_required ?? true} /> Bate ponto pelo app</label>
              {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing.active} /> Ativo (desmarque se saiu da igreja)</label>}
              <Field label="Observações"><textarea name="notes" defaultValue={editing?.notes ?? ""} rows={2} className="input" /></Field>
              <Submit>{editing ? "Salvar alterações" : "Cadastrar"}</Submit>
              {editing && <Link href="?" className="text-center text-sm underline">cancelar</Link>}
            </ActionForm>
            <p className="mt-3 text-xs text-zinc-500">
              Para bater ponto, a pessoa precisa ter conta no app e estar ligada aqui pelo cadastro. O salário entra todo mês em Contas a pagar, com vencimento no dia escolhido.
            </p>
          </section>

          {active.some((e) => e.punch_required) && (
            <section className="card">
              <h2 className="mb-3 font-semibold">Corrigir ponto</h2>
              <ActionForm action={addPunch} className="grid gap-3">
                <input type="hidden" name="slug" value={slug} />
                <Field label="Funcionário">
                  <select name="employee_id" className="input">{active.filter((e) => e.punch_required).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo"><select name="kind" className="input"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></Field>
                  <Field label="Data e hora"><input name="at" type="datetime-local" required className="input" /></Field>
                </div>
                <Field label="Motivo"><input name="note" placeholder="ex.: esqueceu de bater a saída" className="input" /></Field>
                <Submit className="btn-ghost">Lançar batida</Submit>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
