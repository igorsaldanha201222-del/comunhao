import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { COLUMNS, MAINT_STATUS_LABEL, PRIORITIES, priorityOf, type MaintPerson, type MaintStatus } from "@/lib/maintenance";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { addComment, deleteRequest, updateRequest } from "../actions";

export const metadata = { title: "Chamado de manutenção" };

export default async function ChamadoPage({ params }: PageProps<"/painel/[slug]/manutencao/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, user, canMaintManage } = await requireStaff(slug);

  const { data: r } = await supabase.from("maintenance_requests").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!r) notFound();

  const [{ data: updates }, { data: people }] = await Promise.all([
    supabase.from("maintenance_updates").select("id, user_id, kind, body, photo_path, created_at").eq("request_id", id).order("created_at"),
    supabase.rpc("maintenance_people", { p_church: church.id }),
  ]);
  const team = (people ?? []) as MaintPerson[];
  const names = new Map(team.map((p) => [p.user_id, p.full_name]));
  const paths = [...(r.photos as string[]), ...(updates ?? []).map((u) => u.photo_path).filter(Boolean)] as string[];
  const { data: signed } = paths.length ? await supabase.storage.from("maintenance").createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl as string]));

  const isAssignee = r.assigned_to === user.id;
  const canEdit = canMaintManage || isAssignee;
  const base = `/painel/${slug}/manutencao`;
  const statusOptions = canMaintManage ? [...COLUMNS.map((c) => c.status), "cancelada" as MaintStatus] : COLUMNS.map((c) => c.status);

  const describe = (u: NonNullable<typeof updates>[number]) => {
    if (u.kind === "status") return <>moveu para <strong>{MAINT_STATUS_LABEL[u.body as MaintStatus] ?? u.body}</strong></>;
    if (u.kind === "atribuicao") return u.body ? <>passou para <strong>{names.get(u.body) ?? "—"}</strong></> : <>tirou o responsável</>;
    if (u.kind === "criada") return <>abriu o chamado</>;
    return null;
  };

  return (
    <>
      <Link href={base} className="text-sm text-zinc-500 hover:underline">← Quadro de manutenção</Link>
      <PageHeader
        title={`#${r.number} · ${r.title}`}
        subtitle={`${r.location ? `📍 ${r.location} · ` : ""}aberto por ${names.get(r.requested_by) ?? "—"} em ${dateTime(r.created_at)}`}
        actions={<div className="flex items-center gap-2">
          <Badge tone={priorityOf(r.priority).tone}>{priorityOf(r.priority).label}</Badge>
          <Badge tone={r.status === "concluida" ? "green" : r.status === "cancelada" ? "red" : "amber"}>{MAINT_STATUS_LABEL[r.status as MaintStatus]}</Badge>
        </div>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {r.photos.length > 0 && (
            <section className="grid gap-2 sm:grid-cols-2">
              {(r.photos as string[]).map((p) => url.get(p) && (
                <a key={p} href={url.get(p)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url.get(p)} alt="Foto do chamado" className="aspect-[4/3] w-full rounded-xl border border-zinc-200 object-cover" />
                </a>
              ))}
            </section>
          )}
          {r.description && (
            <section className="card">
              <h2 className="font-semibold">O que fazer</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{r.description}</p>
            </section>
          )}

          <section className="card">
            <h2 className="font-semibold">Andamento</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {(updates ?? []).map((u) => (
                <li key={u.id} className="border-l-2 border-zinc-200 pl-3">
                  <p className="text-xs text-zinc-500">{names.get(u.user_id ?? "") ?? "Alguém"} · {dateTime(u.created_at)}</p>
                  {u.kind === "comentario"
                    ? <>
                        {u.body && <p className="mt-0.5 whitespace-pre-wrap">{u.body}</p>}
                        {u.photo_path && url.get(u.photo_path) && (
                          <a href={url.get(u.photo_path)} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url.get(u.photo_path)} alt="" className="mt-1 h-32 rounded-lg object-cover" />
                          </a>
                        )}
                      </>
                    : <p className="mt-0.5 text-zinc-600">{describe(u)}</p>}
                </li>
              ))}
            </ol>
            <ActionForm action={addComment} className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <textarea name="body" rows={2} maxLength={4000} placeholder="Escreva um recado ou como ficou…" className="input" />
              <div className="flex items-center justify-between gap-2">
                <input name="photo" type="file" accept="image/*" capture="environment" className="text-sm" />
                <Submit className="btn-ghost">Comentar</Submit>
              </div>
            </ActionForm>
          </section>
        </div>

        <aside className="space-y-6">
          {canEdit ? (
            <section className="card">
              <h2 className="mb-3 font-semibold">{canMaintManage ? "Gerenciar chamado" : "Atualizar meu chamado"}</h2>
              <ActionForm action={updateRequest} reset={false} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={id} />
                <Field label="Etapa">
                  <select name="status" defaultValue={r.status} className="input">
                    {statusOptions.map((s) => <option key={s} value={s}>{MAINT_STATUS_LABEL[s]}</option>)}
                  </select>
                </Field>
                {canMaintManage && (
                  <>
                    <Field label="Responsável">
                      <select name="assigned_to" defaultValue={r.assigned_to ?? ""} className="input">
                        <option value="">— ninguém ainda —</option>
                        {team.filter((p) => p.can_manage || p.user_id === r.assigned_to).map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Urgência">
                        <select name="priority" defaultValue={r.priority} className="input">
                          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Prazo"><input name="due_date" type="date" defaultValue={r.due_date ?? ""} className="input" /></Field>
                    </div>
                    <Field label="Título"><input name="title" defaultValue={r.title} required className="input" /></Field>
                    <Field label="Local"><input name="location" defaultValue={r.location ?? ""} className="input" /></Field>
                    <Field label="Detalhes"><textarea name="description" rows={3} defaultValue={r.description ?? ""} className="input" /></Field>
                    <Field label="Custo (R$)"><input name="cost" inputMode="decimal" placeholder="0,00"
                      defaultValue={r.cost_cents != null ? (r.cost_cents / 100).toFixed(2).replace(".", ",") : ""} className="input" /></Field>
                  </>
                )}
                <Field label="O que foi feito"><textarea name="resolution" rows={2} defaultValue={r.resolution ?? ""} placeholder="ex.: Trocadas 2 lâmpadas LED" className="input" /></Field>
                <Field label="Adicionar fotos (antes/depois)"><input name="photos" type="file" accept="image/*" multiple className="text-sm" /></Field>
                <Submit>Salvar</Submit>
              </ActionForm>
            </section>
          ) : (
            <section className="card text-sm">
              <p><span className="text-zinc-500">Responsável:</span> {r.assigned_to ? names.get(r.assigned_to) : "ainda não definido"}</p>
              {r.due_date && <p className="mt-1"><span className="text-zinc-500">Prazo:</span> {r.due_date.split("-").reverse().join("/")}</p>}
              {r.resolution && <p className="mt-1"><span className="text-zinc-500">Solução:</span> {r.resolution}</p>}
            </section>
          )}
          {r.completed_at && <p className="text-sm text-emerald-700">✅ Concluído em {dateTime(r.completed_at)}</p>}
          {canMaintManage && (
            <form action={deleteRequest}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message="Excluir este chamado e as fotos? Não dá para desfazer.">Excluir chamado</ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
