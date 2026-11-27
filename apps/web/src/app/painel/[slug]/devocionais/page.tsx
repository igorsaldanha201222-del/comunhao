import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { Badge, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Devocionais" };

export default async function Devocionais({ params }: PageProps<"/painel/[slug]/devocionais">) {
  const { slug } = await params;
  const { church, supabase, isStaff } = await requireStaff(slug);
  if (!isStaff) redirect(`/painel/${slug}`);
  const { data } = await supabase.from("devotionals").select("id, title, verse_ref, publish_on, published, author")
    .eq("church_id", church.id).order("publish_on", { ascending: false }).limit(60);
  const today = todayBR(nowMs());

  return (
    <>
      <PageHeader title="Devocionais" subtitle="Aparecem no site da igreja no dia marcado — dá para deixar a semana toda agendada"
        actions={<Link href={`/painel/${slug}/devocionais/novo`} className="btn-primary">+ Novo devocional</Link>} />
      {data?.length ? (
        <section className="card p-0">
          <ul className="divide-y divide-zinc-100">
            {data.map((d) => (
              <li key={d.id}>
                <Link href={`/painel/${slug}/devocionais/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="text-xs text-zinc-500">{[d.verse_ref, d.author].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                    {date(d.publish_on)}
                    {!d.published ? <Badge tone="amber">Rascunho</Badge> : d.publish_on > today ? <Badge>Agendado</Badge> : d.publish_on === today ? <Badge tone="green">Hoje</Badge> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : <Empty>Nenhum devocional ainda.</Empty>}
    </>
  );
}
