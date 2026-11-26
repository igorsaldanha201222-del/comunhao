import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, dateTime, toLocalInput } from "@/lib/format";
import { STEPS, type Journey } from "@/lib/journey";
import { ConfirmButton } from "@/components/form";
import { Badge, Empty, PageHeader } from "@/components/ui";
import {
  addLesson, giveUp, presented, removeLesson, scheduleTalk, setNccClass, setPresentation, talkDone, toggleAttendance,
} from "./actions";

export const metadata = { title: "Novos membros" };

const COLS = [
  { step: "conversa", ...STEPS[1] },
  { step: "ncc", ...STEPS[2] },
  { step: "apresentacao", ...STEPS[3] },
  { step: "concluido", icon: "🏆", title: "Novos membros" },
] as const;

const wa = (phone: string | null) => {
  const d = phone?.replace(/\D/g, "") ?? "";
  return d.length >= 10 ? `https://wa.me/${d.startsWith("55") ? d : "55" + d}` : null;
};

export default async function Membresia({ params, searchParams }: PageProps<"/painel/[slug]/membresia">) {
  const { slug } = await params;
  const { desistentes } = await searchParams;
  const { church, supabase, isStaff } = await requireStaff(slug);
  if (!isStaff) redirect(`/painel/${slug}`);

  const [{ data: rows }, { data: lessons }, { data: att }] = await Promise.all([
    supabase.from("member_journeys").select("*").eq("church_id", church.id).order("created_at"),
    supabase.from("ncc_lessons").select("id, title, position, description").eq("church_id", church.id).order("position"),
    supabase.from("ncc_attendance").select("journey_id, lesson_id").eq("church_id", church.id),
  ]);
  const all = (rows ?? []) as Journey[];
  const list = all.filter((j) => (desistentes ? j.gave_up : !j.gave_up));
  const attended = new Map<string, Set<string>>();
  for (const a of att ?? []) {
    if (!attended.has(a.journey_id)) attended.set(a.journey_id, new Set());
    attended.get(a.journey_id)!.add(a.lesson_id);
  }
  const hidden = (j: Journey) => (
    <><input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={j.id} /></>
  );
  const gaveUpCount = all.filter((j) => j.gave_up).length;

  return (
    <>
      <PageHeader title="Quero ser membro" subtitle="Acompanhe quem está na trilha: conversa com o pastor → NCC → apresentação à igreja"
        actions={<a href={`/i/${slug}/membro`} target="_blank" className="btn-ghost">Ver como o visitante vê ↗</a>} />

      <div className="mb-4 flex gap-3 text-sm">
        <a href="?" className={desistentes ? "text-zinc-500 underline" : "font-semibold"}>Em andamento</a>
        <a href="?desistentes=1" className={desistentes ? "font-semibold" : "text-zinc-500 underline"}>Pausados / desistiram ({gaveUpCount})</a>
      </div>

      {!list.length && <Empty>Ninguém aqui ainda. Divulgue o botão “Quero ser membro” do site da igreja.</Empty>}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {COLS.map((col) => {
          const items = list.filter((j) => j.step === col.step);
          return (
            <section key={col.step} className="rounded-xl bg-zinc-100 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 font-semibold">
                <span>{col.icon} {col.step === "ncc" ? "NCC" : col.title}</span>
                <span className="rounded-full bg-white px-2 text-sm text-zinc-500">{items.length}</span>
              </h2>
              <div className="space-y-3">
                {items.map((j) => {
                  const done = attended.get(j.id) ?? new Set<string>();
                  const link = wa(j.phone);
                  return (
                    <article key={j.id} className="card space-y-3 p-4">
                      <div>
                        <p className="font-semibold">{j.full_name}</p>
                        <p className="text-xs text-zinc-500">
                          na trilha desde {date(j.created_at)}
                          {link && <> · <a href={link} target="_blank" rel="noreferrer" className="text-emerald-700 underline">WhatsApp {j.phone}</a></>}
                        </p>
                        {j.motivation && <p className="mt-1 rounded bg-zinc-50 p-2 text-xs italic text-zinc-600">“{j.motivation}”</p>}
                      </div>

                      {j.step === "conversa" && (
                        <>
                          <form action={scheduleTalk} className="space-y-2">
                            {hidden(j)}
                            <input name="talk_at" type="datetime-local" defaultValue={toLocalInput(j.talk_at)} className="input py-1.5 text-sm" />
                            <input name="talk_with" defaultValue={j.talk_with ?? ""} placeholder="Com quem (ex.: Pr. Marcos)" className="input py-1.5 text-sm" />
                            <button className="btn-ghost w-full py-1.5 text-sm">{j.talk_at ? "Remarcar" : "Agendar conversa"}</button>
                          </form>
                          {j.talk_at && <p className="text-xs text-zinc-500">📅 {dateTime(j.talk_at)}{j.talk_with ? ` · ${j.talk_with}` : ""}</p>}
                          <form action={talkDone}>{hidden(j)}<button className="btn-primary w-full py-1.5 text-sm">✔ Conversa feita</button></form>
                        </>
                      )}

                      {j.step === "ncc" && (
                        <>
                          <form action={setNccClass} className="flex gap-2">
                            {hidden(j)}
                            <input name="ncc_class" defaultValue={j.ncc_class ?? ""} placeholder="Turma (ex.: Dom 9h)" className="input min-w-0 py-1.5 text-sm" />
                            <button className="btn-ghost py-1.5 text-sm">OK</button>
                          </form>
                          <div>
                            <p className="mb-1 text-xs text-zinc-500">Presença nos encontros ({done.size}/{lessons?.length ?? 0})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(lessons ?? []).map((l, n) => {
                                const on = done.has(l.id);
                                return (
                                  <form key={l.id} action={toggleAttendance}>
                                    {hidden(j)}
                                    <input type="hidden" name="lesson_id" value={l.id} />
                                    <input type="hidden" name="on" value={on ? "0" : "1"} />
                                    <button title={l.title} className={`h-8 w-8 rounded-full text-sm font-bold ${on ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                                      {on ? "✓" : n + 1}
                                    </button>
                                  </form>
                                );
                              })}
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">Completou todos → vai sozinho para Apresentação.</p>
                          </div>
                          <form action={talkDone}>{hidden(j)}<input type="hidden" name="undo" value="1" /><button className="text-xs text-zinc-500 underline">voltar para conversa</button></form>
                        </>
                      )}

                      {j.step === "apresentacao" && (
                        <>
                          <form action={setPresentation} className="flex gap-2">
                            {hidden(j)}
                            <input name="presentation_date" type="date" defaultValue={j.presentation_date ?? ""} className="input min-w-0 py-1.5 text-sm" />
                            <button className="btn-ghost py-1.5 text-sm">Marcar</button>
                          </form>
                          {j.presentation_date && <p className="text-xs text-zinc-500">🗓 Culto de {date(j.presentation_date)}</p>}
                          <form action={presented}>{hidden(j)}<button className="btn-primary w-full py-1.5 text-sm">🎉 Foi apresentado(a) — agora é membro</button></form>
                        </>
                      )}

                      {j.step === "concluido" && (
                        <div className="flex items-center justify-between">
                          <Badge tone="green">Membro desde {date(j.presented_at)}</Badge>
                          <form action={presented}>{hidden(j)}<input type="hidden" name="undo" value="1" /><button className="text-xs text-zinc-400 underline">desfazer</button></form>
                        </div>
                      )}

                      {j.step !== "concluido" && (
                        <form action={giveUp} className="text-right">
                          {hidden(j)}
                          <input type="hidden" name="value" value={j.gave_up ? "0" : "1"} />
                          <button className="text-xs text-zinc-400 underline">{j.gave_up ? "Retomar trilha" : "Pausar / desistiu"}</button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card mt-8">
        <h2 className="font-semibold">📖 Encontros do NCC — Núcleo de Crescimento Cristão</h2>
        <p className="text-xs text-zinc-500">Esses são os encontros que aparecem na trilha do visitante.</p>
        <ol className="mt-3 divide-y divide-zinc-100 text-sm">
          {(lessons ?? []).map((l, n) => (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="font-medium">{n + 1}. {l.title}</p>
                {l.description && <p className="text-xs text-zinc-500">{l.description}</p>}
              </div>
              <form action={removeLesson}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="lesson_id" value={l.id} />
                <ConfirmButton message={`Remover o encontro "${l.title}"?`} className="text-xs text-red-600 underline">remover</ConfirmButton>
              </form>
            </li>
          ))}
        </ol>
        <form action={addLesson} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="position" value={(lessons?.at(-1)?.position ?? 0) + 1} />
          <input name="title" required placeholder="Novo encontro" className="input" />
          <input name="description" placeholder="Descrição (opcional)" className="input" />
          <button className="btn-ghost">Adicionar</button>
        </form>
      </section>
    </>
  );
}
