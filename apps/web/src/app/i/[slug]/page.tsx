import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { brl, date, dateTime, nowMs, youtubeId } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { STEPS } from "@/lib/journey";
import { todayBR } from "@/lib/kids";
import { SITE_LINKS } from "./site-shell";
import { CopyPix } from "./copy-pix";

async function load(slug: string) {
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches")
    .select("id, slug, name, logo_url, primary_color, accent_color, hero_url, tagline, about, address, city, state, phone, email, instagram, youtube_channel, service_times, pix_key, live_on, live_title")
    .eq("slug", slug).eq("active", true).maybeSingle();
  return { supabase, church };
}

export async function generateMetadata({ params }: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { church } = await load((await params).slug);
  return { title: church?.name ?? "Igreja", description: church?.tagline ?? church?.about ?? undefined };
}

const onlyDigits = (v: string | null) => (v ?? "").replace(/\D/g, "");

// Site público da igreja: as cores e a foto vêm das Configurações do painel.
export default async function ChurchSite({ params }: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  const { supabase, church } = await load(slug);
  if (!church) notFound();
  const now = new Date().toISOString();

  const [{ data: banners }, { data: events }, { data: sermons }, { data: leaders }, { data: devo }] = await Promise.all([
    supabase.from("banners").select("id, title, image_url, link_url").eq("church_id", church.id).order("position").limit(3),
    supabase.from("events").select("id, title, starts_at, location, price_cents, cover_url").eq("church_id", church.id).gte("starts_at", now).order("starts_at").limit(6),
    supabase.from("sermons").select("id, title, preacher, preached_at, video_url").eq("church_id", church.id).order("preached_at", { ascending: false }).limit(3),
    supabase.from("church_leaders").select("id, name, title, bio, photo_url").eq("church_id", church.id).order("position"),
    supabase.from("devotionals").select("id, title, verse_ref, verse_text").eq("church_id", church.id).eq("published", true)
      .lte("publish_on", todayBR(nowMs())).order("publish_on", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const phone = onlyDigits(church.phone);
  const whatsapp = phone ? `https://wa.me/${phone.length <= 11 ? "55" + phone : phone}` : null;
  const fullAddress = [church.address, church.city && `${church.city}${church.state ? " - " + church.state : ""}`].filter(Boolean).join(", ");
  const nav = [
    ["#sobre", "Quem Somos"], ["#agenda", "Cultos & Agenda"],
    ...(leaders?.length ? [["#lideranca", "Liderança"]] : []),
    ["#ofertas", "Ofertas"], ["#contato", "Contato"],
  ];
  const style = {
    ["--brand" as string]: church.primary_color,
    ["--accent" as string]: church.accent_color ?? church.primary_color,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };
  const title = "text-center text-3xl font-bold uppercase tracking-wide text-brand";

  return (
    <div style={style} className="scroll-smooth overflow-x-hidden bg-slate-50 text-zinc-800">
      <header className="sticky top-0 z-50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <a href="#" className="flex min-w-0 items-center gap-2 text-base font-bold text-brand sm:text-xl">
            {church.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={church.logo_url} alt="" className="h-12 w-auto" />
              : <span aria-hidden>⛪</span>}
            <span className="truncate leading-tight">{church.name}</span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-zinc-600 lg:flex">
            {nav.map(([href, label]) => <a key={href} href={href} className="transition hover:text-accent">{label}</a>)}
            {SITE_LINKS.map(([href, label]) => <Link key={href} href={`/i/${slug}${href}`} className="transition hover:text-accent">{label.slice(label.indexOf(" ") + 1)}</Link>)}
          </nav>
          <Link href={`/i/${slug}/participar`} className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent sm:px-5 sm:py-2.5">
            <span className="sm:hidden">Membro</span><span className="hidden sm:inline">Área do Membro</span>
          </Link>
        </div>
      </header>

      {church.live_on && (
        <Link href={`/i/${slug}/aovivo`} className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2.5 text-sm font-bold text-white">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> AO VIVO AGORA{church.live_title ? `: ${church.live_title}` : ""} — assistir →
        </Link>
      )}

      <section className="relative flex min-h-[450px] items-center justify-center bg-cover bg-center text-center"
        style={church.hero_url ? { backgroundImage: `url('${church.hero_url}')` } : { background: "linear-gradient(135deg, var(--brand), #0f172a)" }}>
        {church.hero_url && <div className="absolute inset-0 bg-white/35" />}
        <div className="relative max-w-3xl px-5 py-8 sm:p-8">
          <h1 className={`text-3xl font-extrabold break-words sm:text-6xl ${church.hero_url ? "text-brand [text-shadow:1px_1px_5px_rgba(255,255,255,0.8)]" : "text-white"}`}>
            Bem-vindo à {church.name}
          </h1>
          <p className={`mt-3 text-xl font-bold ${church.hero_url ? "text-zinc-900 [text-shadow:1px_1px_3px_rgba(255,255,255,0.8)]" : "text-white/90"}`}>
            {church.tagline ?? "Um lugar de fé, esperança e amor."}
          </p>
          <Link href={`/i/${slug}/membro`} className="mt-6 inline-block rounded-full bg-brand px-7 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:bg-accent">
            🙋 Quero ser membro
          </Link>
        </div>
      </section>

      <div className="mx-auto -mt-10 grid max-w-4xl grid-cols-3 gap-2 px-4 sm:gap-4">
        {SITE_LINKS.map(([href, label]) => (
          <Link key={href} href={`/i/${slug}${href}`}
            className="relative flex flex-col items-center gap-1 rounded-xl bg-white px-2 py-4 text-center text-sm font-bold text-zinc-800 shadow-[0_5px_20px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 sm:text-base">
            <span className="text-3xl">{label.split(" ")[0]}</span>
            {label.slice(label.indexOf(" ") + 1)}
            {href === "/aovivo" && church.live_on && <span className="absolute top-2 right-2 h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />}
          </Link>
        ))}
      </div>

      {devo && (
        <Link href={`/i/${slug}/devocional/${devo.id}`} className="mx-auto mt-8 block max-w-4xl px-4">
          <div className="rounded-xl border-l-4 border-brand bg-white p-5 shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition hover:shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">🙏 Devocional de hoje</p>
            <p className="mt-1 text-lg font-bold">{devo.title}</p>
            {devo.verse_text && <p className="mt-1 line-clamp-2 italic text-zinc-600">“{devo.verse_text}” {devo.verse_ref && <span className="not-italic font-semibold">— {devo.verse_ref}</span>}</p>}
            <p className="mt-2 text-sm font-semibold text-brand">Ler o devocional →</p>
          </div>
        </Link>
      )}

      {!!banners?.length && (
        <div className="mx-auto grid max-w-6xl gap-4 px-5 pt-12 sm:grid-cols-2">
          {banners.map((b) => {
            // eslint-disable-next-line @next/next/no-img-element
            const img = <img src={b.image_url} alt={b.title} className="aspect-[16/7] w-full rounded-xl object-cover shadow-[0_5px_20px_rgba(0,0,0,0.05)]" />;
            return b.link_url ? <a key={b.id} href={b.link_url}>{img}</a> : <div key={b.id}>{img}</div>;
          })}
        </div>
      )}

      <section id="sobre" className="scroll-mt-24 px-5 py-20">
        <h2 className={title}>Quem Somos</h2>
        <div className="mx-auto mt-10 max-w-3xl rounded-xl bg-white p-8 text-center shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-600">{church.about ?? "Informações institucionais em atualização."}</p>
        </div>
      </section>

      <section id="membro" className="scroll-mt-24 px-5 pb-20">
        <h2 className={title}>Quero ser membro</h2>
        <p className="mx-auto mt-6 max-w-2xl text-center text-zinc-600">Uma trilha simples para você fazer parte da família — acompanhe cada passo pelo site ou pelo app.</p>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.key} className="rounded-xl bg-white p-6 text-center shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
              <span className="text-4xl">{s.icon}</span>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-brand">Etapa {i + 1}</p>
              <p className="mt-1 font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <Link href={`/i/${slug}/membro`} className="inline-block rounded-full bg-brand px-7 py-3 font-bold text-white transition hover:bg-accent">Começar minha jornada →</Link>
        </div>
      </section>

      <section id="agenda" className="scroll-mt-24 bg-white px-5 py-20">
        <h2 className={title}>Cultos & Agenda</h2>
        <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-8 shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-xl font-bold text-brand">Nossos Cultos</h3>
            <p className="mt-3 whitespace-pre-wrap text-zinc-600">{church.service_times ?? "Horários em atualização."}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-8 shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-xl font-bold text-brand">Próximos eventos</h3>
            {events?.length ? (
              <ul className="mt-3 divide-y divide-zinc-200">
                {events.map((e) => (
                  <li key={e.id} className="py-3">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-zinc-500">{dateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ""} · {e.price_cents ? brl(e.price_cents) : "Gratuito"}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-zinc-500">Em breve novidades.</p>}
          </div>
        </div>
        {!!sermons?.length && (
          <div className="mx-auto mt-10 max-w-6xl">
            <h3 className="mb-4 text-center text-xl font-bold text-brand">Mensagens recentes</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sermons.map((s) => {
                const yt = youtubeId(s.video_url);
                return (
                  <a key={s.id} href={s.video_url ?? "#"} target="_blank" rel="noreferrer"
                    className="overflow-hidden rounded-xl bg-white shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {yt && <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />}
                    <div className="p-4">
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-zinc-500">{[s.preacher, date(s.preached_at)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {!!leaders?.length && (
        <section id="lideranca" className="scroll-mt-24 px-5 py-20">
          <h2 className={title}>Liderança</h2>
          <div className="mx-auto mt-10 grid max-w-6xl gap-8 text-center sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((l) => (
              <div key={l.id} className="flex flex-col items-center rounded-xl bg-white px-5 py-8 shadow-[0_5px_15px_rgba(0,0,0,0.05)]">
                {l.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.photo_url} alt={l.name} className="h-36 w-36 rounded-full border-4 border-brand object-cover" />
                  : <span className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-brand bg-slate-100 text-4xl font-bold text-brand">{l.name[0]}</span>}
                <h3 className="mt-4 text-lg font-bold">{l.name}</h3>
                {l.title && <p className="font-semibold text-accent">{l.title}</p>}
                {l.bio && <p className="mt-2 text-sm text-zinc-600">{l.bio}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="ofertas" className="scroll-mt-24 px-5 py-20 text-center text-white" style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 65%, black))" }}>
        <h2 className="text-3xl font-bold uppercase tracking-wide">Dízimos e Ofertas</h2>
        <p className="mx-auto mt-3 max-w-xl italic opacity-90">&ldquo;Honra ao Senhor com os teus bens e com as primícias de toda a tua renda.&rdquo; — Provérbios 3:9</p>
        <div className="mt-8 inline-block rounded-xl border border-white/20 bg-white/10 p-8 backdrop-blur">
          <p className="text-lg font-semibold">Faça um PIX</p>
          {church.pix_key ? <CopyPix value={church.pix_key} /> : <p className="mt-2 rounded-lg bg-white px-4 py-2 font-mono text-zinc-800">Chave não cadastrada</p>}
          <p className="mt-3 text-sm opacity-90">Favorecido: <b>{church.name}</b></p>
          <Link href={`/i/${slug}/doar`} className="mt-5 inline-block rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition hover:brightness-110">
            Contribuir online (Pix, cartão ou boleto)
          </Link>
        </div>
      </section>

      <footer id="contato" className="scroll-mt-24 bg-zinc-900 px-5 pt-16 pb-8 text-zinc-300">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-xl font-bold text-brand">Contato e Redes</h3>
            {fullAddress && <p className="mt-4"><strong className="text-white">Endereço:</strong><br />{fullAddress}</p>}
            {church.phone && (
              <p className="mt-3"><strong className="text-white">WhatsApp:</strong><br />
                {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="hover:text-accent">{church.phone}</a> : church.phone}
              </p>
            )}
            {church.email && <p className="mt-3"><strong className="text-white">E-mail:</strong><br /><a href={`mailto:${church.email}`} className="hover:text-accent">{church.email}</a></p>}
            <div className="mt-4 flex gap-4 text-sm">
              {church.instagram && <a href={`https://instagram.com/${church.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="hover:text-accent">Instagram</a>}
              {church.youtube_channel && <a href={church.youtube_channel} target="_blank" rel="noreferrer" className="hover:text-accent">YouTube</a>}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-brand">Faça parte</h3>
            <p className="mt-4">Baixe o app e entre com o código <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">{church.slug}</code> para ver a agenda, as escalas e contribuir.</p>
            {fullAddress && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noreferrer"
                className="mt-4 inline-block rounded-full border border-white/30 px-5 py-2 text-sm hover:border-accent hover:text-accent">
                Como chegar (Google Maps)
              </a>
            )}
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {church.name}. Todos os direitos reservados. · Feito com {BRAND.name}
        </p>
      </footer>
    </div>
  );
}
