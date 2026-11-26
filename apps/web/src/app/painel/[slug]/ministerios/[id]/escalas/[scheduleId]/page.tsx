import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dateTime, toLocalInput } from "@/lib/format";
import { KEYS, kindOf } from "@/lib/ministries";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { addSongToSchedule, assignToSchedule, deleteSchedule, removeSongFromSchedule, unassign } from "../../../../actions";

const TONE = { pendente: "amber", confirmado: "green", recusado: "red" } as const;

export default async function EscalaPage({ params }: PageProps<"/painel/[slug]/ministerios/[id]/escalas/[scheduleId]">) {
  const { slug, id, scheduleId } = await params;
  const { church, supabase } = await requireStaff(slug);
  const [{ data: s }, { data: m }] = await Promise.all([
    supabase.from("schedules").select("*").eq("id", scheduleId).eq("ministry_id", id).maybeSingle(),
    supabase.from("ministries").select("id, name, kind").eq("id", id).eq("church_id", church.id).maybeSingle(),
  ]);
  if (!s || !m) notFound();
  const k = kindOf(m.kind);

  const [{ data: assignments }, { data: members }, { data: positions }, { data: setlist }, { data: songs }] = await Promise.all([
    supabase.from("schedule_assignments").select("id, status, person_id, position_id, people(full_name), ministry_positions(name)").eq("schedule_id", scheduleId),
    supabase.from("ministry_members").select("person_id, position_ids, people(full_name)").eq("ministry_id", id),
    supabase.from("ministry_positions").select("id, name").eq("ministry_id", id).order("position"),
    k.repertoire
      ? supabase.from("schedule_songs").select("song_id, song_key, position, songs(title, artist, song_key, chord_url, link_url)").eq("schedule_id", scheduleId).order("position")
      : Promise.resolve({ data: [] }),
    k.repertoire ? supabase.from("songs").select("id, title, song_key").eq("ministry_id", id).order("title") : Promise.resolve({ data: [] }),
  ]);

  // Mesma pessoa escalada em outro ministério no mesmo dia → alerta de conflito.
  const day = toLocalInput(s.starts_at).slice(0, 10); // dia em Brasília, não em UTC
  const { data: sameDay } = await supabase.from("schedule_assignments")
    .select("person_id, schedules!inner(starts_at, ministry_id, ministries(name))")
    .eq("church_id", church.id)
    .gte("schedules.starts_at", `${day}T00:00:00-03:00`).lte("schedules.starts_at", `${day}T23:59:59-03:00`)
    .neq("schedule_id", scheduleId);
  const conflicts = new Map<string, string>();
  (sameDay ?? []).forEach((r) => {
    const sc = r.schedules as unknown as { ministries: { name: string } };
    conflicts.set(r.person_id, sc.ministries?.name);
  });

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="ministry_id" value={id} />
      <input type="hidden" name="schedule_id" value={scheduleId} />
    </>
  );

  return (
    <>
      <PageHeader
        title={s.title}
        subtitle={`${k.icon} ${m.name} · ${dateTime(s.starts_at)}${s.notes ? " · " + s.notes : ""}`}
        actions={
          <>
            <Link href={`/painel/${slug}/ministerios/${id}`} className="btn-ghost">Voltar</Link>
            <form action={deleteSchedule}>{hidden}<ConfirmButton message="Excluir esta escala?">Excluir</ConfirmButton></form>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Escalados</h2>
          {assignments?.length ? (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{(a.people as unknown as { full_name: string }).full_name}</p>
                    <p className="text-xs text-zinc-500">{(a.ministry_positions as unknown as { name: string } | null)?.name ?? "—"}</p>
                    {conflicts.has(a.person_id) && (
                      <p className="text-xs text-amber-700">⚠ também escalado(a) em {conflicts.get(a.person_id)} neste dia</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[a.status as keyof typeof TONE]}>{a.status}</Badge>
                    <form action={unassign}>{hidden}<input type="hidden" name="id" value={a.id} /><button className="text-xs text-zinc-400 hover:text-red-600">remover</button></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="mt-3"><Empty>Ninguém escalado ainda.</Empty></div>}

          <ActionForm action={assignToSchedule} className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-4">
            {hidden}
            <Field label="Pessoa">
              <select name="person_id" className="input" defaultValue="">
                <option value="" disabled>Escolha…</option>
                {(members ?? []).map((mm) => (
                  <option key={mm.person_id} value={mm.person_id}>{(mm.people as unknown as { full_name: string }).full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Função">
              <select name="position_id" className="input">
                <option value="">—</option>
                {(positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="col-span-2"><Submit>Escalar</Submit></div>
            <p className="col-span-2 text-xs text-zinc-500">A pessoa recebe a escala no app e confirma ou recusa por lá.</p>
          </ActionForm>
        </section>

        {k.repertoire && (
          <section className="card">
            <h2 className="font-semibold">Setlist</h2>
            {setlist?.length ? (
              <ol className="mt-3 space-y-2 text-sm">
                {setlist.map((x, i) => {
                  const song = x.songs as unknown as { title: string; artist: string | null; song_key: string | null; chord_url: string | null; link_url: string | null };
                  return (
                    <li key={x.song_id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2">
                      <span><span className="mr-2 text-zinc-400">{i + 1}.</span><strong>{song.title}</strong> {song.artist && <span className="text-zinc-500">· {song.artist}</span>}</span>
                      <span className="flex items-center gap-2">
                        <Badge>{x.song_key ?? song.song_key ?? "—"}</Badge>
                        {song.chord_url && <a href={song.chord_url} target="_blank" className="text-xs underline">cifra</a>}
                        <form action={removeSongFromSchedule}>{hidden}<input type="hidden" name="song_id" value={x.song_id} /><button className="text-xs text-zinc-400 hover:text-red-600">×</button></form>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : <div className="mt-3"><Empty>Nenhuma música no setlist.</Empty></div>}
            <ActionForm action={addSongToSchedule} className="mt-4 grid grid-cols-[1fr_100px] gap-3 rounded-lg bg-zinc-50 p-4">
              {hidden}
              <Field label="Música do repertório">
                <select name="song_id" required className="input" defaultValue="">
                  <option value="" disabled>Escolha…</option>
                  {(songs as { id: string; title: string; song_key: string | null }[] ?? []).map((x) => <option key={x.id} value={x.id}>{x.title}{x.song_key ? ` (${x.song_key})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Tom">
                <select name="song_key" className="input" defaultValue=""><option value="">original</option>{KEYS.map((x) => <option key={x}>{x}</option>)}</select>
              </Field>
              <div className="col-span-2"><Submit>Adicionar ao setlist</Submit></div>
            </ActionForm>
          </section>
        )}
      </div>
    </>
  );
}
