import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { MINISTRY_KINDS, kindOf } from "@/lib/ministries";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader } from "@/components/ui";
import { saveMinistry } from "../actions";

export const metadata = { title: "Ministérios" };

export default async function MinisteriosPage({ params }: PageProps<"/painel/[slug]/ministerios">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: ministries } = await supabase
    .from("ministries").select("id, name, kind, color, description, ministry_members(count)")
    .eq("church_id", church.id).order("name");

  return (
    <>
      <PageHeader title="Ministérios" subtitle="Equipes, líderes, funções, escalas e repertório" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="grid gap-4 sm:grid-cols-2">
          {ministries?.length ? ministries.map((m) => {
            const k = kindOf(m.kind);
            const count = (m.ministry_members as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <Link key={m.id} href={`/painel/${slug}/ministerios/${m.id}`} className="card border-l-4 hover:shadow-sm" style={{ borderLeftColor: m.color }}>
                <div className="text-2xl">{k.icon}</div>
                <h2 className="mt-2 font-semibold">{m.name}</h2>
                <p className="text-sm text-zinc-500">{k.label} · {count} pessoa(s)</p>
                {m.description && <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{m.description}</p>}
              </Link>
            );
          }) : <div className="sm:col-span-2"><Empty>Crie o primeiro ministério ao lado.</Empty></div>}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Novo ministério</h2>
          <ActionForm action={saveMinistry} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Tipo">
              <select name="kind" className="input">
                {Object.entries(MINISTRY_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Nome"><input name="name" required placeholder="ex.: Louvor Jovem" className="input" /></Field>
            <Field label="Descrição"><textarea name="description" rows={2} className="input" /></Field>
            <Field label="Cor"><input name="color" type="color" defaultValue="#4f46e5" className="h-10 w-20 rounded border border-zinc-300" /></Field>
            <p className="text-xs text-zinc-500">As funções padrão do tipo (ex.: Vocal, Bateria / Porta, Santa Ceia) são criadas automaticamente e podem ser editadas.</p>
            <Submit>Criar ministério</Submit>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
