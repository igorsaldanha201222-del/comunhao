import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { nowMs } from "@/lib/format";
import { todayBR, type Attachment } from "@/lib/kids";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { deleteLesson, saveLesson } from "../../actions";

export const metadata = { title: "Kids · Aula" };

export default async function Aula({ params, searchParams }: PageProps<"/painel/[slug]/kids/aulas/[id]">) {
  const { slug, id } = await params;
  const { salvo } = await searchParams;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const isNew = id === "nova";
  const [{ data: l }, { data: rooms }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : supabase.from("kids_lessons").select("*").eq("id", id).eq("church_id", church.id).maybeSingle(),
    supabase.from("kids_rooms").select("id, name").eq("church_id", church.id).eq("active", true).order("position"),
  ]);
  if (!isNew && !l) notFound();
  const files = (l?.attachments ?? []) as Attachment[];

  return (
    <>
      <Link href={`/painel/${slug}/kids/aulas`} className="text-sm text-zinc-500 hover:underline">← Aulas</Link>
      <PageHeader title={isNew ? "Nova aula" : l!.title} subtitle="O que for publicado aparece para os pais no app" />
      {salvo && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Aula salva.</p>}

      <ActionForm action={saveLesson} reset={false} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-4">
          <input type="hidden" name="slug" value={slug} />
          {!isNew && <input type="hidden" name="id" value={id} />}
          <Field label="Título da aula"><input name="title" required defaultValue={l?.title ?? ""} placeholder="ex.: Davi e Golias — coragem que vem de Deus" className="input" /></Field>
          <Field label="Versículo"><input name="bible_verse" defaultValue={l?.bible_verse ?? ""} placeholder="ex.: “O Senhor é a minha força” — Salmos 28:7" className="input" /></Field>
          <Field label="Programação da aula (roteiro)">
            <textarea name="plan" rows={9} defaultValue={l?.plan ?? ""} className="input font-mono text-[13px]"
              placeholder={"9h00 — Acolhida e louvor\n9h15 — História bíblica\n9h35 — Atividade: dobradura da funda\n9h50 — Lanche\n10h00 — Oração e despedida"} />
          </Field>
          <Field label="Atividade para fazer em casa (aparece para os pais)">
            <textarea name="home_activity" rows={4} defaultValue={l?.home_activity ?? ""} className="input"
              placeholder="ex.: Conversem sobre um medo que a criança tem e orem juntos. Desenhem o Davi." />
          </Field>
          <Field label="Materiais necessários (para a equipe)">
            <textarea name="materials" rows={2} defaultValue={l?.materials ?? ""} placeholder="ex.: papel color set, cola, 5 pedrinhas" className="input" />
          </Field>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3">
            <Field label="Data"><input name="lesson_date" type="date" defaultValue={l?.lesson_date ?? todayBR(nowMs())} className="input" /></Field>
            <Field label="Turma">
              <select name="room_id" defaultValue={l?.room_id ?? ""} className="input">
                <option value="">Todas as turmas</option>
                {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={l?.published ?? true} /> Publicar para os pais</label>
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Anexos</h2>
            <p className="text-xs text-zinc-500">Folha de atividade (PDF), desenho para colorir, fotos da aula…</p>
            {files.map((a) => (
              <label key={a.url} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="keep" value={a.url} defaultChecked />
                <a href={a.url} target="_blank" rel="noreferrer" className="truncate underline">{a.name}</a>
              </label>
            ))}
            {files.length > 0 && <p className="text-xs text-zinc-400">Desmarque para remover ao salvar.</p>}
            <input name="files" type="file" multiple accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx" className="text-sm" />
          </section>

          <Submit className="btn-primary w-full">{isNew ? "Salvar aula" : "Salvar alterações"}</Submit>
        </div>
      </ActionForm>

      {!isNew && (
        <form action={deleteLesson} className="mt-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message="Excluir esta aula?">Excluir aula</ConfirmButton>
        </form>
      )}
    </>
  );
}
