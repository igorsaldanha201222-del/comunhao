import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dateTime, nowMs } from "@/lib/format";
import { KEYS, kindOf } from "@/lib/ministries";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import {
  addMinistryMember, addPosition, removeMinistryMember, removePosition, saveMinistry, saveSchedule, saveSong,
} from "../../actions";

export default async function MinisterioPage({ params }: PageProps<"/painel/[slug]/ministerios/[id]">) {
  const { slug, id } = await params;
  const { church, supabase } = await requireStaff(slug);
  const { data: m } = await supabase.from("ministries").select("*").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!m) notFound();
  const k = kindOf(m.kind);

  const [{ data: positions }, { data: members }, { data: people }, { data: schedules }, { data: songs }] = await Promise.all([
    supabase.from("ministry_positions").select("id, name").eq("ministry_id", id).order("position").order("name"),
    supabase.from("ministry_members").select("person_id, is_leader, position_ids, people(full_name, phone)").eq("ministry_id", id),
    supabase.from("people").select("id, full_name").eq("church_id", church.id).neq("status", "inativo").order("full_name"),
    supabase.from("schedules").select("id, title, starts_at, schedule_assignments(status)")
      .eq("ministry_id", id).gte("starts_at", new Date(nowMs() - 7 * 86400_000).toISOString()).order("starts_at").limit(30),
    k.repertoire
      ? supabase.from("songs").select("*").eq("ministry_id", id).order("title")
      : Promise.resolve({ data: [] as Record<string, string | null>[] }),
  ]);

  const posName = new Map((positions ?? []).map((p) => [p.id, p.name]));
  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="ministry_id" value={id} />
    </>
  );

  return (
    <>
      <PageHeader
        title={`${k.icon} ${m.name}`}
        subtitle={`${k.label}${m.description ? " · " + m.description : ""}`}
        actions={<Link href={`/painel/${slug}/ministerios`} className="btn-ghost">Voltar</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- Escalas ---------------- */}
        <section className="card lg:col-span-2">
          <h2 className="font-semibold">{k.scheduleWord}</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              {schedules?.length ? (
                <ul className="divide-y divide-zinc-100 text-sm">
                  {schedules.map((s) => {
                    const a = (s.schedule_assignments ?? []) as { status: string }[];
                    const ok = a.filter((x) => x.status === "confirmado").length;
                    const no = a.filter((x) => x.status === "recusado").length;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                        <Link href={`/painel/${slug}/ministerios/${id}/escalas/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                        <span className="flex items-center gap-2 text-zinc-500">
                          <Badge tone="green">{ok}/{a.length} confirmados</Badge>
                          {no > 0 && <Badge tone="red">{no} recusou</Badge>}
                          {dateTime(s.starts_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty>Nenhuma escala ainda.</Empty>}
            </div>
            <ActionForm action={saveSchedule} className="space-y-3 rounded-lg bg-zinc-50 p-4">
              {hidden}
              <Field label="Título"><input name="title" placeholder="Culto de domingo" className="input" /></Field>
              <Field label="Data e hora"><input name="starts_at" type="datetime-local" required className="input" /></Field>
              <Field label="Observações"><input name="notes" className="input" /></Field>
              <Submit>Nova escala</Submit>
            </ActionForm>
          </div>
        </section>

        {/* ---------------- Membros ---------------- */}
        <section className="card">
          <h2 className="font-semibold">Integrantes ({members?.length ?? 0})</h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {(members ?? []).map((mm) => (
              <li key={mm.person_id} className="flex items-start justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">
                    {(mm.people as unknown as { full_name: string }).full_name}
                    {mm.is_leader && <span className="ml-2"><Badge tone="green">Líder</Badge></span>}
                  </p>
                  <p className="text-xs text-zinc-500">{(mm.position_ids as string[]).map((p) => posName.get(p)).filter(Boolean).join(", ") || "sem função"}</p>
                </div>
                <form action={removeMinistryMember}>
                  {hidden}<input type="hidden" name="person_id" value={mm.person_id} />
                  <ConfirmButton message="Remover do ministério?">Remover</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
          <ActionForm action={addMinistryMember} className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-4">
            {hidden}
            <Field label="Pessoa (adicionar ou atualizar)">
              <select name="person_id" className="input" defaultValue="">
                <option value="" disabled>Escolha…</option>
                {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
            <fieldset>
              <span className="label">Funções</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {(positions ?? []).map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="position_ids" value={p.id} /> {p.name}</label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_leader" /> É líder do ministério</label>
            <Submit>Salvar integrante</Submit>
          </ActionForm>
        </section>

        {/* ---------------- Funções e dados ---------------- */}
        <section className="space-y-6">
          <div className="card">
            <h2 className="font-semibold">Funções</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(positions ?? []).map((p) => (
                <form key={p.id} action={removePosition} className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-3 pr-1 text-sm">
                  {hidden}<input type="hidden" name="id" value={p.id} />
                  {p.name}
                  <button title="Remover" className="rounded-full px-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600">×</button>
                </form>
              ))}
            </div>
            <ActionForm action={addPosition} className="mt-3 flex gap-2">
              {hidden}
              <input name="name" required placeholder="Nova função" className="input" />
              <Submit className="btn-ghost">Adicionar</Submit>
            </ActionForm>
          </div>
          <div className="card">
            <h2 className="font-semibold">Dados do ministério</h2>
            <ActionForm action={saveMinistry} reset={false} className="mt-3 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <Field label="Nome"><input name="name" defaultValue={m.name} required className="input" /></Field>
              <Field label="Descrição"><textarea name="description" rows={2} defaultValue={m.description ?? ""} className="input" /></Field>
              <Field label="Cor"><input name="color" type="color" defaultValue={m.color} className="h-10 w-20 rounded border border-zinc-300" /></Field>
              <Submit className="btn-ghost">Salvar</Submit>
            </ActionForm>
          </div>
        </section>

        {/* ---------------- Repertório (louvor) ---------------- */}
        {k.repertoire && (
          <section className="card lg:col-span-2">
            <h2 className="font-semibold">Repertório ({songs?.length ?? 0} músicas)</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
              {songs?.length ? (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Música</th><th>Tom</th><th>BPM</th><th>Arquivos</th></tr></thead>
                    <tbody>
                      {songs.map((s) => (
                        <tr key={s.id as string}>
                          <td><p className="font-medium">{s.title}</p><p className="text-xs text-zinc-500">{s.artist}</p></td>
                          <td>{s.song_key ?? "—"}</td>
                          <td>{s.bpm ?? "—"}</td>
                          <td className="space-x-2 text-xs">
                            {s.link_url && <a href={s.link_url} target="_blank" className="underline">referência</a>}
                            {s.chord_url && <a href={s.chord_url} target="_blank" className="underline">cifra</a>}
                            {s.audio_url && <a href={s.audio_url} target="_blank" className="underline">áudio</a>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty>Nenhuma música no repertório.</Empty>}
              <ActionForm action={saveSong} className="space-y-3 rounded-lg bg-zinc-50 p-4">
                {hidden}
                <Field label="Título"><input name="title" required className="input" /></Field>
                <Field label="Artista / versão"><input name="artist" className="input" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tom">
                    <select name="song_key" className="input" defaultValue=""><option value="">—</option>{KEYS.map((x) => <option key={x}>{x}</option>)}</select>
                  </Field>
                  <Field label="BPM"><input name="bpm" type="number" min={30} max={250} className="input" /></Field>
                </div>
                <Field label="Link de referência (YouTube/Spotify)"><input name="link_url" type="url" className="input" /></Field>
                <Field label="Cifra / partitura (PDF ou imagem)"><input name="chord_file" type="file" accept=".pdf,image/*" className="text-sm" /></Field>
                <Field label="Áudio guia (MP3)"><input name="audio_file" type="file" accept="audio/*" className="text-sm" /></Field>
                <Field label="Letra"><textarea name="lyrics" rows={3} className="input" /></Field>
                <Submit>Adicionar música</Submit>
              </ActionForm>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
