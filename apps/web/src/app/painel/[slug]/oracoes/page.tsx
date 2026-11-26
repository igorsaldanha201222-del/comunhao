import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { markPrayed } from "../actions";

export const metadata = { title: "Pedidos de oração" };

export default async function OracoesPage({ params }: PageProps<"/painel/[slug]/oracoes">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: list } = await supabase.from("prayer_requests").select("*").eq("church_id", church.id)
    .order("prayed_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false }).limit(200);

  return (
    <>
      <PageHeader title="Pedidos de oração" subtitle="Enviados pelos membros no aplicativo" />
      {list?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <article key={p.id} className={`card ${p.prayed_at ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.author_name ?? "Membro"}</span>
                <Badge>{p.category}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{dateTime(p.created_at)}</span>
                {p.prayed_at ? (
                  <span>🙏 orado em {dateTime(p.prayed_at)}</span>
                ) : (
                  <form action={markPrayed}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-ghost py-1 text-xs">Marcar como orado</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : <Empty>Nenhum pedido de oração.</Empty>}
    </>
  );
}
