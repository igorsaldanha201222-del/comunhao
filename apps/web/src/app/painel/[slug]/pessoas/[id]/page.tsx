import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { addPastoralCare } from "../../actions";
import { PersonForm } from "../person-form";

export default async function PessoaPage({ params }: PageProps<"/painel/[slug]/pessoas/[id]">) {
  const { slug, id } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: person } = await supabase.from("people").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!person) notFound();

  const [{ data: care }, { data: ministries }] = await Promise.all([
    supabase.from("pastoral_care").select("*").eq("person_id", id).order("happened_at", { ascending: false }),
    supabase.from("ministry_members").select("is_leader, ministries(name)").eq("person_id", id),
  ]);

  return (
    <>
      <PageHeader title={person.full_name} subtitle="Cadastro e acompanhamento" />
      {!!ministries?.length && (
        <div className="mb-4 flex flex-wrap gap-2">
          {ministries.map((m, i) => (
            <Badge key={i} tone={m.is_leader ? "green" : "zinc"}>
              {(m.ministries as unknown as { name: string }).name}{m.is_leader ? " · líder" : ""}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><PersonForm slug={slug} person={person} /></section>
        <section className="card">
          <h2 className="font-semibold">Atendimentos</h2>
          <ActionForm action={addPastoralCare} className="mt-4 space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="person_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select name="kind" className="input"><option value="pastoral">Pastoral</option><option value="administrativo">Administrativo</option></select>
              </Field>
              <Field label="Motivo"><input name="reason" required placeholder="ex.: aconselhamento familiar" className="input" /></Field>
            </div>
            <Field label="Anotações (visíveis só para a equipe)"><textarea name="notes" rows={3} className="input" /></Field>
            <Submit>Registrar atendimento</Submit>
          </ActionForm>
          <ul className="mt-6 space-y-3 text-sm">
            {(care ?? []).map((c) => (
              <li key={c.id} className="rounded-lg bg-zinc-50 p-3">
                <div className="flex justify-between"><strong>{c.reason}</strong><span className="text-zinc-500">{dateTime(c.happened_at)}</span></div>
                <Badge>{c.kind}</Badge>
                {c.notes && <p className="mt-1 whitespace-pre-wrap text-zinc-700">{c.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
