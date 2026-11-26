import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader } from "@/components/ui";
import { saveBanner } from "../actions";

export const metadata = { title: "Banners" };

export default async function BannersPage({ params }: PageProps<"/painel/[slug]/banners">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: banners } = await supabase.from("banners").select("*").eq("church_id", church.id).order("position").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Banners" subtitle="Destaques que aparecem no início do app e do site" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-4 sm:grid-cols-2">
          {banners?.length ? banners.map((b) => (
            <article key={b.id} className="card p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt={b.title} className="aspect-[16/7] w-full rounded-t-xl object-cover" />
              <div className="p-3 text-sm">
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-zinc-500">
                  {b.starts_at || b.ends_at ? `${dateTime(b.starts_at)} até ${dateTime(b.ends_at)}` : "Sempre visível"}
                </p>
              </div>
            </article>
          )) : <div className="sm:col-span-2"><Empty>Nenhum banner.</Empty></div>}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Novo banner</h2>
          <ActionForm action={saveBanner} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Título"><input name="title" required className="input" /></Field>
            <Field label="Imagem (proporção 16:7)"><input name="image" type="file" accept="image/*" required className="text-sm" /></Field>
            <Field label="Link ao tocar (opcional)"><input name="link_url" type="url" className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exibir de"><input name="starts_at" type="datetime-local" className="input" /></Field>
              <Field label="Até"><input name="ends_at" type="datetime-local" className="input" /></Field>
            </div>
            <Field label="Ordem"><input name="position" type="number" defaultValue={0} className="input" /></Field>
            <Submit>Publicar banner</Submit>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
