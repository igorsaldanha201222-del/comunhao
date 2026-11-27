import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

export const loadSiteChurch = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches")
    .select("id, slug, name, logo_url, primary_color, accent_color, youtube_channel, live_on, live_url, live_title")
    .eq("slug", slug).eq("active", true).maybeSingle();
  if (!church) notFound();
  return { supabase, church };
});

export const SITE_LINKS = [["/biblia", "📖 Bíblia"], ["/aovivo", "🔴 Ao vivo"], ["/devocional", "🙏 Devocional"]] as const;

/** Cabeçalho e cores do site da igreja para as páginas internas (Bíblia, Ao vivo, Devocional). */
export async function SiteShell({ slug, active, children }: { slug: string; active?: string; children: ReactNode }) {
  const { church } = await loadSiteChurch(slug);
  const style = {
    ["--brand" as string]: church.primary_color,
    ["--accent" as string]: church.accent_color ?? church.primary_color,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };
  return (
    <div style={style} className="min-h-screen bg-slate-50 text-zinc-800">
      <header className="sticky top-0 z-50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/i/${slug}`} className="flex min-w-0 items-center gap-2 font-bold text-brand">
            {church.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={church.logo_url} alt="" className="h-10 w-auto" />
              : <span aria-hidden>⛪</span>}
            <span className="truncate">{church.name}</span>
          </Link>
          <Link href={`/i/${slug}/participar`} className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-accent">Membro</Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 text-sm font-semibold">
          {SITE_LINKS.map(([href, label]) => (
            <Link key={href} href={`/i/${slug}${href}`}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 ${active === href ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
              {label}{href === "/aovivo" && church.live_on ? " • agora" : ""}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
