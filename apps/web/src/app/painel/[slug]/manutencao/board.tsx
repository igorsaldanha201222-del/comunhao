"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { COLUMNS, priorityOf, type MaintStatus } from "@/lib/maintenance";
import { Badge } from "@/components/ui";
import { moveRequest } from "./actions";

export type Card = {
  id: string;
  number: number;
  title: string;
  location: string | null;
  priority: string;
  status: MaintStatus;
  position: number;
  thumb: string | null;
  photoCount: number;
  assignee: string | null;
  requester: string | null;
  mine: boolean;        // atribuído a mim
  openedByMe: boolean;
  canMove: boolean;
  age: string;          // "hoje", "há 3 dias"
  due: string | null;   // "05/12"
  overdue: boolean;
};

type Filter = "todos" | "meus" | "abertos";

export function Board({ slug, cards, canManage }: { slug: string; cards: Card[]; canManage: boolean }) {
  const [optimistic, applyMove] = useOptimistic(cards, (list, m: { id: string; status: MaintStatus; position: number }) =>
    list.map((c) => (c.id === m.id ? { ...c, status: m.status, position: m.position } : c)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<MaintStatus | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [urgentOnly, setUrgentOnly] = useState(false);

  const visible = optimistic.filter((c) =>
    (filter === "todos" || (filter === "meus" ? c.mine : c.openedByMe)) &&
    (!urgentOnly || c.priority === "alta" || c.priority === "urgente"));

  const column = (s: MaintStatus) => visible.filter((c) => c.status === s).sort((a, b) => a.position - b.position);

  function move(id: string, status: MaintStatus, beforeId?: string) {
    const card = optimistic.find((c) => c.id === id);
    if (!card || !card.canMove) return;
    const target = optimistic.filter((c) => c.status === status && c.id !== id).sort((a, b) => a.position - b.position);
    const i = beforeId ? target.findIndex((c) => c.id === beforeId) : -1;
    const position = i === -1
      ? (target.at(-1)?.position ?? 0) + 1
      : i === 0 ? target[0].position - 1 : (target[i - 1].position + target[i].position) / 2;
    if (card.status === status && card.position === position) return;
    setError(null);
    start(async () => {
      applyMove({ id, status, position });
      const r = await moveRequest(slug, id, status, position);
      if (r?.error) setError(r.error);
    });
  }

  const step = (c: Card, dir: -1 | 1) => {
    const i = COLUMNS.findIndex((col) => col.status === c.status);
    const next = COLUMNS[i + dir];
    if (next) move(c.id, next.status);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {(canManage ? [["todos", "Todos"], ["meus", "Comigo"], ["abertos", "Abertos por mim"]] : [["todos", "Todos"], ["meus", "Comigo"]]).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v as Filter)}
            className={`rounded-full border px-3 py-1 ${filter === v ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>{l}</button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-zinc-600">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} /> Só alta/urgente
        </label>
        {error && <span className="ml-auto text-red-600">{error}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = column(col.status);
          return (
            <section key={col.status}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(col.status); } }}
              onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, col.status); setDragId(null); setOver(null); }}
              className={`flex min-h-48 flex-col rounded-xl border p-2 transition-colors ${over === col.status ? "border-zinc-400 bg-zinc-100" : "border-zinc-200 bg-zinc-50"}`}>
              <header className="flex items-baseline justify-between px-1.5 pb-2 pt-1">
                <h2 className="text-sm font-semibold">{col.label} <span className="font-normal text-zinc-500">{items.length}</span></h2>
                <span className="hidden text-[11px] text-zinc-400 2xl:inline">{col.hint}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {items.map((c) => (
                  <article key={c.id}
                    draggable={c.canMove}
                    onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    onDragOver={(e) => { if (dragId && dragId !== c.id) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== c.id) move(dragId, col.status, c.id); setDragId(null); setOver(null); }}
                    className={`group overflow-hidden rounded-lg border bg-white shadow-sm ${c.canMove ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === c.id ? "opacity-40" : ""} ${c.priority === "urgente" ? "border-red-300" : "border-zinc-200"}`}>
                    <Link href={`/painel/${slug}/manutencao/${c.id}`} className="block" draggable={false}>
                      {c.thumb && (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.thumb} alt="" draggable={false} className="h-32 w-full object-cover" />
                          {c.photoCount > 1 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 text-[11px] text-white">+{c.photoCount - 1}</span>}
                        </div>
                      )}
                      <div className="space-y-1.5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{c.title}</p>
                          <span className="shrink-0 text-xs text-zinc-400">#{c.number}</span>
                        </div>
                        {c.location && <p className="text-xs text-zinc-500">📍 {c.location}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {c.priority !== "normal" && <Badge tone={priorityOf(c.priority).tone}>{priorityOf(c.priority).label}</Badge>}
                          {c.due && <span className={c.overdue ? "font-medium text-red-600" : "text-zinc-500"}>⏰ {c.due}</span>}
                          <span className="text-zinc-400">{c.age}</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {c.assignee ? <>👷 {c.assignee}</> : <span className="text-amber-700">Sem responsável</span>}
                        </p>
                      </div>
                    </Link>
                    {c.canMove && (
                      <div className="flex border-t border-zinc-100 text-xs text-zinc-500 md:hidden md:group-hover:flex">
                        <button className="flex-1 py-1.5 hover:bg-zinc-50 disabled:opacity-30" disabled={col.status === COLUMNS[0].status} onClick={() => step(c, -1)}>◀ Voltar</button>
                        <button className="flex-1 border-l border-zinc-100 py-1.5 hover:bg-zinc-50 disabled:opacity-30" disabled={col.status === COLUMNS.at(-1)!.status} onClick={() => step(c, 1)}>Avançar ▶</button>
                      </div>
                    )}
                  </article>
                ))}
                {!items.length && <p className="px-2 py-6 text-center text-xs text-zinc-400">{dragId ? "Solte aqui" : "Nada por aqui"}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
