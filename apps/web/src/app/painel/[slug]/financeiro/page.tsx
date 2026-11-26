import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL, brl, date } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Empty, Field, PageHeader, Stat } from "@/components/ui";
import { addAccount, addCategory, markPaid } from "./actions";
import { EntryForm } from "./entry-form";

export const metadata = { title: "Financeiro" };

type Row = {
  id: string; type: "entrada" | "saida"; status: string; entry_date: string; due_date: string | null; amount_cents: number;
  description: string; counterparty: string | null; document_type: string | null; document_number: string | null;
  attachment_path: string | null; source: string; account_id: string | null;
  finance_categories: { name: string } | null; finance_accounts: { name: string } | null;
};

export default async function FinanceiroPage({ params, searchParams }: PageProps<"/painel/[slug]/financeiro">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { church, supabase, canFinance } = await requireStaff(slug);
  if (!canFinance) return <Empty>Só administradores e tesoureiros acessam o financeiro.</Empty>;

  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes)
    ? sp.mes : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const tipo = typeof sp.tipo === "string" ? sp.tipo : "";
  const q = typeof sp.q === "string" ? sp.q.replace(/[%_,()]/g, "") : "";

  let list = supabase.from("finance_entries")
    .select("id, type, status, entry_date, due_date, amount_cents, description, counterparty, document_type, document_number, attachment_path, source, account_id, finance_categories(name), finance_accounts(name)")
    .eq("church_id", church.id).gte("entry_date", from).lt("entry_date", to)
    .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
  if (tipo === "entrada" || tipo === "saida") list = list.eq("type", tipo);
  if (q) list = list.or(`description.ilike.%${q}%,counterparty.ilike.%${q}%,document_number.ilike.%${q}%`);

  const [{ data: rows }, { data: categories }, { data: accounts }, { data: allPaid }, { data: overdue }] = await Promise.all([
    list,
    supabase.from("finance_categories").select("id, name, type").eq("church_id", church.id).eq("active", true).order("name"),
    supabase.from("finance_accounts").select("id, name, kind, opening_cents").eq("church_id", church.id).eq("active", true).order("name"),
    // saldo por conta = saldo inicial + todas as entradas pagas − saídas pagas
    supabase.from("finance_entries").select("account_id, type, amount_cents").eq("church_id", church.id).eq("status", "pago"),
    supabase.from("finance_entries").select("id, description, due_date, amount_cents, type").eq("church_id", church.id)
      .eq("status", "pendente").order("due_date", { ascending: true, nullsFirst: false }).limit(10),
  ]);

  const entries = (rows ?? []) as unknown as Row[];
  const paid = entries.filter((r) => r.status === "pago");
  const inc = paid.filter((r) => r.type === "entrada").reduce((a, r) => a + Number(r.amount_cents), 0);
  const out = paid.filter((r) => r.type === "saida").reduce((a, r) => a + Number(r.amount_cents), 0);

  const balance = new Map<string, number>((accounts ?? []).map((a) => [a.id, Number(a.opening_cents)]));
  (allPaid ?? []).forEach((e) => {
    if (!e.account_id || !balance.has(e.account_id)) return;
    balance.set(e.account_id, balance.get(e.account_id)! + (e.type === "entrada" ? 1 : -1) * Number(e.amount_cents));
  });
  const total = [...balance.values()].reduce((a, b) => a + b, 0);

  const byCat = new Map<string, { type: string; cents: number }>();
  paid.forEach((r) => {
    const k = `${r.type}|${r.finance_categories?.name ?? "Sem categoria"}`;
    byCat.set(k, { type: r.type, cents: (byCat.get(k)?.cents ?? 0) + Number(r.amount_cents) });
  });
  const catRows = [...byCat].map(([k, v]) => ({ name: k.split("|")[1], ...v })).sort((a, b) => b.cents - a.cents);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const base = `/painel/${slug}/financeiro`;

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Entradas, saídas, notas e comprovantes da igreja"
        actions={
          <>
            <form className="flex gap-2">
              <input type="month" name="mes" defaultValue={month} className="input" />
              <button className="btn-ghost">Ver mês</button>
            </form>
            <a href={`${base}/exportar?mes=${month}`} className="btn-ghost">Exportar CSV</a>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Entradas no mês" value={<span className="text-emerald-700">{brl(inc)}</span>} />
        <Stat label="Saídas no mês" value={<span className="text-red-700">{brl(out)}</span>} />
        <Stat label="Resultado do mês" value={brl(inc - out)} hint={inc - out >= 0 ? "superávit" : "déficit"} />
        <Stat label="Saldo em contas" value={brl(total)} hint="todas as contas, hoje" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          {!!overdue?.length && (
            <section className="card">
              <h2 className="font-semibold">Contas a pagar / receber</h2>
              <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                {overdue.map((o) => {
                  const late = o.due_date && o.due_date < todayIso;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`${base}/${o.id}`} className="hover:underline">
                        {o.type === "saida" ? "−" : "+"} {o.description}
                      </Link>
                      <span className="flex items-center gap-2">
                        <span className={late ? "font-medium text-red-700" : "text-zinc-500"}>
                          {late && <span aria-hidden>▲ </span>}{o.due_date ? `vence ${date(o.due_date)}` : "sem vencimento"}
                        </span>
                        <span className="tabular-nums">{brl(Number(o.amount_cents))}</span>
                        <form action={markPaid}>
                          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={o.id} />
                          <button className="btn-ghost py-1 text-xs">{o.type === "saida" ? "Paguei" : "Recebi"}</button>
                        </form>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="card p-0">
            <form className="flex flex-wrap gap-2 border-b border-zinc-200 p-3">
              <input type="hidden" name="mes" value={month} />
              <input name="q" defaultValue={q} placeholder="Buscar descrição, fornecedor ou nº da nota" className="input flex-1" />
              <select name="tipo" defaultValue={tipo} className="input w-36">
                <option value="">Tudo</option><option value="entrada">Entradas</option><option value="saida">Saídas</option>
              </select>
              <button className="btn-ghost">Filtrar</button>
            </form>
            {entries.length ? (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th className="text-right">Valor</th><th></th></tr></thead>
                  <tbody>
                    {entries.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{date(r.entry_date)}</td>
                        <td>
                          <Link href={`${base}/${r.id}`} className="font-medium hover:underline">{r.description}</Link>
                          <p className="text-xs text-zinc-500">
                            {[r.counterparty, r.document_type && `${STATUS_LABEL[r.document_type]}${r.document_number ? " " + r.document_number : ""}`].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="text-xs">{r.finance_categories?.name ?? "—"}</td>
                        <td className="text-xs">{r.finance_accounts?.name ?? "—"}</td>
                        <td className={`whitespace-nowrap text-right tabular-nums ${r.type === "saida" ? "text-red-700" : "text-emerald-700"}`}>
                          {r.type === "saida" ? "−" : "+"} {brl(Number(r.amount_cents))}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {r.status === "pendente" && <Badge tone="amber">{r.type === "saida" ? "a pagar" : "a receber"}</Badge>}
                          {r.attachment_path && <span title="Tem nota anexada" className="ml-1">📎</span>}
                          {r.source === "online" && <Badge>online</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><Empty>Nenhum lançamento neste mês.</Empty></div>}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="font-semibold">Por categoria (pagos no mês)</h2>
              <table className="tbl mt-2">
                <tbody>
                  {catRows.map((c) => (
                    <tr key={c.type + c.name}>
                      <td>{c.type === "saida" ? "−" : "+"} {c.name}</td>
                      <td className="text-right tabular-nums">{brl(c.cents)}</td>
                      <td className="w-24 text-right text-xs text-zinc-500">
                        {Math.round((c.cents / ((c.type === "saida" ? out : inc) || 1)) * 100)}% das {c.type === "saida" ? "saídas" : "entradas"}
                      </td>
                    </tr>
                  ))}
                  {!catRows.length && <tr><td className="text-zinc-500">Sem dados.</td></tr>}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2 className="font-semibold">Saldo por conta</h2>
              <table className="tbl mt-2">
                <tbody>
                  {(accounts ?? []).map((a) => (
                    <tr key={a.id}><td>{a.name}</td><td className="text-right tabular-nums">{brl(balance.get(a.id) ?? 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="mb-4 font-semibold">Novo lançamento</h2>
            <EntryForm slug={slug} categories={categories ?? []} accounts={accounts ?? []} />
          </section>
          <section className="card space-y-4">
            <h2 className="font-semibold">Categorias e contas</h2>
            <ActionForm action={addCategory} className="flex gap-2">
              <input type="hidden" name="slug" value={slug} />
              <select name="type" className="input w-28"><option value="saida">Saída</option><option value="entrada">Entrada</option></select>
              <input name="name" required placeholder="Nova categoria" className="input" />
              <Submit className="btn-ghost">+</Submit>
            </ActionForm>
            <ActionForm action={addAccount} className="grid grid-cols-[1fr_110px] gap-2">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Nova conta"><input name="name" required placeholder="ex.: Banco do Brasil" className="input" /></Field>
              <Field label="Saldo inicial"><input name="opening" inputMode="decimal" placeholder="0,00" className="input" /></Field>
              <select name="kind" className="input"><option value="banco">Banco</option><option value="caixa">Caixa</option></select>
              <Submit className="btn-ghost">Criar</Submit>
            </ActionForm>
          </section>
        </aside>
      </div>
    </>
  );
}
