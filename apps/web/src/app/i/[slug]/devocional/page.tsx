import Link from "next/link";
import { date, nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { SiteShell, loadSiteChurch } from "../site-shell";
import { DevotionalView, type Devotional } from "./view";

export const metadata = { title: "Devocional" };

export default async function Devocionais({ params }: PageProps<"/i/[slug]/devocional">) {
  const { slug } = await params;
  const { supabase, church } = await loadSiteChurch(slug);
  const { data } = await supabase.from("devotionals").select("*").eq("church_id", church.id).eq("published", true)
    .lte("publish_on", todayBR(nowMs())).order("publish_on", { ascending: false }).limit(30);
  const [today, ...older] = (data ?? []) as Devotional[];

  return (
    <SiteShell slug={slug} active="/devocional">
      {today ? <DevotionalView slug={slug} d={today} /> : (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">🙏</p>
          <p className="mt-2 font-semibold">O devocional de hoje ainda não foi publicado.</p>
        </div>
      )}
      {older.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-brand">Devocionais anteriores</h2>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl bg-white shadow-sm">
            {older.map((d) => (
              <li key={d.id}>
                <Link href={`/i/${slug}/devocional/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    {d.verse_ref && <span className="text-xs text-zinc-500">{d.verse_ref}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">{date(d.publish_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </SiteShell>
  );
}
