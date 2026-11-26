import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL, brl, dateTime } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";
import { checkIn } from "../../actions";
import { EventForm } from "../event-form";

export default async function EventoPage({ params }: PageProps<"/painel/[slug]/eventos/[id]">) {
  const { slug, id } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: ev } = await supabase.from("events").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!ev) notFound();
  const { data: regs } = await supabase.from("registrations").select("*").eq("event_id", id).order("created_at");

  const confirmed = (regs ?? []).filter((r) => r.status === "confirmada");
  const present = confirmed.filter((r) => r.checked_in_at).length;

  return (
    <>
      <PageHeader title={ev.title} subtitle={`${dateTime(ev.starts_at)}${ev.location ? " · " + ev.location : ""}`}
        actions={<Link href={`/painel/${slug}/eventos`} className="btn-ghost">Voltar</Link>} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Confirmadas" value={confirmed.length} hint={ev.capacity ? `de ${ev.capacity} vagas` : "vagas ilimitadas"} />
        <Stat label="Pendentes de pagamento" value={(regs ?? []).filter((r) => r.status === "pendente").length} />
        <Stat label="Presentes (check-in)" value={present} />
        <Stat label="Receita confirmada" value={brl(confirmed.length * ev.price_cents)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="card">
            <h2 className="font-semibold">Check-in</h2>
            <p className="mt-1 text-sm text-zinc-500">Digite ou leia com um leitor de QR o código do ingresso que aparece no app do participante.</p>
            <ActionForm action={checkIn} className="mt-3 flex gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="event_id" value={id} />
              <input name="code" autoFocus required placeholder="Código do ingresso" className="input font-mono" />
              <Submit>Confirmar</Submit>
            </ActionForm>
          </div>
          <div className="card overflow-x-auto p-0">
            {regs?.length ? (
              <table className="tbl">
                <thead><tr><th>Nome</th><th>Contato</th><th>Situação</th><th>Check-in</th></tr></thead>
                <tbody>
                  {regs.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.name}</td>
                      <td className="text-xs">{r.email}<br />{r.phone}</td>
                      <td><Badge tone={r.status === "confirmada" ? "green" : r.status === "pendente" ? "amber" : "red"}>{STATUS_LABEL[r.status]}</Badge></td>
                      <td>{r.checked_in_at ? dateTime(r.checked_in_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="p-5"><Empty>Nenhuma inscrição ainda.</Empty></div>}
          </div>
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Editar evento</h2>
          <EventForm slug={slug} ev={ev} />
        </section>
      </div>
    </>
  );
}
