"use client";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { STATUS_LABEL } from "@/lib/format";
import { togglePresence } from "../actions";

type P = { id: string; full_name: string; status: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Chamada: um toque marca/desmarca. Atualiza na hora e salva em segundo plano. */
export function RollCall({ slug, serviceId, people, present }: { slug: string; serviceId: string; people: P[]; present: string[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todos" | "faltam" | "presentes">("todos");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [marked, setMarked] = useOptimistic(new Set(present), (cur: Set<string>, [id, on]: [string, boolean]) => {
    const next = new Set(cur);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const shown = useMemo(() => people.filter((p) => {
    if (q && !norm(p.full_name).includes(norm(q))) return false;
    if (tab === "faltam") return !marked.has(p.id);
    if (tab === "presentes") return marked.has(p.id);
    return true;
  }), [people, q, tab, marked]);

  const toggle = (id: string) => {
    const on = !marked.has(id);
    setError(null);
    start(async () => {
      setMarked([id, on]);
      try { await togglePresence(slug, serviceId, id, on); }
      catch { setError("Não salvou — verifique a internet e toque de novo."); }
    });
  };

  return (
    <section className="card p-0">
      <div className="sticky top-[65px] z-10 space-y-3 rounded-t-xl border-b border-zinc-200 bg-white p-3 md:top-0">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-extrabold">{marked.size} <span className="text-sm font-normal text-zinc-500">presentes de {people.length}</span></p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar nome…" className="input" />
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {([["todos", "Todos"], ["faltam", "Faltam"], ["presentes", "Presentes"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`flex-1 rounded-md py-1.5 ${tab === k ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>{label}</button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <ul className="divide-y divide-zinc-100">
        {shown.map((p) => {
          const on = marked.has(p.id);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={on}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${on ? "bg-emerald-50" : "hover:bg-zinc-50"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 text-transparent"}`}>✓</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${on ? "font-semibold text-emerald-900" : ""}`}>{p.full_name}</span>
                  <span className="text-xs text-zinc-500">{STATUS_LABEL[p.status] ?? p.status}</span>
                </span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="p-6 text-center text-sm text-zinc-500">Ninguém aqui.</li>}
      </ul>
    </section>
  );
}
