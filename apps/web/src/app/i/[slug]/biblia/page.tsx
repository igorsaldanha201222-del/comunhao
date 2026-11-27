import Link from "next/link";
import { BIBLE_CREDIT, BOOKS, OT_COUNT } from "@/lib/bible";
import { SiteShell } from "../site-shell";

export const metadata = { title: "Bíblia" };

export default async function Biblia({ params }: PageProps<"/i/[slug]/biblia">) {
  const { slug } = await params;
  const group = (title: string, books: typeof BOOKS) => (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {books.map(([b, name, ch]) => (
          <Link key={b} href={`/i/${slug}/biblia/${b}/1`} className="rounded-lg bg-white px-3 py-2.5 text-sm shadow-sm hover:ring-2 hover:ring-brand">
            <span className="font-semibold">{name}</span>
            <span className="block text-xs text-zinc-400">{ch} cap.</span>
          </Link>
        ))}
      </div>
    </section>
  );
  return (
    <SiteShell slug={slug} active="/biblia">
      <h1 className="text-3xl font-extrabold">📖 Bíblia Sagrada</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {[["sl", 23, "Salmos 23"], ["joa", 3, "João 3"], ["rm", 8, "Romanos 8"], ["mt", 5, "Mateus 5"], ["pv", 3, "Provérbios 3"]].map(([b, c, label]) => (
          <Link key={label} href={`/i/${slug}/biblia/${b}/${c}`} className="rounded-full bg-brand/10 px-3 py-1.5 font-medium text-brand">{label}</Link>
        ))}
      </div>
      {group("Antigo Testamento", BOOKS.slice(0, OT_COUNT))}
      {group("Novo Testamento", BOOKS.slice(OT_COUNT))}
      <p className="mt-10 text-xs text-zinc-400">{BIBLE_CREDIT}</p>
    </SiteShell>
  );
}
