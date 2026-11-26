import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date } from "@/lib/format";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { addVisitor, deleteService, saveHeadcount } from "../actions";
import { RollCall } from "./roll-call";

export const metadata = { title: "Chamada do culto" };

export default async function Chamada({ params }: PageProps<"/painel/[slug]/presenca/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, canAttendance } = await requireStaff(slug);
  if (!canAttendance) redirect(`/painel/${slug}`);
  const { data: svc } = await supabase.from("services").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!svc) notFound();
  const [{ data: people }, { data: att }] = await Promise.all([
    supabase.rpc("attendance_people", { p_church: church.id }),
    supabase.from("service_attendance").select("person_id").eq("service_id", id),
  ]);

  return (
    <>
      <Link href={`/painel/${slug}/presenca`} className="text-sm text-zinc-500 hover:underline">← Cultos</Link>
      <PageHeader title={svc.title} subtitle={date(svc.service_date)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <RollCall slug={slug} serviceId={id}
          people={(people ?? []) as { id: string; full_name: string; status: string }[]}
          present={(att ?? []).map((a) => a.person_id)} />

        <div className="space-y-6">
          <section className="card">
            <h2 className="font-semibold">👋 Visitante novo</h2>
            <p className="text-xs text-zinc-500">Cadastra e já marca presente. Ele aparece em Pessoas como visitante.</p>
            <ActionForm action={addVisitor} className="mt-3 space-y-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="service_id" value={id} />
              <input name="name" required placeholder="Nome" className="input" />
              <input name="phone" type="tel" placeholder="WhatsApp (opcional)" className="input" />
              <Submit className="btn-primary w-full">Adicionar visitante</Submit>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="font-semibold">Contagem do público</h2>
            <p className="text-xs text-zinc-500">Total de pessoas no culto (inclusive quem não está na lista).</p>
            <form action={saveHeadcount} className="mt-3 flex gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <input name="headcount" type="number" min={0} defaultValue={svc.headcount ?? ""} placeholder="ex.: 120" className="input" />
              <button className="btn-ghost">Salvar</button>
            </form>
          </section>

          <form action={deleteService}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message="Excluir este culto e a chamada?">Excluir culto</ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
