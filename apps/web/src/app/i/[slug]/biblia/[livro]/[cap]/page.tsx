import { notFound } from "next/navigation";
import { BIBLE_CREDIT, BOOKS, findBook } from "@/lib/bible";
import { SiteShell } from "../../../site-shell";
import { Reader } from "./reader";

export async function generateMetadata({ params }: PageProps<"/i/[slug]/biblia/[livro]/[cap]">) {
  const { livro, cap } = await params;
  return { title: `${findBook(livro)?.[1] ?? "Bíblia"} ${cap}` };
}

export default async function Capitulo({ params }: PageProps<"/i/[slug]/biblia/[livro]/[cap]">) {
  const { slug, livro, cap } = await params;
  const book = findBook(livro);
  const n = Number(cap);
  if (!book || !Number.isInteger(n) || n < 1 || n > book[2]) notFound();
  const i = BOOKS.indexOf(book);
  const prev = n > 1 ? [livro, n - 1] : i > 0 ? [BOOKS[i - 1][0], BOOKS[i - 1][2]] : null;
  const next = n < book[2] ? [livro, n + 1] : i < BOOKS.length - 1 ? [BOOKS[i + 1][0], 1] : null;
  const label = (x: (string | number)[] | null) => (x ? `${findBook(String(x[0]))![1]} ${x[1]}` : null);

  return (
    <SiteShell slug={slug} active="/biblia">
      <Reader key={`${livro}-${n}`} slug={slug} book={book} chapter={n}
        prev={prev && { href: `/i/${slug}/biblia/${prev[0]}/${prev[1]}`, label: label(prev)! }}
        next={next && { href: `/i/${slug}/biblia/${next[0]}/${next[1]}`, label: label(next)! }} />
      <p className="mt-10 text-xs text-zinc-400">{BIBLE_CREDIT}</p>
    </SiteShell>
  );
}
