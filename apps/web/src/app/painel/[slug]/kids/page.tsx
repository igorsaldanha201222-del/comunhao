import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dateTime, nowMs } from "@/lib/format";
import { ageLabel, todayBR } from "@/lib/kids";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { cancelCheckin, checkIn, checkOut } from "./actions";
import { KidsTabs } from "./tabs";

export const metadata = { title: "Kids · Check-in" };

type Child = { id: string; full_name: string; birth_date: string | null; allergies: string | null };
type Row = {
  id: string; status: "pre" | "presente" | "retirado" | "cancelado"; security_code: string; room_id: string | null;
  checked_in_at: string | null; checked_out_at: string | null; picked_up_by: string | null; kids_children: Child;
};

export default async function KidsCheckin({ params, searchParams }: PageProps<"/painel/[slug]/kids">) {
  const { slug } = await params;
  const { q, ok } = await searchParams;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const now = nowMs();
  const today = todayBR(now);
  const term = typeof q === "string" ? q.trim() : "";

  const [{ data: rooms }, { data: rows }, found] = await Promise.all([
    supabase.from("kids_rooms").select("id, name, color, min_age, max_age").eq("church_id", church.id).eq("active", true).order("position"),
    supabase.from("kids_checkins")
      .select("id, status, security_code, room_id, checked_in_at, checked_out_at, picked_up_by, kids_children(id, full_name, birth_date, allergies)")
      .eq("church_id", church.id).eq("service_date", today).neq("status", "cancelado").order("created_at"),
    term.length >= 2
      ? supabase.from("kids_children").select("id, full_name, birth_date, allergies, kids_guardians(name, relationship)")
          .eq("church_id", church.id).ilike("full_name", `%${term}%`).order("full_name").limit(15)
      : Promise.resolve({ data: null }),
  ]);
  const list = (rows ?? []) as unknown as Row[];
  const status = new Map(list.map((r) => [r.kids_children.id, r]));
  const waiting = list.filter((r) => r.status === "pre");
  const inRoom = list.filter((r) => r.status === "presente");
  const out = list.filter((r) => r.status === "retirado");
  const just = typeof ok === "string" ? list.find((r) => r.id === ok) : undefined;
  const roomName = (id: string | null) => rooms?.find((r) => r.id === id);
  const base = `/painel/${slug}/kids`;

  const kid = (c: Child) => (
    <div className="min-w-0">
      <p className="truncate font-medium">{c.full_name}</p>
      <p className="text-xs text-zinc-500">
        {ageLabel(c.birth_date, now) ?? "idade não informada"}
        {c.allergies && <span className="ml-1 font-semibold text-red-600">⚠ {c.allergies}</span>}
      </p>
    </div>
  );

  return (
    <>
      <PageHeader title="Ministério Kids" subtitle={`Check-in de hoje · ${inRoom.length} na sala · ${out.length} retirada(s)`} />
      <KidsTabs slug={slug} active="" />

      {just && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
          <div>
            <p className="text-sm text-emerald-800">Check-in feito: <strong>{just.kids_children.full_name}</strong> → {roomName(just.room_id)?.name ?? "sem turma"}</p>
            <p className="mt-1 text-sm text-emerald-800">Código de retirada</p>
            <p className="font-mono text-5xl font-bold tracking-[0.3em] text-emerald-900">{just.security_code}</p>
          </div>
          <Link href={`${base}/etiqueta/${just.id}`} target="_blank" className="btn-primary">🖨 Imprimir etiquetas</Link>
        </div>
      )}

      <section className="card mb-6">
        <form className="flex gap-2">
          <input name="q" defaultValue={term} placeholder="Buscar criança pelo nome…" className="input" autoFocus />
          <button className="btn-primary">Buscar</button>
        </form>
        {found.data && (
          <ul className="mt-3 divide-y divide-zinc-100">
            {found.data.map((c) => {
              const st = status.get(c.id);
              const guardians = (c.kids_guardians as { name: string; relationship: string | null }[]).map((g) => g.name).join(", ");
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    {kid(c)}
                    {guardians && <p className="text-xs text-zinc-400">Resp.: {guardians}</p>}
                  </div>
                  {st?.status === "presente" ? <Badge tone="green">Na sala</Badge>
                    : st?.status === "retirado" ? <Badge>Já retirada hoje</Badge>
                    : (
                      <form action={checkIn} className="flex items-center gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="child_id" value={c.id} />
                        <select name="room_id" defaultValue="" className="input w-36 py-1.5">
                          <option value="">Turma pela idade</option>
                          {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button className="btn-primary py-1.5">{st?.status === "pre" ? "Confirmar" : "Check-in"}</button>
                      </form>
                    )}
                </li>
              );
            })}
            {!found.data.length && (
              <li className="py-3 text-sm text-zinc-500">
                Nenhuma criança com esse nome. <Link href={`${base}/criancas?novo=1`} className="underline">Cadastrar criança</Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="card mb-6 border-amber-300 bg-amber-50/50">
          <h2 className="font-semibold">Chegando (pré-check-in pelo app) · {waiting.length}</h2>
          <p className="text-xs text-zinc-500">Confira o código no celular do responsável e confirme.</p>
          <ul className="mt-2 divide-y divide-amber-100">
            {waiting.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                {kid(r.kids_children)}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{roomName(r.room_id)?.name}</span>
                  <form action={checkIn}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="child_id" value={r.kids_children.id} />
                    <button className="btn-primary py-1.5">Confirmar entrada</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(rooms ?? []).map((room) => {
          const kids = inRoom.filter((r) => r.room_id === room.id);
          return (
            <section key={room.id} className="card" style={{ borderTop: `4px solid ${room.color}` }}>
              <h2 className="flex items-baseline justify-between font-semibold">
                <span>{room.name} <span className="text-xs font-normal text-zinc-500">{room.min_age}–{room.max_age} anos</span></span>
                <span className="text-sm text-zinc-500">{kids.length}</span>
              </h2>
              <ul className="mt-2 divide-y divide-zinc-100">
                {kids.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      {kid(r.kids_children)}
                      <span className="shrink-0 text-xs text-zinc-400">desde {dateTime(r.checked_in_at).slice(-5)}</span>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-zinc-600">Entregar ao responsável</summary>
                      <ActionForm action={checkOut} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={r.id} />
                        <input name="code" required maxLength={4} placeholder="Código" autoComplete="off"
                          className="input w-24 font-mono uppercase tracking-widest" />
                        <input name="picked_up_by" placeholder="Quem retirou (opcional)" className="input min-w-0 flex-1" />
                        <Submit className="btn-primary">Retirar</Submit>
                      </ActionForm>
                      <div className="mt-2 flex gap-3 text-xs">
                        <Link href={`${base}/etiqueta/${r.id}`} target="_blank" className="underline">Reimprimir etiqueta</Link>
                        <form action={cancelCheckin}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-red-600 underline">Cancelar check-in</button>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
                {!kids.length && <li className="py-3 text-sm text-zinc-400">Nenhuma criança na sala.</li>}
              </ul>
            </section>
          );
        })}
      </div>
      {inRoom.some((r) => !r.room_id) && <p className="mt-4 text-sm text-amber-700">Há crianças sem turma (idade fora das faixas). Ajuste as turmas em Crianças.</p>}

      {out.length > 0 && (
        <section className="card mt-6">
          <h2 className="font-semibold">Retiradas hoje · {out.length}</h2>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {out.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 py-2">
                <span>{r.kids_children.full_name}</span>
                <span className="text-zinc-500">{dateTime(r.checked_out_at).slice(-5)}{r.picked_up_by ? ` · ${r.picked_up_by}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!list.length && !found.data && <div className="mt-6"><Empty>Nenhum check-in hoje ainda. Busque a criança pelo nome acima.</Empty></div>}
    </>
  );
}
