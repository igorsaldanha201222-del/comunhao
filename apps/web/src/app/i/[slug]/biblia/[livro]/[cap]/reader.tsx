"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BOOKS } from "@/lib/bible";

type Nav = { href: string; label: string } | null;
const SIZES = ["text-base", "text-lg", "text-xl", "text-2xl"];
/** A Bíblia Livre marca entre [colchetes] as palavras acrescentadas na tradução: mostramos em itálico. */
const withAdded = (t: string) => t.split(/\[([^\]]*)\]/).map((part, i) => (i % 2 ? <em key={i} className="text-zinc-500">{part}</em> : part));

/** Leitor: busca o livro (arquivo estático, fica em cache), toque no versículo para marcar e compartilhar. */
export function Reader({ slug, book, chapter, prev, next }: {
  slug: string; book: [string, string, number]; chapter: number; prev: Nav; next: Nav;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ book: string; chapters: string[][] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [size, setSize] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/biblia/blivre/${book[0]}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: string[][]) => { if (alive) setLoaded({ book: book[0], chapters: d }); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [book]);
  useEffect(() => {
    const saved = Number(localStorage.getItem("biblia-fonte"));
    if (saved >= 0 && saved < SIZES.length) setSize(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const verses = loaded?.book === book[0] ? loaded.chapters[chapter - 1] ?? [] : null;
  const sel = [...picked].sort((a, b) => a - b);
  const ref = sel.length ? `${book[1]} ${chapter}:${sel.length > 1 && sel.at(-1)! - sel[0] === sel.length - 1 ? `${sel[0]}-${sel.at(-1)}` : sel.join(",")}` : "";
  const shareText = verses && sel.length ? `"${sel.map((v) => verses[v - 1].replace(/[[\]]/g, "")).join(" ")}" — ${ref} (BLIVRE)` : "";

  const toggle = (v: number) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const font = (d: number) => setSize((s) => {
    const n = Math.min(SIZES.length - 1, Math.max(0, s + d));
    localStorage.setItem("biblia-fonte", String(n));
    return n;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={book[0]} onChange={(e) => router.push(`/i/${slug}/biblia/${e.target.value}/1`)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm font-semibold">
          {BOOKS.map(([b, name]) => <option key={b} value={b}>{name}</option>)}
        </select>
        <select value={chapter} onChange={(e) => router.push(`/i/${slug}/biblia/${book[0]}/${e.target.value}`)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm font-semibold">
          {Array.from({ length: book[2] }, (_, i) => <option key={i} value={i + 1}>Cap. {i + 1}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          <button onClick={() => font(-1)} aria-label="Diminuir letra" className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-sm">A−</button>
          <button onClick={() => font(1)} aria-label="Aumentar letra" className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-lg">A+</button>
        </div>
      </div>

      <h1 className="mt-6 text-3xl font-extrabold text-brand">{book[1]} {chapter}</h1>
      <article className={`mt-4 rounded-2xl bg-white p-5 leading-relaxed shadow-sm sm:p-8 ${SIZES[size]}`} style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {failed && <p className="text-zinc-500">Não foi possível carregar o texto. Verifique a internet.</p>}
        {!verses && !failed && <p className="animate-pulse text-zinc-400">Carregando…</p>}
        {verses?.map((t, i) => (
          <span key={i} onClick={() => toggle(i + 1)}
            className={`cursor-pointer rounded transition ${picked.includes(i + 1) ? "bg-amber-200/70" : "hover:bg-zinc-100"}`}>
            <sup className="mr-1 font-sans text-xs font-bold text-brand">{i + 1}</sup>{withAdded(t)}{" "}
          </span>
        ))}
      </article>

      <div className="mt-6 flex justify-between gap-3 text-sm font-semibold">
        {prev ? <Link href={prev.href} className="rounded-full bg-white px-4 py-2 shadow-sm">← {prev.label}</Link> : <span />}
        {next ? <Link href={next.href} className="rounded-full bg-brand px-4 py-2 text-white shadow-sm">{next.label} →</Link> : <span />}
      </div>

      {sel.length > 0 && verses && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-bold">{ref}</span>
            <button onClick={async () => { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm">{copied ? "Copiado ✓" : "Copiar"}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">WhatsApp</a>
            <button onClick={() => setPicked([])} aria-label="Limpar seleção" className="px-2 text-zinc-400">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
