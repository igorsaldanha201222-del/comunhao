import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { deleteDevotional, saveDevotional } from "../actions";

export const metadata = { title: "Devocional" };

export default async function DevocionalForm({ params, searchParams }: PageProps<"/painel/[slug]/devocionais/[id]">) {
  const { slug, id } = await params;
  const { salvo } = await searchParams;
  const { church, supabase, isStaff, user } = await requireStaff(slug);
  if (!isStaff) redirect(`/painel/${slug}`);
  const isNew = id === "novo";
  const { data: d } = isNew ? { data: null } : await supabase.from("devotionals").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!isNew && !d) notFound();
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <>
      <Link href={`/painel/${slug}/devocionais`} className="text-sm text-zinc-500 hover:underline">← Devocionais</Link>
      <PageHeader title={isNew ? "Novo devocional" : d!.title}
        actions={!isNew ? <a href={`/i/${slug}/devocional/${id}`} target="_blank" className="btn-ghost">Ver no site ↗</a> : undefined} />
      {salvo && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Devocional salvo.</p>}

      <ActionForm action={saveDevotional} reset={false} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4">
          <input type="hidden" name="slug" value={slug} />
          {!isNew && <input type="hidden" name="id" value={id} />}
          <Field label="Título"><input name="title" required defaultValue={d?.title ?? ""} placeholder="ex.: O Senhor é o meu pastor" className="input" /></Field>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Field label="Referência"><input name="verse_ref" defaultValue={d?.verse_ref ?? ""} placeholder="Salmos 23:1" className="input" /></Field>
            <Field label="Versículo"><input name="verse_text" defaultValue={d?.verse_text ?? ""} placeholder="O SENHOR é meu pastor, nada me faltará." className="input" /></Field>
          </div>
          <Field label="Mensagem"><textarea name="body" required rows={12} defaultValue={d?.body ?? ""} className="input" /></Field>
          <Field label="Oração (opcional)"><textarea name="prayer" rows={3} defaultValue={d?.prayer ?? ""} className="input" /></Field>
        </div>
        <div className="space-y-6">
          <section className="card space-y-3">
            <Field label="Publicar em"><input name="publish_on" type="date" defaultValue={d?.publish_on ?? todayBR(nowMs())} className="input" /></Field>
            <Field label="Autor"><input name="author" defaultValue={d?.author ?? me?.full_name ?? ""} className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={d?.published ?? true} /> Publicado (desmarque para rascunho)</label>
          </section>
          <section className="card space-y-3">
            <h2 className="font-semibold">Imagem de capa (opcional)</h2>
            {d?.image_url && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.image_url} alt="" className="aspect-[16/7] w-full rounded-lg object-cover" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_image" /> Remover imagem</label>
              </>
            )}
            <input name="image" type="file" accept="image/*" className="text-sm" />
          </section>
          <Submit className="btn-primary w-full">{isNew ? "Salvar devocional" : "Salvar alterações"}</Submit>
        </div>
      </ActionForm>

      {!isNew && (
        <form action={deleteDevotional} className="mt-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message="Excluir este devocional?">Excluir devocional</ConfirmButton>
        </form>
      )}
    </>
  );
}
