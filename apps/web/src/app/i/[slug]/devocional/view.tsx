import { headers } from "next/headers";
import { date } from "@/lib/format";

export type Devotional = {
  id: string; publish_on: string; title: string; verse_ref: string | null; verse_text: string | null;
  body: string; prayer: string | null; author: string | null; image_url: string | null;
};

export async function DevotionalView({ slug, d }: { slug: string; d: Devotional }) {
  const h = await headers();
  const url = `https://${h.get("host")}/i/${slug}/devocional/${d.id}`;
  const share = `🙏 Devocional: ${d.title}${d.verse_ref ? ` (${d.verse_ref})` : ""}
${url}`;
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {d.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={d.image_url} alt="" className="aspect-[16/7] w-full object-cover" />
        : <div className="h-3 bg-brand" />}
      <div className="p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Devocional · {date(d.publish_on)}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{d.title}</h1>
        {d.verse_text && (
          <blockquote className="mt-6 rounded-xl border-l-4 border-brand bg-brand/5 p-4 text-lg italic" style={{ fontFamily: "Georgia, serif" }}>
            “{d.verse_text}”
            {d.verse_ref && <footer className="mt-2 text-sm font-semibold not-italic text-brand">— {d.verse_ref}</footer>}
          </blockquote>
        )}
        <div className="mt-6 whitespace-pre-line text-lg leading-relaxed text-zinc-700">{d.body}</div>
        {d.prayer && (
          <div className="mt-8 rounded-xl bg-amber-50 p-5">
            <p className="font-bold text-amber-900">🙏 Oração</p>
            <p className="mt-1 whitespace-pre-line text-amber-900">{d.prayer}</p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="text-sm text-zinc-500">{d.author ? `Por ${d.author}` : ""}</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Compartilhar no WhatsApp</a>
        </div>
      </div>
    </article>
  );
}
