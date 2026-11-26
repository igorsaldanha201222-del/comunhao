import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { brl, dateTime } from "@/lib/format";
import { Badge, PageHeader, Stat } from "@/components/ui";

export default async function Dashboard({ params }: PageProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { church, supabase, canFinance: isAdmin, isStaff, canMaintRequest } = await requireStaff(slug);
  // tesoureiro cai no financeiro; quem só cuida/abre chamados cai na manutenção
  if (!isStaff) redirect(`/painel/${slug}/${isAdmin || !canMaintRequest ? "financeiro" : "manutencao"}`);
  const id = church.id;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const now = new Date().toISOString();

  const [people, members, visitors, prayers, nextEvents, donations, alerts, schedules, maint] = await Promise.all([
    supabase.from("people").select("*", { count: "exact", head: true }).eq("church_id", id),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("church_id", id).eq("status", "membro"),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("church_id", id).eq("status", "visitante").gte("created_at", monthStart),
    supabase.from("prayer_requests").select("*", { count: "exact", head: true }).eq("church_id", id).is("prayed_at", null),
    supabase.from("events").select("id, title, starts_at").eq("church_id", id).gte("starts_at", now).order("starts_at").limit(5),
    isAdmin
      ? supabase.from("payments").select("amount_cents").eq("church_id", id).eq("kind", "doacao").eq("status", "pago").gte("paid_at", monthStart)
      : Promise.resolve({ data: null }),
    supabase.from("solar_alerts").select("id, message, solar_devices(name)").eq("church_id", id).is("resolved_at", null).limit(5),
    supabase.from("schedules").select("id, title, starts_at, ministry_id, ministries(name)").eq("church_id", id).gte("starts_at", now).order("starts_at").limit(5),
    supabase.from("maintenance_requests").select("priority").eq("church_id", id).in("status", ["aberta", "em_andamento", "aguardando"]),
  ]);
  const maintOpen = maint.data?.length ?? 0;
  const maintUrgent = (maint.data ?? []).filter((r) => r.priority === "urgente" || r.priority === "alta").length;

  const monthTotal = (donations.data ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const base = `/painel/${slug}`;

  return (
    <>
      <PageHeader title={`Olá, ${church.name}`} subtitle="Resumo da igreja" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Pessoas" value={people.count ?? 0} hint={`${members.count ?? 0} membros`} />
        <Stat label="Visitantes no mês" value={visitors.count ?? 0} />
        <Stat label="Orações pendentes" value={prayers.count ?? 0} />
        {isAdmin && <Stat label="Doações no mês" value={brl(monthTotal)} />}
      </div>

      {maintOpen > 0 && (
        <Link href={`${base}/manutencao`} className="mt-6 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Manutenção:</strong> {maintOpen} chamado(s) em aberto{maintUrgent ? `, ${maintUrgent} com prioridade alta/urgente` : ""}. Ver quadro →
        </Link>
      )}

      {(alerts.data?.length ?? 0) > 0 && (
        <Link href={`${base}/solar`} className="mt-6 block rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Energia solar:</strong>{" "}
          {alerts.data!.map((a) => `${(a.solar_devices as unknown as { name: string })?.name}: ${a.message}`).join(" · ")}
        </Link>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Próximos eventos</h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {(nextEvents.data ?? []).map((e) => (
              <li key={e.id} className="flex justify-between py-2">
                <Link href={`${base}/eventos/${e.id}`} className="hover:underline">{e.title}</Link>
                <span className="text-zinc-500">{dateTime(e.starts_at)}</span>
              </li>
            ))}
            {!nextEvents.data?.length && <li className="py-2 text-zinc-500">Nenhum evento agendado.</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="font-semibold">Próximas escalas</h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {(schedules.data ?? []).map((s) => (
              <li key={s.id} className="flex justify-between gap-2 py-2">
                <Link href={`${base}/ministerios/${s.ministry_id}/escalas/${s.id}`} className="hover:underline">
                  {s.title} <Badge>{(s.ministries as unknown as { name: string })?.name}</Badge>
                </Link>
                <span className="whitespace-nowrap text-zinc-500">{dateTime(s.starts_at)}</span>
              </li>
            ))}
            {!schedules.data?.length && <li className="py-2 text-zinc-500">Nenhuma escala futura.</li>}
          </ul>
        </section>
      </div>

      <section className="card mt-6 text-sm">
        <h2 className="font-semibold">Convide os membros</h2>
        <p className="mt-2 text-zinc-600">
          No aplicativo, os membros entram na igreja com o código <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">{slug}</code>.
          O site público da igreja fica em <Link className="underline" href={`/i/${slug}`}>/i/{slug}</Link>.
          Para a equipe (líderes, tesoureiro, manutenção) se cadastrar pelo computador, mande o link{" "}
          <Link className="underline" href={`/i/${slug}/participar`}>/i/{slug}/participar</Link> e depois libere o acesso em Configurações.
        </p>
      </section>
    </>
  );
}
