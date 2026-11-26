import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { brl, dateTime } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { EventForm } from "./event-form";

export const metadata = { title: "Eventos" };

export default async function EventosPage({ params }: PageProps<"/painel/[slug]/eventos">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: events } = await supabase
    .from("events").select("id, title, starts_at, price_cents, capacity, published, registrations(count)")
    .eq("church_id", church.id).order("starts_at", { ascending: false }).limit(100);

  return (
    <>
      <PageHeader title="Eventos" subtitle="Inscrições, ingressos e check-in" />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section>
          {events?.length ? (
            <div className="card overflow-x-auto p-0">
              <table className="tbl">
                <thead><tr><th>Evento</th><th>Data</th><th>Valor</th><th>Inscritos</th></tr></thead>
                <tbody>
                  {events.map((e) => {
                    const n = (e.registrations as unknown as { count: number }[])[0]?.count ?? 0;
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link href={`/painel/${slug}/eventos/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                          {!e.published && <span className="ml-2"><Badge>rascunho</Badge></span>}
                        </td>
                        <td>{dateTime(e.starts_at)}</td>
                        <td>{e.price_cents ? brl(e.price_cents) : "Gratuito"}</td>
                        <td>{n}{e.capacity ? ` / ${e.capacity}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty>Nenhum evento cadastrado.</Empty>}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Novo evento</h2>
          <EventForm slug={slug} />
        </section>
      </div>
    </>
  );
}
