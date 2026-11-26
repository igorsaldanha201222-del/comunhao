import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date } from "@/lib/format";
import type { Attachment } from "@/lib/kids";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { KidsTabs } from "../tabs";

export const metadata = { title: "Kids · Aulas" };

export default async function Aulas({ params }: PageProps<"/painel/[slug]/kids/aulas">) {
  const { slug } = await params;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const [{ data: lessons }, { data: rooms }] = await Promise.all([
    supabase.from("kids_lessons").select("id, lesson_date, title, bible_verse, room_id, published, attachments, home_activity")
      .eq("church_id", church.id).order("lesson_date", { ascending: false }).limit(60),
    supabase.from("kids_rooms").select("id, name, color").eq("church_id", church.id),
  ]);
  const room = (id: string | null) => rooms?.find((r) => r.id === id);

  return (
    <>
      <PageHeader title="Ministério Kids" subtitle="Programação das aulas, atividades e materiais"
        actions={<Link href={`/painel/${slug}/kids/aulas/nova`} className="btn-primary">+ Nova aula</Link>} />
      <KidsTabs slug={slug} active="/aulas" />
      {lessons?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.map((l) => {
            const r = room(l.room_id);
            const files = (l.attachments ?? []) as Attachment[];
            return (
              <Link key={l.id} href={`/painel/${slug}/kids/aulas/${l.id}`} className="card block hover:border-zinc-400"
                style={{ borderTop: `4px solid ${r?.color ?? "#a1a1aa"}` }}>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>{date(l.lesson_date)} · {r?.name ?? "Todas as turmas"}</span>
                  {!l.published && <Badge tone="amber">Rascunho</Badge>}
                </div>
                <h2 className="mt-1 font-semibold">{l.title}</h2>
                {l.bible_verse && <p className="mt-1 text-sm italic text-zinc-600">{l.bible_verse}</p>}
                <p className="mt-2 text-xs text-zinc-500">
                  {[l.home_activity && "🏠 atividade para casa", files.length && `📎 ${files.length} anexo(s)`].filter(Boolean).join(" · ")}
                </p>
              </Link>
            );
          })}
        </div>
      ) : <Empty>Nenhuma aula ainda. Clique em “Nova aula” para postar a programação e as atividades.</Empty>}
    </>
  );
}
