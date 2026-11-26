import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL, brl, dateTime } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Doações" };

export default async function DoacoesPage({ params, searchParams }: PageProps<"/painel/[slug]/doacoes">) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const { church, supabase, canFinance } = await requireStaff(slug);
  if (!canFinance) return <Empty>Somente administradores e tesoureiros veem o financeiro.</Empty>;

  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString();
  const to = new Date(Date.UTC(y, m, 1, 3)).toISOString();

  const { data: payments } = await supabase.from("payments")
    .select("id, kind, amount_cents, method, status, payer_name, created_at, paid_at, donation_funds(name)")
    .eq("church_id", church.id).gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false });

  const paid = (payments ?? []).filter((p) => p.status === "pago");
  const total = paid.reduce((s, p) => s + p.amount_cents, 0);
  const byFund = new Map<string, number>();
  paid.forEach((p) => {
    const k = p.kind === "inscricao" ? "Inscrições" : (p.donation_funds as unknown as { name: string } | null)?.name ?? "Outros";
    byFund.set(k, (byFund.get(k) ?? 0) + p.amount_cents);
  });

  return (
    <>
      <PageHeader title="Doações e recebimentos" subtitle="Pix, cartão e boleto"
        actions={<form><input type="month" name="mes" defaultValue={month} className="input" /><button className="btn-ghost ml-2">Ver</button></form>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Recebido no mês" value={brl(total)} hint={`${paid.length} pagamento(s)`} />
        {[...byFund].map(([k, v]) => <Stat key={k} label={k} value={brl(v)} />)}
      </div>
      <div className="card mt-6 overflow-x-auto p-0">
        {payments?.length ? (
          <table className="tbl">
            <thead><tr><th>Data</th><th>Quem</th><th>Destino</th><th>Forma</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{dateTime(p.created_at)}</td>
                  <td>{p.payer_name ?? "—"}</td>
                  <td>{p.kind === "inscricao" ? "Inscrição" : (p.donation_funds as unknown as { name: string } | null)?.name}</td>
                  <td>{STATUS_LABEL[p.method]}</td>
                  <td className="tabular-nums">{brl(p.amount_cents)}</td>
                  <td><Badge tone={p.status === "pago" ? "green" : p.status === "pendente" ? "amber" : "red"}>{STATUS_LABEL[p.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-5"><Empty>Nenhum pagamento neste mês.</Empty></div>}
      </div>
    </>
  );
}
