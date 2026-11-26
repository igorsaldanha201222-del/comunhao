import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader } from "@/components/ui";
import { createService } from "./actions";

export const metadata = { title: "Presença no culto" };

const TITLES = ["Culto de Domingo", "Culto da Família", "Culto de Oração", "Culto de Ensino", "Santa Ceia", "Culto de Jovens"];

export default async function Presenca({ params }: PageProps<"/painel/[slug]/presenca">) {
  const { slug } = await params;
  const { church, supabase, canAttendance, isStaff } = await requireStaff(slug);
  if (!canAttendance) redirect(`/painel/${slug}`);

  const [{ data: services }, { data: att }, { data: people }] = await Promise.all([
    supabase.from("services").select("id, service_date, title, headcount").eq("church_id", church.id).order("service_date", { ascending: false }).limit(30),
    supabase.from("service_attendance").select("service_id, person_id").eq("church_id", church.id),
    supabase.rpc("attendance_people", { p_church: church.id }),
  ]);
  const list = services ?? [];
  const bySvc = new Map<string, number>();
  for (const a of att ?? []) bySvc.set(a.service_id, (bySvc.get(a.service_id) ?? 0) + 1);

  // Membros que faltaram aos últimos 3 cultos (só para a liderança — cuidado pastoral)
  const last3 = list.slice(0, 3).map((s) => s.id);
  const cameRecently = new Set((att ?? []).filter((a) => last3.includes(a.service_id)).map((a) => a.person_id));
  const missing = last3.length === 3
    ? ((people ?? []) as { id: string; full_name: string; status: string }[])
        .filter((p) => (p.status === "membro" || p.status === "novo_convertido") && !cameRecently.has(p.id))
    : [];
  const base = `/painel/${slug}/presenca`;

  return (
    <>
      <PageHeader title="Presença no culto" subtitle="Faça a chamada pelo celular: toque no nome de quem veio" />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="card h-fit">
          <h2 className="font-semibold">Abrir a chamada</h2>
          <ActionForm action={createService} reset={false} className="mt-3 space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Data"><input name="service_date" type="date" defaultValue={todayBR(nowMs())} required className="input" /></Field>
            <Field label="Culto">
              <input name="title" list="titulos" defaultValue="Culto de Domingo" required className="input" />
              <datalist id="titulos">{TITLES.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Submit className="btn-primary w-full">✋ Começar a chamada</Submit>
          </ActionForm>
          <p className="mt-3 text-xs text-zinc-500">Quem pode fazer a chamada: a liderança e quem está nos ministérios de Diaconato ou Recepção.</p>
        </section>

        <div className="space-y-6">
          {isStaff && missing.length > 0 && (
            <section className="card border-amber-300 bg-amber-50/60">
              <h2 className="font-semibold text-amber-900">⚠️ Faltaram aos últimos 3 cultos · {missing.length}</h2>
              <p className="text-xs text-amber-800">Membros que não foram marcados em nenhum dos 3 últimos cultos. Vale uma ligação. 🙏</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {missing.map((p) => (
                  <Link key={p.id} href={`/painel/${slug}/pessoas/${p.id}`} className="rounded-full bg-white px-3 py-1 text-sm hover:underline">{p.full_name}</Link>
                ))}
              </div>
            </section>
          )}

          <section className="card p-0">
            <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">Cultos</h2>
            {list.length ? (
              <ul className="divide-y divide-zinc-100">
                {list.map((s) => (
                  <li key={s.id}>
                    <Link href={`${base}/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-zinc-500">{date(s.service_date)}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p><strong>{bySvc.get(s.id) ?? 0}</strong> na chamada</p>
                        {s.headcount != null && <p className="text-xs text-zinc-500">{s.headcount} no total</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <div className="p-4"><Empty>Nenhum culto ainda. Abra a chamada ao lado.</Empty></div>}
          </section>
        </div>
      </div>
    </>
  );
}
