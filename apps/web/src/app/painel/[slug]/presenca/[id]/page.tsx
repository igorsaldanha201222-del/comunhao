import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { addVisitor, deleteService, requestConfirmation, saveHeadcount } from "../actions";
import { RollCall } from "./roll-call";

export const metadata = { title: "Chamada do culto" };

export default async function Chamada({ params }: PageProps<"/painel/[slug]/presenca/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, canAttendance, isStaff } = await requireStaff(slug);
  if (!canAttendance) redirect(`/painel/${slug}`);
  const { data: svc } = await supabase.from("services").select("id, title, service_date, headcount, confirm_sent_at").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!svc) notFound();
  const [{ data: people }, { data: att }] = await Promise.all([
    supabase.rpc("attendance_people", { p_church: church.id }),
    supabase.from("service_attendance").select("person_id, source").eq("service_id", id),
  ]);

  const isToday = svc.service_date === todayBR(nowMs());

  return (
    <>
      <Link href={`/painel/${slug}/presenca`} className="text-sm text-zinc-500 hover:underline">← Cultos</Link>
      <PageHeader title={svc.title} subtitle={date(svc.service_date)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <RollCall slug={slug} serviceId={id}
          people={(people ?? []) as { id: string; full_name: string; status: string }[]}
          present={(att ?? []).map((a) => a.person_id)}
          sources={Object.fromEntries((att ?? []).filter((a) => a.source !== "manual").map((a) => [a.person_id, a.source]))} />

        <div className="space-y-6">
          {isToday && (
            <section className="card border-indigo-200 bg-indigo-50/50">
              <h2 className="font-semibold">📲 Confirmação pelo celular</h2>
              <p className="text-xs text-zinc-600">
                Quem tem o app responde <strong>Sim</strong> e a presença entra sozinha aqui, conferida pelo GPS (📍). Quem preferir, aponta a câmera para o QR Code na entrada.
              </p>
              {isStaff && (svc.confirm_sent_at
                ? <p className="mt-3 text-sm text-emerald-700">✓ Pedido enviado às {new Date(svc.confirm_sent_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</p>
                : church.lat == null
                  ? <p className="mt-3 text-xs text-amber-800">Marque antes o <Link href={`/painel/${slug}/presenca`} className="underline">local da igreja</Link>.</p>
                  : (
                    <ActionForm action={requestConfirmation} reset={false} className="mt-3">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={id} />
                      <Submit className="btn-primary w-full">🙏 Pedir confirmação pelo app</Submit>
                    </ActionForm>
                  ))}
              <Link href={`/painel/${slug}/presenca/${id}/qr`} className="btn-ghost mt-2 w-full">🔳 Mostrar QR Code da entrada</Link>
            </section>
          )}

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
