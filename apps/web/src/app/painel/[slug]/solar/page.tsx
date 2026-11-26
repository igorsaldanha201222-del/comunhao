import { requireStaff } from "@/lib/auth";
import { dateTime, nowMs } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader, Stat } from "@/components/ui";
import { createSolarDevice, resolveSolarAlert } from "../actions";
import { PowerChart } from "./power-chart";

export const metadata = { title: "Energia solar" };

// Status sempre com ícone + texto (cor nunca sozinha).
const STATUS = {
  gerando: { icon: "●", label: "Gerando", cls: "text-emerald-700" },
  parado: { icon: "◐", label: "Parado", cls: "text-amber-700" },
  falha: { icon: "▲", label: "Falha", cls: "text-red-700" },
  offline: { icon: "○", label: "Sem comunicação", cls: "text-zinc-500" },
} as const;

const ALERT_LABEL: Record<string, string> = { falha: "Falha no inversor", offline: "Sem comunicação", sem_geracao: "Sem geração" };

export default async function SolarPage({ params }: PageProps<"/painel/[slug]/solar">) {
  const { slug } = await params;
  const { church, supabase, isAdmin } = await requireStaff(slug);
  const todayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T00:00:00-03:00");
  const weekAgo = new Date(todayStart.getTime() - 6 * 86400_000);

  const [{ data: devices }, { data: alerts }, { data: readings }] = await Promise.all([
    supabase.from("solar_devices").select("*").eq("church_id", church.id).order("name"),
    supabase.from("solar_alerts").select("*, solar_devices(name)").eq("church_id", church.id)
      .order("resolved_at", { ascending: true, nullsFirst: true }).order("opened_at", { ascending: false }).limit(30),
    supabase.from("solar_readings").select("device_id, measured_at, power_w, energy_today_kwh")
      .eq("church_id", church.id).gte("measured_at", weekAgo.toISOString()).order("measured_at").limit(20000),
  ]);

  const offline = (d: { last_seen_at: string | null }) => !d.last_seen_at || nowMs() - new Date(d.last_seen_at).getTime() > 15 * 60_000;
  const openAlerts = (alerts ?? []).filter((a) => !a.resolved_at);

  // Energia por dia = maior "energia hoje" reportada em cada dia, somada entre aparelhos.
  const dayKey = (t: string) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const perDay = new Map<string, Map<string, number>>();
  (readings ?? []).forEach((r) => {
    if (r.energy_today_kwh == null) return;
    const d = dayKey(r.measured_at);
    const m = perDay.get(d) ?? new Map();
    m.set(r.device_id, Math.max(m.get(r.device_id) ?? 0, Number(r.energy_today_kwh)));
    perDay.set(d, m);
  });
  const days = [...perDay].map(([d, m]) => ({ d, kwh: [...m.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => b.d.localeCompare(a.d));
  const todayKwh = days.find((x) => x.d === dayKey(new Date().toISOString()))?.kwh ?? 0;
  const weekKwh = days.reduce((s, x) => s + x.kwh, 0);
  const nowKw = (devices ?? []).filter((d) => !offline(d)).reduce((s, d) => s + Number(d.last_power_w ?? 0), 0) / 1000;
  const fmt = (n: number, unit: string) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;

  return (
    <>
      <PageHeader title="Energia solar" subtitle="Geração, falhas e comunicação do sistema fotovoltaico" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Potência agora" value={fmt(nowKw, "kW")} />
        <Stat label="Energia hoje" value={fmt(todayKwh, "kWh")} />
        <Stat label="Últimos 7 dias" value={fmt(weekKwh, "kWh")} hint={`≈ ${fmt(weekKwh * 0.9, "reais")} economizados (R$ 0,90/kWh)`} />
        <Stat label="Alertas abertos" value={openAlerts.length} />
      </div>

      {(devices ?? []).map((d) => {
        const st = offline(d) ? STATUS.offline : STATUS[(d.last_status as keyof typeof STATUS) ?? "parado"] ?? STATUS.parado;
        const pts = (readings ?? []).filter((r) => r.device_id === d.id && r.measured_at >= todayStart.toISOString() && r.power_w != null)
          .map((r) => ({ t: r.measured_at, w: Number(r.power_w) }));
        return (
          <section key={d.id} className="card mt-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">{d.name} · potência hoje</h2>
                <p className="text-xs text-zinc-500">
                  {[d.inverter_brand, d.inverter_model, d.rated_power_kw && `${d.rated_power_kw} kW`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className={`text-sm font-medium ${st.cls}`}>
                <span aria-hidden>{st.icon}</span> {st.label} <span className="font-normal text-zinc-500">· última leitura {dateTime(d.last_seen_at)}</span>
              </p>
            </div>
            <PowerChart points={pts} ratedKw={d.rated_power_kw ? Number(d.rated_power_kw) : null} />
          </section>
        );
      })}
      {!devices?.length && <div className="mt-6"><Empty>Nenhum aparelho de monitoramento cadastrado.</Empty></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="font-semibold">Alertas</h2>
          {alerts?.length ? (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {alerts.map((a) => (
                <li key={a.id} className={`flex items-center justify-between gap-2 py-2 ${a.resolved_at ? "opacity-50" : ""}`}>
                  <div>
                    <p className="font-medium">
                      <span aria-hidden className={a.resolved_at ? "" : "text-red-700"}>{a.resolved_at ? "✓" : "▲"}</span>{" "}
                      {ALERT_LABEL[a.kind]} · {(a.solar_devices as unknown as { name: string })?.name}
                    </p>
                    <p className="text-xs text-zinc-500">{a.message} · desde {dateTime(a.opened_at)}{a.resolved_at && ` · resolvido ${dateTime(a.resolved_at)}`}</p>
                  </div>
                  {!a.resolved_at && (
                    <form action={resolveSolarAlert}>
                      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={a.id} />
                      <button className="btn-ghost py-1 text-xs">Marcar resolvido</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-zinc-500">Nenhum alerta. Tudo funcionando.</p>}
        </section>

        <section className="card">
          <h2 className="font-semibold">Energia por dia</h2>
          <table className="tbl mt-2">
            <thead><tr><th>Dia</th><th className="text-right">kWh</th></tr></thead>
            <tbody>
              {days.map((x) => (
                <tr key={x.d}><td>{x.d.split("-").reverse().join("/")}</td><td className="text-right tabular-nums">{x.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td></tr>
              ))}
              {!days.length && <tr><td colSpan={2} className="text-zinc-500">Sem dados.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      {isAdmin && (
        <section className="card mt-6">
          <h2 className="font-semibold">Cadastrar aparelho de monitoramento</h2>
          <p className="mt-1 text-sm text-zinc-500">
            O token gerado vai gravado no firmware do aparelho. Ele envia as leituras do inversor para a nuvem a cada minuto.
          </p>
          <ActionForm action={createSolarDevice} reset={false} className="mt-4 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome"><input name="name" required placeholder="Inversor do telhado" className="input" /></Field>
            <Field label="Marca do inversor"><input name="brand" placeholder="Growatt, Huawei…" className="input" /></Field>
            <Field label="Modelo"><input name="model" className="input" /></Field>
            <Field label="Potência nominal (kW)"><input name="kw" inputMode="decimal" className="input" /></Field>
            <div className="sm:col-span-4"><Submit>Cadastrar e gerar token</Submit></div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
