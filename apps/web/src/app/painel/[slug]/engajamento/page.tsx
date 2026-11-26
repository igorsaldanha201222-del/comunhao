import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { brl, date, nowMs, STATUS_LABEL } from "@/lib/format";
import { Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Engajamento" };

type Person = { id: string; user_id: string | null; full_name: string; status: string; baptized_at: string | null; phone: string | null };
type Row = Person & {
  ministries: number; scales: number; events: number; giveMonths: number; giveTotal: number; last: string | null;
  serves: boolean; score: number; group: "engajado" | "participa" | "afastado";
};

const FILTERS = [
  ["", "Todos"], ["engajado", "🔥 Engajados"], ["participa", "🙂 Participam"], ["afastado", "⚠️ Sem participação"],
  ["nao_batizado", "💧 Não batizados"], ["nao_serve", "Não servem"], ["nao_contribui", "Não contribuem"],
] as const;

const wa = (phone: string | null) => {
  const d = phone?.replace(/\D/g, "") ?? "";
  return d.length >= 10 ? `https://wa.me/${d.startsWith("55") ? d : "55" + d}` : null;
};
const maxDate = (...v: (string | null | undefined)[]) => v.filter(Boolean).sort().at(-1) ?? null;

export default async function Engajamento({ params, searchParams }: PageProps<"/painel/[slug]/engajamento">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { church, supabase, isStaff, canFinance } = await requireStaff(slug);
  if (!isStaff) redirect(`/painel/${slug}`);
  const months = [3, 6, 12].includes(Number(sp.meses)) ? Number(sp.meses) : 6;
  const filter = typeof sp.f === "string" ? sp.f : "";
  const withVisitors = sp.visitantes === "1";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const now = nowMs();
  const since = new Date(now - months * 30.4 * 864e5).toISOString();
  const nowIso = new Date(now).toISOString();

  const [{ data: people }, { data: mm }, { data: sa }, { data: regs }, gifts] = await Promise.all([
    supabase.from("people").select("id, user_id, full_name, status, baptized_at, phone").eq("church_id", church.id).order("full_name"),
    supabase.from("ministry_members").select("person_id").eq("church_id", church.id),
    supabase.from("schedule_assignments").select("person_id, status, schedules!inner(starts_at)").eq("church_id", church.id)
      .neq("status", "recusado").gte("schedules.starts_at", since).lte("schedules.starts_at", nowIso),
    supabase.from("registrations").select("user_id, status, checked_in_at, created_at").eq("church_id", church.id)
      .neq("status", "cancelada").gte("created_at", since).not("user_id", "is", null),
    canFinance
      ? supabase.from("finance_entries").select("person_id, amount_cents, entry_date").eq("church_id", church.id)
          .eq("type", "entrada").eq("status", "pago").gte("entry_date", since.slice(0, 10)).not("person_id", "is", null)
      : Promise.resolve({ data: [] as { person_id: string; amount_cents: number; entry_date: string }[] }),
  ]);

  const count = <T,>(arr: T[] | null, key: (x: T) => string | null) => {
    const m = new Map<string, T[]>();
    for (const x of arr ?? []) { const k = key(x); if (k) m.set(k, [...(m.get(k) ?? []), x]); }
    return m;
  };
  const byMin = count(mm, (x) => x.person_id);
  const bySa = count(sa as unknown as { person_id: string; schedules: { starts_at: string } }[], (x) => x.person_id);
  const byReg = count(regs, (x) => x.user_id);
  const byGift = count(gifts.data, (x) => x.person_id);

  const all: Row[] = ((people ?? []) as Person[])
    .filter((p) => p.status !== "inativo" && (withVisitors || p.status !== "visitante"))
    .map((p) => {
      const scales = bySa.get(p.id) ?? [];
      const events = p.user_id ? byReg.get(p.user_id) ?? [] : [];
      const g = byGift.get(p.id) ?? [];
      const ministries = byMin.get(p.id)?.length ?? 0;
      const serves = ministries > 0 || scales.length > 0;
      const giveMonths = new Set(g.map((x) => x.entry_date.slice(0, 7))).size;
      const score = (serves ? 1 : 0) + (events.length ? 1 : 0) + (giveMonths ? 1 : 0);
      return {
        ...p, ministries, scales: scales.length, events: events.length, giveMonths,
        giveTotal: g.reduce((s, x) => s + Number(x.amount_cents), 0),
        last: maxDate(...scales.map((x) => x.schedules.starts_at), ...events.map((x) => x.checked_in_at ?? x.created_at), ...g.map((x) => x.entry_date)),
        serves, score, group: score >= 2 ? "engajado" : score === 1 ? "participa" : "afastado",
      };
    });

  const shown = all.filter((r) => {
    if (q && !r.full_name.toLowerCase().includes(q)) return false;
    if (filter === "nao_batizado") return !r.baptized_at;
    if (filter === "nao_serve") return !r.serves;
    if (filter === "nao_contribui") return r.giveMonths === 0;
    return !filter || r.group === filter;
  });
  const pct = (n: number) => (all.length ? `${Math.round((n / all.length) * 100)}% de ${all.length}` : "—");
  const n = {
    batizados: all.filter((r) => r.baptized_at).length,
    servem: all.filter((r) => r.serves).length,
    eventos: all.filter((r) => r.events).length,
    contribuem: all.filter((r) => r.giveMonths).length,
    afastados: all.filter((r) => r.group === "afastado").length,
  };
  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ meses: String(months), ...(filter && { f: filter }), ...(withVisitors && { visitantes: "1" }), ...(q && { q }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `?${p}`;
  };
  const chip = "rounded-full px-2 py-0.5 text-xs font-medium";

  return (
    <>
      <PageHeader title="Engajamento" subtitle={`Quem serve, participa e contribui — últimos ${months} meses`} />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[3, 6, 12].map((m) => (
          <Link key={m} href={link({ meses: String(m) })} className={`rounded-lg px-3 py-1.5 ${m === months ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>{m} meses</Link>
        ))}
        <Link href={link({ visitantes: withVisitors ? "" : "1" })} className="rounded-lg bg-zinc-100 px-3 py-1.5">
          {withVisitors ? "☑" : "☐"} incluir visitantes
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="💧 Batizados" value={n.batizados} hint={pct(n.batizados)} />
        <Stat label="🙌 Servem" value={n.servem} hint={pct(n.servem)} />
        <Stat label="📅 Vão aos eventos" value={n.eventos} hint={pct(n.eventos)} />
        {canFinance ? <Stat label="💰 Contribuem" value={n.contribuem} hint={pct(n.contribuem)} /> : <Stat label="💰 Contribuem" value="—" hint="só o financeiro vê" />}
        <Stat label="⚠️ Sem participação" value={n.afastados} hint={pct(n.afastados)} />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 text-sm">
        {FILTERS.filter(([k]) => canFinance || k !== "nao_contribui").map(([k, label]) => (
          <Link key={k} href={link({ f: k })} className={`whitespace-nowrap rounded-lg px-3 py-2 ${filter === k ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>{label}</Link>
        ))}
      </div>
      <form className="mt-3 flex gap-2">
        <input type="hidden" name="meses" value={months} />
        {filter && <input type="hidden" name="f" value={filter} />}
        {withVisitors && <input type="hidden" name="visitantes" value="1" />}
        <input name="q" defaultValue={q} placeholder="Buscar pelo nome" className="input" />
        <button className="btn-ghost">Buscar</button>
      </form>

      {filter === "afastado" && shown.length > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Essas pessoas não serviram, não foram a eventos{canFinance ? " nem contribuíram" : ""} nos últimos {months} meses. Vale uma ligação ou visita pastoral. 🙏
        </p>
      )}

      <section className="card mt-4 p-0">
        <ul className="divide-y divide-zinc-100">
          {shown.map((r) => {
            const w = wa(r.phone);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/painel/${slug}/pessoas/${r.id}`} className="font-medium hover:underline">
                    {r.group === "engajado" ? "🔥 " : r.group === "afastado" ? "⚠️ " : ""}{r.full_name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {STATUS_LABEL[r.status] ?? r.status} · {r.last ? `última atividade ${date(r.last)}` : "nenhuma atividade no período"}
                    {w && r.group === "afastado" && <> · <a href={w} target="_blank" rel="noreferrer" className="text-emerald-700 underline">WhatsApp</a></>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`${chip} ${r.baptized_at ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-400"}`}>💧 {r.baptized_at ? "Batizado" : "Não batizado"}</span>
                  <span className={`${chip} ${r.serves ? "bg-violet-100 text-violet-800" : "bg-zinc-100 text-zinc-400"}`}>
                    🙌 {r.serves ? `${r.ministries} min. · ${r.scales} escala(s)` : "Não serve"}
                  </span>
                  <span className={`${chip} ${r.events ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-400"}`}>📅 {r.events} evento(s)</span>
                  {canFinance && (
                    <span className={`${chip} ${r.giveMonths ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-400"}`}>
                      💰 {r.giveMonths ? `${r.giveMonths}/${months} meses · ${brl(r.giveTotal)}` : "Não contribuiu"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {!shown.length && <div className="p-4"><Empty>Ninguém nesse filtro.</Empty></div>}
      </section>
      <p className="mt-3 text-xs text-zinc-500">
        Serve = está em algum ministério ou foi escalado. Eventos = inscrições/check-ins pelo app ou site.
        {canFinance ? " Contribui = dízimo/oferta ligado à pessoa (doação online ou lançamento do tesoureiro com o contribuinte escolhido)." : ""}
        {" "}O batismo é marcado no cadastro da pessoa.
      </p>
    </>
  );
}
