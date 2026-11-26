import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { nowMs } from "@/lib/format";
import { ageLabel } from "@/lib/kids";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { addRoom, saveChild, toggleRoom } from "../actions";
import { KidsTabs } from "../tabs";

export const metadata = { title: "Kids · Crianças" };

export default async function Criancas({ params, searchParams }: PageProps<"/painel/[slug]/kids/criancas">) {
  const { slug } = await params;
  const { q, novo } = await searchParams;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const now = nowMs();
  const term = typeof q === "string" ? q.trim() : "";

  let query = supabase.from("kids_children")
    .select("id, full_name, birth_date, allergies, kids_guardians(name, user_id)").eq("church_id", church.id).order("full_name");
  if (term) query = query.ilike("full_name", `%${term}%`);
  const [{ data: kids }, { data: rooms }] = await Promise.all([
    query,
    supabase.from("kids_rooms").select("id, name, min_age, max_age, color, active").eq("church_id", church.id).order("position"),
  ]);

  return (
    <>
      <PageHeader title="Ministério Kids" subtitle={`${kids?.length ?? 0} criança(s) cadastrada(s)`} />
      <KidsTabs slug={slug} active="/criancas" />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-0">
          <form className="flex gap-2 border-b border-zinc-200 p-3">
            <input name="q" defaultValue={term} placeholder="Buscar pelo nome" className="input" />
            <button className="btn-ghost">Buscar</button>
          </form>
          <ul className="divide-y divide-zinc-100">
            {(kids ?? []).map((k) => {
              const g = k.kids_guardians as { name: string; user_id: string | null }[];
              return (
                <li key={k.id}>
                  <Link href={`/painel/${slug}/kids/criancas/${k.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{k.full_name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {ageLabel(k.birth_date, now) ?? "sem data de nascimento"} · {g.map((x) => x.name).join(", ") || "sem responsável"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {k.allergies && <Badge tone="red">⚠ Alergia</Badge>}
                      {g.some((x) => x.user_id) && <Badge tone="green">App</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
            {!kids?.length && <li className="p-6 text-center text-sm text-zinc-500">Nenhuma criança encontrada.</li>}
          </ul>
        </section>

        <div className="space-y-6">
          <details open={novo !== undefined} className="card">
            <summary className="cursor-pointer font-semibold">+ Cadastrar criança</summary>
            <ActionForm action={saveChild} className="mt-4 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Nome da criança"><input name="full_name" required className="input" /></Field>
              <Field label="Data de nascimento"><input name="birth_date" type="date" className="input" /></Field>
              <Field label="Alergias / restrições alimentares"><input name="allergies" placeholder="ex.: amendoim, lactose" className="input" /></Field>
              <Field label="Cuidados de saúde (remédios, necessidades especiais)"><textarea name="medical_notes" rows={2} className="input" /></Field>
              <p className="pt-2 text-xs font-semibold uppercase text-zinc-500">Responsável</p>
              <Field label="Nome"><input name="guardian_name" className="input" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Telefone"><input name="guardian_phone" type="tel" className="input" /></Field>
                <Field label="Parentesco"><input name="guardian_relationship" placeholder="Mãe, pai, avó…" className="input" /></Field>
              </div>
              <Submit>Cadastrar</Submit>
              <p className="text-xs text-zinc-500">Os pais também podem cadastrar os filhos pelo app, em Perfil → Kids.</p>
            </ActionForm>
          </details>

          <section className="card">
            <h2 className="font-semibold">Turmas</h2>
            <p className="text-xs text-zinc-500">No check-in, a criança vai para a turma da idade dela.</p>
            <ul className="mt-2 divide-y divide-zinc-100 text-sm">
              {(rooms ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                    <span className={r.active ? "" : "text-zinc-400 line-through"}>{r.name}</span>
                    <span className="text-xs text-zinc-500">{r.min_age}–{r.max_age} anos</span>
                  </span>
                  <form action={toggleRoom}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                    <button className="text-xs underline">{r.active ? "Desativar" : "Reativar"}</button>
                  </form>
                </li>
              ))}
            </ul>
            <ActionForm action={addRoom} className="mt-3 grid grid-cols-[1fr_56px_56px_44px] gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input name="name" required placeholder="Nova turma" className="input" />
              <input name="min_age" type="number" min={0} max={17} defaultValue={0} title="Idade mínima" className="input px-2" />
              <input name="max_age" type="number" min={0} max={17} defaultValue={12} title="Idade máxima" className="input px-2" />
              <input name="color" type="color" defaultValue="#f59e0b" className="h-10 w-full rounded border border-zinc-300" />
              <div className="col-span-4"><Submit className="btn-ghost">Adicionar turma</Submit></div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
