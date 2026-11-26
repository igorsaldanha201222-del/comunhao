import { requireStaff } from "@/lib/auth";
import { date, youtubeId } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader } from "@/components/ui";
import { saveSermon } from "../actions";

export const metadata = { title: "Pregações" };

export default async function PregacoesPage({ params }: PageProps<"/painel/[slug]/pregacoes">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: sermons } = await supabase.from("sermons").select("*").eq("church_id", church.id).order("preached_at", { ascending: false }).limit(60);

  return (
    <>
      <PageHeader title="Pregações" subtitle="Vídeos do YouTube ou áudios, organizados por série" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="grid gap-4 sm:grid-cols-2">
          {sermons?.length ? sermons.map((s) => {
            const yt = youtubeId(s.video_url);
            return (
              <article key={s.id} className="card p-0">
                {yt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-t-xl object-cover" />
                )}
                <div className="p-4">
                  <h2 className="font-medium">{s.title}</h2>
                  <p className="text-sm text-zinc-500">{[s.preacher, s.series, date(s.preached_at)].filter(Boolean).join(" · ")}</p>
                  {s.audio_url && <audio controls src={s.audio_url} className="mt-2 w-full" />}
                </div>
              </article>
            );
          }) : <div className="sm:col-span-2"><Empty>Nenhuma pregação publicada.</Empty></div>}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Publicar pregação</h2>
          <ActionForm action={saveSermon} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Título"><input name="title" required className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pregador"><input name="preacher" className="input" /></Field>
              <Field label="Data"><input name="preached_at" type="date" className="input" /></Field>
            </div>
            <Field label="Série"><input name="series" className="input" /></Field>
            <Field label="Link do YouTube"><input name="video_url" type="url" className="input" /></Field>
            <Field label="Áudio (MP3) — opcional"><input name="audio_file" type="file" accept="audio/*" className="text-sm" /></Field>
            <Field label="Resumo"><textarea name="description" rows={3} className="input" /></Field>
            <Submit>Publicar</Submit>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
