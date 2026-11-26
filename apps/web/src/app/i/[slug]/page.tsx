import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { brl, date, dateTime, youtubeId } from "@/lib/format";
import { BRAND } from "@/lib/brand";

async function load(slug: string) {
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches")
    .select("id, slug, name, logo_url, primary_color, about, address, city, state, phone, instagram, youtube_channel")
    .eq("slug", slug).eq("active", true).maybeSingle();
  return { supabase, church };
}

export async function generateMetadata({ params }: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { church } = await load((await params).slug);
  return { title: church?.name ?? "Igreja", description: church?.about ?? undefined };
}

// Site público da igreja: banners, programação, pregações e doação.
export default async function ChurchSite({ params }: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  const { supabase, church } = await load(slug);
  if (!church) notFound();
  const now = new Date().toISOString();

  const [{ data: banners }, { data: events }, { data: sermons }] = await Promise.all([
    supabase.from("banners").select("id, title, image_url, link_url").eq("church_id", church.id).order("position").limit(3),
    supabase.from("events").select("id, title, starts_at, location, price_cents, cover_url").eq("church_id", church.id).gte("starts_at", now).order("starts_at").limit(6),
    supabase.from("sermons").select("id, title, preacher, preached_at, video_url").eq("church_id", church.id).order("preached_at", { ascending: false }).limit(6),
  ]);

  return (
    <div style={{ ["--brand" as string]: church.primary_color }}>
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {church.logo_url && <img src={church.logo_url} alt="" className="h-10 w-10 rounded-full bg-white object-cover" />}
            <span className="text-lg font-semibold">{church.name}</span>
          </div>
          <Link href={`/i/${slug}/doar`} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900">Contribuir</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {!!banners?.length && (
          <div className="grid gap-4 sm:grid-cols-2">
            {banners.map((b) => {
              // eslint-disable-next-line @next/next/no-img-element
              const img = <img src={b.image_url} alt={b.title} className="aspect-[16/7] w-full rounded-xl object-cover" />;
              return b.link_url ? <a key={b.id} href={b.link_url}>{img}</a> : <div key={b.id}>{img}</div>;
            })}
          </div>
        )}

        {church.about && (
          <section>
            <h2 className="text-xl font-semibold">Quem somos</h2>
            <p className="mt-2 whitespace-pre-wrap text-zinc-700">{church.about}</p>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold">Próximos eventos</h2>
          {events?.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <article key={e.id} className="card p-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.cover_url && <img src={e.cover_url} alt="" className="aspect-video w-full rounded-t-xl object-cover" />}
                  <div className="p-4">
                    <h3 className="font-medium">{e.title}</h3>
                    <p className="text-sm text-zinc-500">{dateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ""}</p>
                    <p className="mt-1 text-sm">{e.price_cents ? brl(e.price_cents) : "Gratuito"} · inscreva-se pelo app</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="mt-2 text-zinc-500">Em breve novidades.</p>}
        </section>

        {!!sermons?.length && (
          <section>
            <h2 className="text-xl font-semibold">Pregações</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sermons.map((s) => {
                const yt = youtubeId(s.video_url);
                return (
                  <a key={s.id} href={s.video_url ?? "#"} target="_blank" className="card block p-0 hover:shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {yt && <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-t-xl object-cover" />}
                    <div className="p-4">
                      <h3 className="font-medium">{s.title}</h3>
                      <p className="text-sm text-zinc-500">{[s.preacher, date(s.preached_at)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <section className="card">
          <h2 className="font-semibold">Visite-nos</h2>
          <p className="mt-2 text-sm text-zinc-700">
            {[church.address, church.city && `${church.city}${church.state ? "/" + church.state : ""}`].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-700">{[church.phone, church.instagram].filter(Boolean).join(" · ")}</p>
          <p className="mt-3 text-sm">
            Baixe o app e entre com o código <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">{church.slug}</code>.
          </p>
        </section>
      </main>
      <footer className="py-8 text-center text-xs text-zinc-400">Feito com {BRAND.name}</footer>
    </div>
  );
}
