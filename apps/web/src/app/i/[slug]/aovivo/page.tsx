import { date, youtubeId } from "@/lib/format";
import { liveEmbed } from "@/lib/live";
import { SiteShell, loadSiteChurch } from "../site-shell";

export const metadata = { title: "Ao vivo" };

export default async function AoVivo({ params }: PageProps<"/i/[slug]/aovivo">) {
  const { slug } = await params;
  const { supabase, church } = await loadSiteChurch(slug);
  const [{ data: sermons }, { data: info }] = await Promise.all([
    supabase.from("sermons").select("id, title, preacher, preached_at, video_url").eq("church_id", church.id)
      .not("video_url", "is", null).order("preached_at", { ascending: false }).limit(6),
    supabase.from("churches").select("service_times").eq("id", church.id).single(),
  ]);
  const embed = church.live_on ? liveEmbed(church.live_url) : null;
  const channel = church.live_url ?? church.youtube_channel;

  return (
    <SiteShell slug={slug} active="/aovivo">
      {church.live_on ? (
        <>
          <p className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> AO VIVO AGORA
          </p>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{church.live_title ?? `Culto ao vivo · ${church.name}`}</h1>
          {embed ? (
            <div className="mt-4 aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
              <iframe src={embed} title="Transmissão ao vivo" className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : channel && (
            <a href={channel} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-bold text-white">▶ Assistir no YouTube</a>
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-4xl">📺</p>
          <h1 className="mt-2 text-2xl font-extrabold">Não estamos ao vivo agora</h1>
          {info?.service_times && <p className="mt-2 whitespace-pre-line text-zinc-600">Transmitimos nos cultos:{"\n"}{info.service_times}</p>}
          {channel && <a href={channel} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white">Inscreva-se no canal</a>}
        </div>
      )}

      {!!sermons?.length && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-brand">Assista de novo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((s) => {
              const id = youtubeId(s.video_url);
              return (
                <a key={s.id} href={s.video_url!} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-white shadow-sm hover:ring-2 hover:ring-brand">
                  {id
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                    : <div className="flex aspect-video items-center justify-center bg-zinc-200 text-3xl">▶</div>}
                  <div className="p-3">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs text-zinc-500">{[s.preacher, date(s.preached_at)].filter(Boolean).join(" · ")}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </SiteShell>
  );
}
