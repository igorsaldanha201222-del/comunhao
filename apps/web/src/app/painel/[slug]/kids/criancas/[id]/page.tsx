import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, dateTime, nowMs } from "@/lib/format";
import { ageLabel } from "@/lib/kids";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { addGuardian, checkIn, deleteChild, removeGuardian, saveChild } from "../../actions";

export const metadata = { title: "Kids · Criança" };

const STATUS: Record<string, [string, "green" | "amber" | "zinc" | "red"]> = {
  pre: ["Pré-check-in", "amber"], presente: ["Na sala", "green"], retirado: ["Retirada", "zinc"], cancelado: ["Cancelado", "red"],
};

export default async function Crianca({ params }: PageProps<"/painel/[slug]/kids/criancas/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const { data: k } = await supabase.from("kids_children").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!k) notFound();
  const [{ data: guardians }, { data: history }, { data: rooms }] = await Promise.all([
    supabase.from("kids_guardians").select("id, name, phone, relationship, can_pickup, user_id").eq("child_id", id).order("name"),
    supabase.from("kids_checkins").select("id, service_date, status, room_id, checked_out_at, picked_up_by").eq("child_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("kids_rooms").select("id, name").eq("church_id", church.id),
  ]);
  const room = (rid: string | null) => rooms?.find((r) => r.id === rid)?.name ?? "—";
  const base = `/painel/${slug}/kids`;

  return (
    <>
      <Link href={`${base}/criancas`} className="text-sm text-zinc-500 hover:underline">← Crianças</Link>
      <PageHeader title={k.full_name} subtitle={[ageLabel(k.birth_date, nowMs()), k.birth_date && `nasceu em ${date(k.birth_date)}`].filter(Boolean).join(" · ") || undefined}
        actions={
          <form action={checkIn}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="child_id" value={id} />
            <button className="btn-primary">Fazer check-in agora</button>
          </form>
        } />
      {k.allergies && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">⚠ Alergias: {k.allergies}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Dados da criança</h2>
          <ActionForm action={saveChild} reset={false} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <Field label="Nome"><input name="full_name" defaultValue={k.full_name} required className="input" /></Field>
            <Field label="Data de nascimento"><input name="birth_date" type="date" defaultValue={k.birth_date ?? ""} className="input" /></Field>
            <Field label="Alergias / restrições"><input name="allergies" defaultValue={k.allergies ?? ""} className="input" /></Field>
            <Field label="Cuidados de saúde"><textarea name="medical_notes" rows={2} defaultValue={k.medical_notes ?? ""} className="input" /></Field>
            <Field label="Observações"><textarea name="notes" rows={2} defaultValue={k.notes ?? ""} className="input" /></Field>
            <Submit>Salvar</Submit>
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card">
            <h2 className="font-semibold">Responsáveis</h2>
            <ul className="mt-2 divide-y divide-zinc-100 text-sm">
              {(guardians ?? []).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{g.name} {g.user_id && <Badge tone="green">usa o app</Badge>}</p>
                    <p className="text-xs text-zinc-500">{[g.relationship, g.phone, g.can_pickup ? "pode retirar" : "NÃO pode retirar"].filter(Boolean).join(" · ")}</p>
                  </div>
                  <form action={removeGuardian}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={g.id} />
                    <ConfirmButton message={`Remover ${g.name}?`} className="btn-danger py-1 text-xs">Remover</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
            <ActionForm action={addGuardian} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="child_id" value={id} />
              <input name="name" required placeholder="Nome" className="input" />
              <input name="relationship" placeholder="Parentesco" className="input" />
              <input name="phone" type="tel" placeholder="Telefone" className="input" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="can_pickup" defaultChecked /> Pode retirar</label>
              <div className="sm:col-span-2"><Submit className="btn-ghost">Adicionar responsável</Submit></div>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="font-semibold">Presenças</h2>
            <ul className="mt-2 divide-y divide-zinc-100 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{date(h.service_date)} · {room(h.room_id)}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {h.checked_out_at && `${dateTime(h.checked_out_at).slice(-5)}${h.picked_up_by ? ` · ${h.picked_up_by}` : ""}`}
                    <Badge tone={STATUS[h.status][1]}>{STATUS[h.status][0]}</Badge>
                  </span>
                </li>
              ))}
              {!history?.length && <li className="py-2 text-zinc-500">Ainda não veio.</li>}
            </ul>
          </section>

          <form action={deleteChild}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message="Excluir o cadastro desta criança e o histórico?">Excluir cadastro</ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
